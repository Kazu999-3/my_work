'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Rocket, ShieldAlert, Zap, TrendingUp, AlertCircle, History } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PoroCrashGameProps {
  userCoins: number;
  onBalanceChange: (newBalance: number) => void;
}

type GameState = 'IDLE' | 'FLYING' | 'CRASHED' | 'CASHED_OUT';

/**
 * 📈 倍率カーブのグラフ（実際のクラッシュゲーム風）
 *
 * 軌跡 {t: 経過秒, m: 倍率} を受け取り、SVGの折れ線として描く。
 * - 横軸: 経過時間。最低6秒ぶんの幅を確保し、超えたら伸びる
 * - 縦軸: 倍率。最低2.0xぶんを確保し、超えたら伸びる（常にカーブが収まる）
 * - 塗り: カーブ下を薄く塗ってロケットの軌跡らしく見せる
 * - crashed のときは赤、それ以外は琥珀色
 */
function MultiplierCurve({
  curve,
  crashed,
  cashedOut,
}: {
  curve: { t: number; m: number }[];
  crashed: boolean;
  cashedOut: boolean;
}) {
  if (curve.length < 2) return null;

  const W = 300;
  const H = 120;
  const PAD = 4;

  const maxT = Math.max(6, curve[curve.length - 1].t);
  const maxM = Math.max(2, curve[curve.length - 1].m);

  const x = (tt: number) => PAD + (tt / maxT) * (W - PAD * 2);
  // 倍率1.0を下端、maxM を上端にする
  const y = (mm: number) => H - PAD - ((mm - 1) / (maxM - 1 || 1)) * (H - PAD * 2);

  const pts = curve.map((c) => `${x(c.t).toFixed(1)},${y(c.m).toFixed(1)}`).join(' ');
  const area = `${PAD},${H - PAD} ${pts} ${x(curve[curve.length - 1].t).toFixed(1)},${H - PAD}`;

  const stroke = crashed ? '#f43f5e' : cashedOut ? '#34d399' : '#fbbf24';
  const fill = crashed ? 'rgba(244,63,94,0.15)' : cashedOut ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)';

  const last = curve[curve.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="absolute inset-x-0 bottom-0 h-32 w-full pointer-events-none"
      aria-hidden="true"
    >
      {/* 目盛り（横線）*/}
      {[0.25, 0.5, 0.75].map((r) => (
        <line
          key={r}
          x1={PAD}
          x2={W - PAD}
          y1={H - PAD - r * (H - PAD * 2)}
          y2={H - PAD - r * (H - PAD * 2)}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1"
        />
      ))}
      <polygon points={area} fill={fill} />
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* 先端の光点 */}
      <circle cx={x(last.t)} cy={y(last.m)} r="4" fill={stroke}>
        {!crashed && !cashedOut && (
          <animate attributeName="r" values="3;5.5;3" dur="1s" repeatCount="indefinite" />
        )}
      </circle>
    </svg>
  );
}

export default function PoroCrashGame({ userCoins, onBalanceChange }: PoroCrashGameProps) {
  const [betAmount, setBetAmount] = useState<number>(100);
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [multiplier, setMultiplier] = useState<number>(1.0);
  // 📈 倍率カーブの軌跡。{t: 経過秒, m: 倍率} を溜めてSVGで描画する。
  // 上限は120点（約6秒ぶんの描画点）で、超えたら間引いて負荷を抑える。
  const [curve, setCurve] = useState<{ t: number; m: number }[]>([]);
  const [crashHistory, setCrashHistory] = useState<number[]>([1.84, 1.25, 4.12, 1.05, 12.4]);
  const [finalMultiplier, setFinalMultiplier] = useState<number>(1.0);
  const [winCoins, setWinCoins] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCashingOut, setIsCashingOut] = useState<boolean>(false);
  const [launchCooldown, setLaunchCooldown] = useState<boolean>(false);
  // 利確を押してサーバーの裁定を待っている最中か。UIは先に結果を出すが、
  // 「確定中」であることは隠さない（後からクラッシュ判定に覆る可能性があるため）。
  const [awaitingSettle, setAwaitingSettle] = useState<boolean>(false);

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  // 軌跡の実データ。毎フレーム push し、表示用の state へは間引いて反映する。
  const curveRef = useRef<{ t: number; m: number }[]>([]);
  // 発射ボタンを押した瞬間の時刻。API応答を待つあいだのラグを打ち消すのに使う。
  const launchPressedAtRef = useRef<number>(0);
  // gameToken の ref 版。アニメーションループはSTART応答を待たずに回り始めるので、
  // state の再レンダリングを待たずに最新のトークンを読めるようにしておく。
  const gameTokenRef = useRef<string | null>(null);
  // START リクエストそのもの。発射直後（トークン到着前）に利確を押されたとき、
  // 無反応にせずトークンの到着を待ち合わせるために保持する。
  const startRequestRef = useRef<Promise<void> | null>(null);
  // このラウンドがまだ決着していないか。爆発監視の応答が利確後に遅れて届いて
  // 結果を上書きしてしまうのを防ぐ。
  const roundActiveRef = useRef<boolean>(false);
  // 飛行中の爆発監視（ロングポーリング）を打ち切るためのコントローラ
  const crashWatchRef = useRef<AbortController | null>(null);
  // サーバーの計時開始に追いつくために、まだ吸収しきれていないズレ(ms)。
  // 一気に引き戻すと倍率が逆戻りして見えるので、上昇を半速にして徐々に吸収する。
  const pendingSkewRef = useRef<number>(0);

  // ゲーム開始（発射）
  const handleLaunch = async () => {
    if (gameState === 'FLYING' || isCashingOut || launchCooldown) return;
    if (userCoins < betAmount) {
      setErrorMsg(`コインが足りません (所持: ${userCoins}🪙 / 必要: ${betAmount}🪙)`);
      return;
    }

    setErrorMsg(null);
    // 押した瞬間を記録しておき、API応答後にこれを開始時刻として使う（体感ラグの解消）
    launchPressedAtRef.current = performance.now();
    setGameState('FLYING');
    setMultiplier(1.0);
    curveRef.current = [{ t: 0, m: 1.0 }];
    setCurve([{ t: 0, m: 1.0 }]);  // 前回の軌跡をリセット
    setWinCoins(0);

    // ⚠️ 2026-09-23: 発射ボタンの体感ラグ対策（2回目の修正）。
    // 初回は「押した時刻を開始時刻として遡らせる」だけの補正にしたが、
    // アニメーション自体はSTART応答後に開始していたため、押してから約0.4秒は
    // 1.00xで固まり、そのあと一気に数値が飛ぶ挙動になっていた（かえって不自然）。
    // ここでは応答を待たずにその場でループを回し始める。トークンはrefへ後から差し込む。
    // ⚠️ ただし押下時刻を起点にするとサーバーの計時開始（started_at）より約0.3秒
    //    先行する。当初これを「ずれない」と誤って書いていたが、実際には
    //    「画面はまだ飛んでいるのに利確が爆発済みで弾かれる」不具合の原因になった。
    //    START応答で受け取る serverElapsedMs を使って下で合わせ直している。
    gameTokenRef.current = null;
    startTimeRef.current = launchPressedAtRef.current;
    pendingSkewRef.current = 0;
    roundActiveRef.current = true;
    runFlightAnimation();

    let resolveStart: () => void = () => {};
    startRequestRef.current = new Promise<void>((r) => {
      resolveStart = r;
    });

    try {
      const res = await fetch('/api/bet/crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START', betAmount }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '発射に失敗しました');
      }

      gameTokenRef.current = data.gameToken;
      onBalanceChange(data.newBalance);

      // ⚠️ 2026-09-23: START の往復中に既に爆発していたケース。
      // この往復は実測で1.3秒ほどかかる一方、クラッシュ値の分布上およそ3割の
      // ラウンドは1.4秒以内に爆発する。トークンが無いと爆発監視を開始できないため、
      // 従来はこれらが「爆発済みなのに画面は飛行中」になり、利確を押すと
      // クラッシュ判定されていた。サーバーが結果を返してきたら即座に反映する。
      // ※ 既に利確を押している場合（roundActive=false）は上書きしない。
      //    その場合はサーバーの裁定に従う。
      if (data.alreadyCrashed && roundActiveRef.current) {
        roundActiveRef.current = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        const cp = data.alreadyCrashed;
        setMultiplier(cp);
        setFinalMultiplier(cp);
        setGameState('CRASHED');
        setCrashHistory((prev) => [cp, ...prev.slice(0, 5)]);
        return;
      }

      // ⚠️ 2026-09-23: サーバーとの時計合わせ。
      // サーバーの計時開始（crash_sessions.started_at）は認証・プレイヤー取得・
      // コイン減算のあとなので、押下時刻から計時しているクライアントは約0.3秒
      // 先行してしまう。放っておくと画面がまだ飛んでいるのにサーバー的には
      // 爆発後、という食い違いが出る（実際「爆発してないのに利確で爆発する」
      // 不具合として報告された）。ここでズレを測り、以降のフレームで吸収する。
      if (typeof data.serverElapsedMs === 'number') {
        const clientElapsed = performance.now() - startTimeRef.current;
        const skew = clientElapsed - data.serverElapsedMs;
        // 異常値（時計の飛びや極端な遅延）は無視する
        pendingSkewRef.current = Math.max(0, Math.min(skew, 1500));
      }

      startCrashWatch(data.gameToken);
    } catch (e: any) {
      roundActiveRef.current = false;
      // 発射そのものが失敗したので、先行させたアニメーションを巻き戻す
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      gameTokenRef.current = null;
      setGameState('IDLE');
      setMultiplier(1.0);
      curveRef.current = [];
      setCurve([]);
      setErrorMsg(e.message || 'エラーが発生しました');
    } finally {
      resolveStart();
    }
  };

  // 💥 爆発監視（ロングポーリング）
  //
  // 従来は0.3秒間隔でVERIFY_CRASHを叩いていたが、応答の往復に0.4秒かかるため
  // 爆発が画面に出るまで最大0.7秒遅れ、その間クライアントは倍率を伸ばし続けていた。
  // 結果「画面ではまだ飛んでいるのに、利確を押すと爆発済み扱いになる」という
  // 食い違いが起きる（倍率換算で最大16%ぶんの空白時間）。
  // ここではサーバーに爆発の瞬間まで待ってもらい、起きた瞬間に応答をもらう。
  // 遅れは片道のネットワーク遅延だけになる。サーバー側の待ち上限は6秒なので、
  // 未決着で返ってきたら即座に張り直す。
  const startCrashWatch = (token: string) => {
    const controller = new AbortController();
    crashWatchRef.current = controller;

    const poll = async () => {
      while (roundActiveRef.current && !controller.signal.aborted) {
        try {
          const res = await fetch('/api/bet/crash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'VERIFY_CRASH', gameToken: token, wait: true }),
            signal: controller.signal,
          });
          const vData = await res.json();

          // 利確などで既に決着している場合は結果を上書きしない
          if (!roundActiveRef.current || controller.signal.aborted) return;

          if (vData.crashed && vData.crashPoint) {
            roundActiveRef.current = false;
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            const cp = vData.crashPoint;
            setMultiplier(cp);
            setFinalMultiplier(cp);
            setGameState('CRASHED');
            setCrashHistory((prev) => [cp, ...prev.slice(0, 5)]);
            return;
          }
          // 待ち上限で打ち切られただけ。そのまま次のロングポーリングを張る。
        } catch {
          if (controller.signal.aborted) return;
          // 通信エラー時だけ少し間を置いて再試行する
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    };

    void poll();
  };

  // 飛行アニメーションループ
  const runFlightAnimation = () => {
    // ⚠️ 2026-09-23 修正: 描画がカクついていた原因は2つ。
    //   1) loop が async で通信を await していたため、往復が終わるまで次フレームを
    //      requestAnimationFrame できず、0.3秒ごとに描画が止まっていた。
    //   2) 毎フレーム setCurve で配列を作り直しており、再レンダリングが重かった。
    // → 通信はループから切り離し（startCrashWatch へ）、軌跡は ref に溜めて
    //   表示用stateの更新を約50msごとに間引く。倍率の数字は毎フレーム更新する。
    let lastCurvePush = 0;
    let lastFrameTime = 0;

    const loop = (now: number) => {
      // サーバーとのズレを吸収する。startTimeRef を前へずらすと経過時間が縮むので、
      // 倍率が逆戻りせず「上昇が半分の速度になる」形で自然に追いつける。
      if (pendingSkewRef.current > 0 && lastFrameTime) {
        // 吸収の速さ: 当初は0.5（半速）にしていたが、ズレが0.8秒近くあった当時は
        // 吸収に2秒近くかかり、短いラウンドでは最後までクライアントが先行したまま
        // だった。サーバー側の計時開始を受信時刻に変えてズレ自体が小さくなったので、
        // 0.8（=実時間の2割の速さで上昇）にして0.3秒程度で追いつかせる。
        const absorb = Math.min(pendingSkewRef.current, (now - lastFrameTime) * 0.8);
        startTimeRef.current += absorb;
        pendingSkewRef.current -= absorb;
      }
      lastFrameTime = now;

      const elapsed = (now - startTimeRef.current) / 1000; // 秒数
      // 指数関数的カーブで倍率計算 (0秒=1.0x, 2秒=1.5x, 5秒=3.0x, 10秒=10x)
      const current = Math.floor(Math.pow(Math.E, elapsed * 0.22) * 100) / 100;

      // 100倍到達で天井
      if (current >= 100.0) {
        roundActiveRef.current = false;
        crashWatchRef.current?.abort();
        setMultiplier(100.0);
        setFinalMultiplier(100.0);
        setGameState('CRASHED');
        setCrashHistory((prev) => [100.0, ...prev.slice(0, 5)]);
        return;
      }

      setMultiplier(current);

      // 軌跡は ref に毎フレーム溜め、stateへの反映は約50msごと（＝最大20fps）に間引く。
      curveRef.current.push({ t: elapsed, m: current });
      if (curveRef.current.length > 240) {
        curveRef.current = curveRef.current.filter((_, i) => i % 2 === 0);
      }
      if (now - lastCurvePush > 50) {
        lastCurvePush = now;
        setCurve([...curveRef.current]);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  };

  // 利確（キャッシュアウト）
  const handleCashout = async () => {
    if (gameState !== 'FLYING' || isCashingOut) return;

    setIsCashingOut(true);

    // ⚠️ 2026-09-23: 利確ボタンの体感ラグ対策。
    // CASHOUT APIは本番実測で 0.33〜0.43秒 かかる。認証で弾かれるリクエストでも
    // 同じだけかかるため、これは Vercel Function 呼び出しそのものの下限であり、
    // サーバー側のDB往復（4回）を削っても 0.35秒は縮まらない。
    // 応答を待ってから結果を描いていたので、押しても0.4秒なにも起きない
    // 「効かないボタン」に見えていた。ここでは押した瞬間の倍率で結果を先に描き、
    // サーバーの裁定で後から確定させる。
    // ※ 勝利演出（紙吹雪）はサーバーがOKを返すまで出さない。VERIFY_CRASHの
    //   ポーリングが0.3秒間隔なので「実はもう爆発していた」ことがあり得るため、
    //   先に祝ってから負けに覆るのだけは避ける。
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    // 爆発監視を打ち切る。ここで止めないと、飛行中に張っていたロングポーリングが
    // このあと「爆発した」と返してきて、利確の結果を上書きしてしまう。
    roundActiveRef.current = false;
    crashWatchRef.current?.abort();
    crashWatchRef.current = null;

    const claimMult = multiplier;
    setGameState('CASHED_OUT');
    setFinalMultiplier(claimMult);
    setWinCoins(Math.floor(betAmount * claimMult));
    setAwaitingSettle(true);

    // 発射直後（START応答が届く前）に利確を押されたケース。以前は無反応で返して
    // いたが、アニメーションが押した瞬間から動くようになった今は「押せるのに
    // 効かない0.4秒」が生まれてしまうため、トークンの到着を待ち合わせる。
    // 倍率は待ち合わせ前に確定させてあるので、待った分だけ得をすることはない。
    let token = gameTokenRef.current;
    if (!token && startRequestRef.current) {
      await startRequestRef.current;
      token = gameTokenRef.current;
    }
    if (!token) {
      // STARTそのものが失敗している（handleLaunch側でエラー表示済み）
      setAwaitingSettle(false);
      setIsCashingOut(false);
      setGameState('IDLE');
      setMultiplier(1.0);
      return;
    }

    try {
      const res = await fetch('/api/bet/crash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CASHOUT',
          gameToken: token,
          claimedMultiplier: claimMult,
        }),
      });

      const data = await res.json();

      // サーバーがエラーを返した場合（セッション切れ・多重利確など）は
      // クラッシュではない。以前は data.success が無いだけで💥表示にしていたため、
      // 「利確を押したのに爆発した」と見える原因のひとつになっていた。
      if (!res.ok || data.ok === false) {
        setGameState('IDLE');
        setMultiplier(1.0);
        curveRef.current = [];
        setCurve([]);
        setWinCoins(0);
        setErrorMsg(data.error || '利確に失敗しました。もう一度お試しください。');
        return;
      }

      if (data.success) {
        // サーバー裁定で確定。倍率・獲得コインはサーバーの値で上書きする。
        setFinalMultiplier(data.multiplier);
        setWinCoins(data.winCoins);
        onBalanceChange(data.newBalance);

        if (data.multiplier >= 5.0) {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
        } else {
          confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
        }
      } else {
        // 間に合っていなかった（すでに爆発済み）ので結果を差し替える
        setGameState('CRASHED');
        setFinalMultiplier(data.actualCrash || claimMult);
        setWinCoins(0);
        if (data.actualCrash) {
          setCrashHistory((prev) => [data.actualCrash, ...prev.slice(0, 5)]);
        }
      }
    } catch {
      setGameState('CRASHED');
      setWinCoins(0);
    } finally {
      setAwaitingSettle(false);
      setIsCashingOut(false);
      // 利確直後の連打・誤タップによる次発射を防止（0.8秒クールダウン）
      setLaunchCooldown(true);
      setTimeout(() => {
        setLaunchCooldown(false);
      }, 800);
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      roundActiveRef.current = false;
      crashWatchRef.current?.abort();
    };
  }, []);

  // ロケットのY軸位置（倍率に応じた高さ）
  const progressHeight = Math.min(85, (multiplier - 1.0) * 18);

  return (
    <div className="bg-gradient-to-b from-stone-900 via-[#1c1917] to-stone-950 border border-stone-800 rounded-3xl p-5 sm:p-7 text-white shadow-xl space-y-6 max-w-2xl mx-auto">
      {/* タイトルヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-stone-900 rounded-[14px] flex items-center justify-center text-2xl">
              🚀
            </div>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-teal-300 to-emerald-400">
              PORO ROCKET CRASH
            </h2>
            <p className="text-xs text-stone-400">
              ポロのロケットが空へ上昇！爆発する前に脱出して倍率コインを獲得せよ！
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-stone-800/70 border border-stone-700/60 px-3.5 py-1.5 rounded-xl self-start sm:self-center">
          <span className="text-xs text-stone-400">所持コイン:</span>
          <span className="text-sm font-black text-amber-400 font-mono">
            {userCoins.toLocaleString()} 🪙
          </span>
        </div>
      </div>

      {/* 直近のクラッシュ履歴バー */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-mono scrollbar-none">
        <span className="text-stone-500 flex items-center gap-1 shrink-0 mr-1">
          <History size={12} /> 履歴:
        </span>
        {crashHistory.map((h, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 rounded-lg border font-bold shrink-0 ${
              h >= 5.0
                ? 'bg-purple-950/70 border-purple-500/60 text-purple-300'
                : h >= 2.0
                ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
                : 'bg-stone-800/70 border-stone-700 text-stone-400'
            }`}
          >
            {h.toFixed(2)}x
          </span>
        ))}
      </div>

      {/* フライト画面（夜空・大気圏） */}
      <div className="h-64 sm:h-72 bg-gradient-to-b from-indigo-950/40 via-stone-950 to-stone-900 border-2 border-stone-800 rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between shadow-inner">
        {/* 背景の星屑 */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

        {/* 📈 倍率カーブ（発射後の軌跡を可視化） */}
        <MultiplierCurve
          curve={curve}
          crashed={gameState === 'CRASHED'}
          cashedOut={gameState === 'CASHED_OUT'}
        />

        {/* 倍率大表示 */}
        <div className="relative z-10 text-center pt-2">
          {gameState === 'CRASHED' ? (
            <div className="animate-bounce">
              <span className="text-4xl sm:text-6xl font-black font-mono text-rose-500 drop-shadow-md">
                💥 {finalMultiplier.toFixed(2)}x
              </span>
              <p className="text-xs font-bold text-rose-400 mt-1">CRASHED! ロケット爆発！</p>
            </div>
          ) : gameState === 'CASHED_OUT' ? (
            <div className="animate-in zoom-in-95">
              <span className="text-4xl sm:text-6xl font-black font-mono text-emerald-400 drop-shadow-md">
                🎉 {finalMultiplier.toFixed(2)}x
              </span>
              <p className="text-xs font-bold text-emerald-300 mt-1">
                {awaitingSettle
                  ? `+${winCoins.toLocaleString()} 🪙 脱出！サーバーで確定処理中…`
                  : `+${winCoins.toLocaleString()} 🪙 利確成功！お見事！`}
              </p>
            </div>
          ) : (
            <div>
              <span
                className={`text-5xl sm:text-7xl font-black font-mono transition-colors drop-shadow-md ${
                  multiplier >= 5.0
                    ? 'text-purple-400'
                    : multiplier >= 2.0
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {multiplier.toFixed(2)}x
              </span>
              <p className="text-xs font-bold text-stone-400 mt-1">
                {gameState === 'FLYING' ? '🚀 上昇中！爆発前に利確せよ！' : '待機中... ベットして発射！'}
              </p>
            </div>
          )}
        </div>

        {/* 上昇するポロ・ロケット */}
        <div className="relative z-10 w-full h-24">
{/* 2026-09-23: transition-all duration-100 は毎フレームの位置更新と競合して
                 カクついていた（100ms分の補間が常に上書きされる）。
                 requestAnimationFrame で毎フレーム更新しているのでtransitionは不要。
                 will-change でGPU合成に乗せる。 */}
          <div
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center will-change-[bottom]"
            style={{
              bottom: `${progressHeight}%`,
            }}
          >
            {gameState === 'CRASHED' ? (
              <span className="text-4xl animate-ping">💥</span>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-4xl select-none animate-pulse">🐹🚀</span>
                {gameState === 'FLYING' && (
                  <span className="text-xs font-mono font-black text-yellow-400 animate-bounce">
                    🔥
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 下部地面ライン */}
        <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-stone-500 border-t border-stone-800/80 pt-1">
          <span>地面 (1.00x)</span>
          <span>大気圏突破 (10.00x+)</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5 justify-center">
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 操作パネル: ベット選択 ＆ 発射/利確ボタン */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-stone-400 mr-1">ベット額:</span>
          {[50, 100, 300, 500, 1000].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setBetAmount(amt)}
              disabled={gameState === 'FLYING'}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                betAmount === amt
                  ? 'bg-emerald-500 text-stone-950 shadow-md shadow-emerald-500/30 font-extrabold ring-2 ring-teal-300'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
              } disabled:opacity-50`}
            >
              {amt} 🪙
            </button>
          ))}
        </div>

        {/* アクションボタン */}
        {gameState === 'FLYING' ? (
          <button
            type="button"
            onClick={handleCashout}
            disabled={isCashingOut}
            className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-wider bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-stone-950 shadow-lg shadow-emerald-500/40 animate-pulse hover:scale-[1.01] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-wait"
          >
            {isCashingOut ? (
              <span>⏳ 利確処理中...</span>
            ) : (
              <span>💰 {(betAmount * multiplier).toFixed(0)} 🪙 で今すぐ利確！ ({multiplier.toFixed(2)}x)</span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLaunch}
            disabled={userCoins < betAmount || isCashingOut || launchCooldown}
            className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-wider bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 hover:from-teal-400 hover:to-emerald-400 text-stone-950 shadow-lg shadow-teal-500/30 hover:scale-[1.01] active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Rocket size={18} />
            <span>
              {launchCooldown ? '⏳ 発射準備中...' : gameState === 'CASHED_OUT' || gameState === 'CRASHED' ? `🚀 もう一度発射！ (${betAmount} 🪙)` : `🚀 ${betAmount} 🪙 でロケット発射！`}
            </span>
          </button>
        )}
      </div>

      {/* ゲームルール */}
      <div className="bg-stone-950/60 border border-stone-800/80 rounded-2xl p-4 text-xs space-y-1.5 text-stone-400 leading-relaxed">
        <h4 className="font-extrabold text-stone-300 flex items-center gap-1.5 text-xs">
          <Zap size={13} className="text-yellow-400" />
          <span>ポロ・チキンレースの掟</span>
        </h4>
        <p>
          • ロケットは発射後、徐々に倍率を上げながら宇宙へ上昇します。<br />
          • **ロケットが爆発する前に「利確」ボタンを押せば、現在の倍率 × ベット額のコインを獲得！**<br />
          • 爆発してしまったらベット額は全額没収。どこまで粘れるかの究極の心理戦です！
        </p>
      </div>
    </div>
  );
}
