'use client';

import React, { useState } from 'react';
import {
  Shield,
  Zap,
  Target,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Award,
  Swords,
  Crosshair,
  TrendingUp,
  Flame,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { KAZURIN_STYLE_PROFILE } from '../../lib/playerStyleProfile';

// プレイスタイルの4大タイプ
const PLAY_STYLE_TYPES = [
  {
    id: 'farmer_scaler',
    name: 'ファームスケーリング＆セーフティ型',
    badge: '現在のKazurinタイプ',
    icon: '🌾',
    color: 'emerald',
    desc: '無駄死にを極限まで排除し、正確なジャングルルートで確実にゴールド差をつける高安定スタイル。',
    pros: 'ゲーム終盤のアイテム先行、逆転率の高さ、ティルトしにくい安定感',
    cons: '序盤15分に敵JGの能動的ガンクで味方レーンが崩壊した際に試合展開が重くなる',
    recommendedChamps: ['Lillia', 'Graves', 'Shyvana', 'Karthus', 'Viego'],
  },
  {
    id: 'invader_counter',
    name: 'インベード侵略＆カウンター型',
    badge: '次のステップ推奨',
    icon: '⚔️',
    color: 'amber',
    desc: '敵JGの初動を読み切り、敵陣のキャンプを奪う・カウンターガンクで敵の行動を無効化するスタイル。',
    pros: '低リスクで敵JGを完全に腐らせ、味方の安全を間接的に確保できる',
    cons: '味方レーンのプッシュ状況（プライオリティ）を見誤ると孤立死するリスク',
    recommendedChamps: ['Nidalee', 'Graves', 'Kindred', 'Talon'],
  },
  {
    id: 'gank_snowball',
    name: 'アグレッシブ・ガンカー型',
    badge: '弱点克服型',
    icon: '⚡',
    color: 'rose',
    desc: 'ファームを必要最小限に抑え、序盤からハイペースにレーンへ干渉して味方をスノーボールさせる。',
    pros: '15分以内の降伏勝ちを量産可能、味方のメンタルを保ちやすい',
    cons: 'ガンク失敗時のCS遅れが大きく、失敗が続くと急速に腐る',
    recommendedChamps: ['XinZhao', 'JarvanIV', 'Nocturne', 'LeeSin'],
  },
  {
    id: 'controller_tank',
    name: '集団戦コントロール＆タンク型',
    badge: 'チーム支援型',
    icon: '🛡️',
    color: 'sky',
    desc: '視界確保とオブジェクト管理を徹底し、集団戦のイニシエートで試合を支配するチームプレイ重視スタイル。',
    pros: '味方のキャリーが育ったときの勝率が跳ね上がる、構成事故が起きにくい',
    cons: 'ソロQで味方キャリーが機能しないときに1人で試合を決めきれない',
    recommendedChamps: ['Zac', 'Amumu', 'Sejuani', 'Maokai'],
  },
];

// セルフ診断テスト用の5つの質問
const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: '1周目のフルクリア（3:15〜3:30）が終わった時、最初の行動は？',
    options: [
      { text: 'スカトルを取って即リコールし、アイテムを買って2周目へ入る', type: 'farmer_scaler' },
      { text: '敵JGの出現位置をマップで見て、逆サイドの敵キャンプへ侵入する', type: 'invader_counter' },
      { text: '押されているレーンやHPの削り合いがあるレーンへ即ガンクする', type: 'gank_snowball' },
      { text: '敵JGのガンク先を予測し、川の視界を置いて味方レーンの背後に潜む', type: 'controller_tank' },
    ],
  },
  {
    id: 2,
    question: '味方ボットが連続でソロデスしてピンを連打してきた時、どう対応する？',
    options: [
      { text: 'ボットは捨ててトップ側で確実にCSとヴォイドグラブを回収する', type: 'farmer_scaler' },
      { text: '敵JGがボットへ寄りそうなので、敵のトップ側ジャングルを丸ごと奪う', type: 'invader_counter' },
      { text: 'これ以上の崩壊を防ぐため、フルガンクして1キルをボットに渡す', type: 'gank_snowball' },
      { text: 'ボット周囲の視界を固め、タワーダイブされないようにカバーに入る', type: 'controller_tank' },
    ],
  },
  {
    id: 3,
    question: 'ドラゴンとヴォイドグラブが同時に湧いている時、優先順位は？',
    options: [
      { text: '触りやすい方のオブジェクトを速攻で触り、ファームに戻る', type: 'farmer_scaler' },
      { text: '敵JGがいる逆側のオブジェクトをノーリスクでスティールする', type: 'invader_counter' },
      { text: '先に近くのレーンをガンクして人数有利を作ってから両方狙う', type: 'gank_snowball' },
      { text: '視界が取れていて味方が寄れる方のオブジェクトを優先する', type: 'controller_tank' },
    ],
  },
  {
    id: 4,
    question: '中盤（15〜20分）の集団戦前、どこに位置取ることが多い？',
    options: [
      { text: 'サイドレーンのウェーブを押し込み、安全なファームを回収してから合流', type: 'farmer_scaler' },
      { text: '敵の裏側のブッシュに潜み、敵の甘えた孤立キャリーを狙う', type: 'invader_counter' },
      { text: '先頭を切って敵キャリーへフラッシュイン・イニシエートを狙う', type: 'gank_snowball' },
      { text: '味方ADCの隣でピール（護衛）しながら敵のエンゲージを待つ', type: 'controller_tank' },
    ],
  },
  {
    id: 5,
    question: '試合に負けた時、最も多いシチュエーションは？',
    options: [
      { text: '自分はKDAもCSも良好だが、味方レーンが壊れていて集団戦で負けた', type: 'farmer_scaler' },
      { text: '敵陣に深く入りすぎて味方のカバーが間に合わず捕まった', type: 'invader_counter' },
      { text: '序盤の無理なガンクが失敗して相手JGにレベル差をつけられた', type: 'gank_snowball' },
      { text: 'オブジェクト前で味方が先にキャッチされて戦えなかった', type: 'controller_tank' },
    ],
  },
];

export default function PlayerStyleRadarCard() {
  const p = KAZURIN_STYLE_PROFILE;
  const [activeTab, setActiveTab] = useState<'profile' | 'types' | 'quiz'>('profile');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizResult, setQuizResult] = useState<string | null>(null);

  const handleSelectQuiz = (qId: number, type: string) => {
    const updated = { ...quizAnswers, [qId]: type };
    setQuizAnswers(updated);

    if (Object.keys(updated).length === QUIZ_QUESTIONS.length) {
      // 多数決でタイプ決定
      const counts: Record<string, number> = {};
      Object.values(updated).forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
      const topType = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      setQuizResult(topType);
    }
  };

  const resetQuiz = () => {
    setQuizAnswers({});
    setQuizResult(null);
  };

  return (
    <div className="rounded-3xl border border-stone-200/90 bg-white/95 p-5 shadow-xs space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <div>
            <h3 className="font-black text-sm text-stone-900 flex items-center gap-2">
              <span>プレイスタイル深層特性カルテ</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded-full">
                your.gg 実戦データ連動
              </span>
            </h3>
            <p className="text-[11px] text-stone-500 font-mono">
              {p.summonerName} | {p.tier} ({p.role} メイン)
            </p>
          </div>
        </div>

        {/* タブ切り替えボタン */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'profile' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            📈 現在のカルテ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('types')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'types' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            🧭 4大スタイル比較
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quiz')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'quiz' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            🎯 5問セルフ診断
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. 現在のカルテタブ */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="space-y-4 animate-in fade-in">
          {/* プレイスタイル総合評価バナー */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex items-start gap-3">
            <span className="text-2xl">🛡️</span>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-950">タイプ: ファームスケーリング＆セーフティ型</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded-md">
                  安定度 S
                </span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed font-medium">
                {p.diagnosisSummary}
              </p>
            </div>
          </div>

          {/* 5大指標レーダーバー */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 space-y-3">
            <div className="text-xs font-black text-stone-800 flex items-center justify-between">
              <span>📊 プレイスタイル 5大レーダー解析</span>
              <span className="text-[10px] text-stone-400 font-normal">your.gg 同ランク比較</span>
            </div>

            <div className="space-y-2.5">
              {/* 生存力 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-emerald-700 flex items-center gap-1">
                    <Shield size={12} /> 生存率・デス回避 (Survival)
                  </span>
                  <span className="text-stone-900 font-black">96点 <span className="text-[10px] text-emerald-600 font-normal">(上位4%)</span></span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '96%' }} />
                </div>
              </div>

              {/* ファーム効率 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-sky-700 flex items-center gap-1">
                    <Zap size={12} /> 15分CSリード (CSD@15)
                  </span>
                  <span className="text-stone-900 font-black">88点 <span className="text-[10px] text-sky-600 font-normal">(上位12% / +13.9CS)</span></span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: '88%' }} />
                </div>
              </div>

              {/* 序盤戦闘関与 (ボトルネック) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-rose-700 flex items-center gap-1">
                    <AlertTriangle size={12} /> 15分キル関与 (KP@15) <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-black">要改善</span>
                  </span>
                  <span className="text-rose-600 font-black">35点 <span className="text-[10px] font-normal">(下位3% / 35%関与)</span></span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: '35%' }} />
                </div>
              </div>

              {/* オブジェクト管理 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-amber-700 flex items-center gap-1">
                    <Target size={12} /> オブジェクト確保 (Obj Control)
                  </span>
                  <span className="text-stone-900 font-black">74点 <span className="text-[10px] text-amber-700 font-normal">(標準以上)</span></span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '74%' }} />
                </div>
              </div>

              {/* 集団戦ポジショニング */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-indigo-700 flex items-center gap-1">
                    <Crosshair size={12} /> 集団戦ポジショニング (Teamfight)
                  </span>
                  <span className="text-stone-900 font-black">82点 <span className="text-[10px] text-indigo-600 font-normal">(高KDA維持)</span></span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '82%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* ボトルネック深掘り ＆ 典型的負け筋の克服 */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-amber-950">
              <span className="p-1 rounded-md bg-amber-200 text-amber-900">⚠️</span>
              <span>勝率を跳ね上げる「ボトルネック解消」の急所</span>
            </div>
            <p className="text-xs text-stone-700 leading-relaxed font-medium">
              {p.coreBottleNeck}
            </p>
            <div className="rounded-xl border border-amber-400/60 bg-white p-3 space-y-1">
              <div className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-amber-600" />
                <span>今日のソロQで実践する具体的アクション:</span>
              </div>
              <p className="text-xs text-stone-800 font-bold leading-relaxed">
                {p.actionGuideline}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. 4大スタイル比較タブ */}
      {/* ========================================================================= */}
      {activeTab === 'types' && (
        <div className="space-y-3 animate-in fade-in">
          <p className="text-xs text-stone-500">
            ジャングラーの4つの基本プレイスタイルです。自分の強みを活かしつつ、敵構成や味方に合わせてスタイルを調整できます。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PLAY_STYLE_TYPES.map((t) => (
              <div
                key={t.id}
                className={`rounded-2xl border p-4 space-y-2 transition ${
                  t.id === 'farmer_scaler'
                    ? 'border-emerald-400 bg-emerald-50/40 shadow-xs'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{t.icon}</span>
                    <span className="font-black text-xs text-stone-900">{t.name}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      t.id === 'farmer_scaler'
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {t.badge}
                  </span>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed font-medium">{t.desc}</p>

                <div className="pt-1 space-y-1 text-[11px]">
                  <div className="text-emerald-700 font-bold">
                    <span className="text-stone-400">強み:</span> {t.pros}
                  </div>
                  <div className="text-rose-700 font-bold">
                    <span className="text-stone-400">弱み:</span> {t.cons}
                  </div>
                  <div className="text-stone-700 font-bold pt-0.5">
                    <span className="text-stone-400">相性◎:</span> {t.recommendedChamps.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. 5問セルフ診断テスト */}
      {/* ========================================================================= */}
      {activeTab === 'quiz' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-500">
              5つの実戦シチュエーションに答えて、直近の思考パターン・プレイスタイルを判定します。
            </p>
            {quizResult && (
              <button
                type="button"
                onClick={resetQuiz}
                className="text-xs font-bold text-amber-700 hover:text-amber-900"
              >
                🔄 やり直す
              </button>
            )}
          </div>

          {quizResult ? (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/70 p-5 space-y-3 animate-in zoom-in-95">
              <div className="text-center space-y-1">
                <span className="text-3xl">🎉</span>
                <h4 className="text-sm font-black text-stone-900">診断結果</h4>
                <div className="text-base font-black text-amber-900">
                  {PLAY_STYLE_TYPES.find((t) => t.id === quizResult)?.name}
                </div>
              </div>

              <div className="rounded-xl bg-white p-3.5 border border-amber-200 space-y-2 text-xs">
                <p className="text-stone-700 font-medium leading-relaxed">
                  {PLAY_STYLE_TYPES.find((t) => t.id === quizResult)?.desc}
                </p>
                <div className="border-t border-stone-100 pt-2 space-y-1 text-[11px]">
                  <div className="text-emerald-700 font-bold">
                    <span>強み: </span>{PLAY_STYLE_TYPES.find((t) => t.id === quizResult)?.pros}
                  </div>
                  <div className="text-rose-700 font-bold">
                    <span>注意点: </span>{PLAY_STYLE_TYPES.find((t) => t.id === quizResult)?.cons}
                  </div>
                  <div className="text-stone-800 font-bold">
                    <span>推奨チャンピオン: </span>
                    {PLAY_STYLE_TYPES.find((t) => t.id === quizResult)?.recommendedChamps.join(', ')}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {QUIZ_QUESTIONS.map((q, idx) => (
                <div key={q.id} className="rounded-2xl border border-stone-200 bg-stone-50/50 p-3.5 space-y-2">
                  <div className="text-xs font-bold text-stone-800 flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{q.question}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {q.options.map((opt, oIdx) => {
                      const isSelected = quizAnswers[q.id] === opt.type;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => handleSelectQuiz(q.id, opt.type)}
                          className={`p-2.5 rounded-xl text-left text-xs font-medium transition border cursor-pointer ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                              : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                          }`}
                        >
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
