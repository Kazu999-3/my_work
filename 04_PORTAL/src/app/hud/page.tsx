'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Monitor, Smartphone, Swords, Shield, Zap, Sparkles, Copy, Check, Terminal, ExternalLink } from 'lucide-react';
import MatchupBlueprintCard from '../coach/MatchupBlueprintCard';
import ChampionQuickSelector from '../../components/coach/ChampionQuickSelector';

function HudHubContent() {
  const searchParams = useSearchParams();
  const initialEnemy = searchParams.get('enemy') || searchParams.get('champ') || 'Zed';
  const initialMode = searchParams.get('mode') === 'companion' ? 'companion' : 'overlay';

  const [mode, setMode] = useState<'overlay' | 'companion'>(initialMode);
  const [myChamp, setMyChamp] = useState<string>('Aatrox');
  const [enemyChamp, setEnemyChamp] = useState<string>(initialEnemy);
  const [copied, setCopied] = useState(false);

  const runCommand = 'python 03_SYSTEMS/v2_CORE/_LOL/overlay/run_overlay.py';

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(runCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 p-3 sm:p-5 flex flex-col gap-4 font-sans">
      {/* 最上部バー */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-800 pb-3">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs border border-stone-700 transition"
          >
            ← ポータル
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 font-black text-sm sm:text-base">🖥️ Sovereign HUD Hub</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-extrabold">
              実戦支援統合
            </span>
          </div>
        </div>

        {/* モード切替 */}
        <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs">
          <button
            type="button"
            onClick={() => setMode('overlay')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
              mode === 'overlay'
                ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ゲーム内オーバーレイ</span>
            <span className="sm:hidden">オーバーレイ</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('companion')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
              mode === 'companion'
                ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">サブモニタ・小窓カンペ</span>
            <span className="sm:hidden">小窓カンペ</span>
          </button>
        </div>
      </div>

      {/* モード1: ゲーム内オーバーレイ (PyQt6) 統合ガイド */}
      {mode === 'overlay' && (
        <div className="space-y-4 max-w-4xl mx-auto w-full animate-in">
          {/* メインヒーローカード */}
          <div className="bg-gradient-to-br from-stone-800 to-stone-850 border border-amber-500/40 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-700/80 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span className="text-xl">⚔️</span>
                  <span>Sovereign HUD (Python ゲーム内オーバーレイ)</span>
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  LoLのゲーム画面上に直接半透明描画される、公式Live Client API完全連動型リアルタイムHUDです。
                </p>
              </div>

              {/* 起動コマンドコピーボタン */}
              <button
                type="button"
                onClick={handleCopyCommand}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs shadow-md transition shrink-0 cursor-pointer"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? '起動コマンドをコピー済！' : '起動コマンドをコピー'}</span>
              </button>
            </div>

            {/* コマンド実行ボックス */}
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 flex items-center justify-between gap-3 font-mono text-xs">
              <div className="flex items-center gap-2 overflow-x-auto text-amber-300">
                <Terminal className="h-4 w-4 text-stone-500 shrink-0" />
                <code>{runCommand}</code>
              </div>
              <span className="text-[10px] text-stone-500 shrink-0 hidden sm:inline">PowerShell / CMD で実行</span>
            </div>

            {/* 5大機能一覧グリッド */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              <div className="bg-stone-900/80 border border-stone-700/60 rounded-xl p-3 space-y-1.5">
                <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                  <span>🩸</span>
                  <span>即死キルライン警告 (TAB連動)</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  敵のLv6フルコンボで自分が死ぬ致死HPラインを赤枠でメーター表示。危険域で自動警告。
                </p>
              </div>

              <div className="bg-stone-900/80 border border-stone-700/60 rounded-xl p-3 space-y-1.5">
                <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                  <span>🗺️</span>
                  <span>Lv1〜3 勝利手順書 (TAB連動)</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  レーン戦開始直後、Lv1〜3で取るべき具体的なトレード・プッシュ・ウェーブ管理手順を表示。
                </p>
              </div>

              <div className="bg-stone-900/80 border border-stone-700/60 rounded-xl p-3 space-y-1.5">
                <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                  <span>⏱️</span>
                  <span>敵5人スペルタイマー (常時表示)</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  テンキー1〜5、またはチャット「Flash」検知で自動カウントダウン始動。
                </p>
              </div>

              <div className="bg-stone-900/80 border border-stone-700/60 rounded-xl p-3 space-y-1.5">
                <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                  <span>👑</span>
                  <span>動的ビルド推薦</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  相手チームの育ち具合（AD/AP/脅威）をリアルタイム判定し、最適な防具靴・重傷を提案。
                </p>
              </div>

              <div className="bg-stone-900/80 border border-stone-700/60 rounded-xl p-3 space-y-1.5">
                <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                  <span>🧭</span>
                  <span>劣勢時逆転コンパス</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  ゴールド差-3,000G以上の劣勢時にのみ自動出現し、逆転の勝ち筋（オブジェクト誘導等）を提示。
                </p>
              </div>

              <div className="bg-stone-900/80 border border-stone-700/60 rounded-xl p-3 space-y-1.5">
                <div className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                  <span>🔄</span>
                  <span>試合後自動データ同期</span>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  試合終了時に非同期スレッドでWebポータルへスタッツを送信し、1分振り返りを自動準備。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* モード2: サブモニタ / 小窓用 対面カンペ (Matchup Companion) */}
      {mode === 'companion' && (
        <div className="space-y-4 max-w-4xl mx-auto w-full animate-in">
          <div className="bg-stone-850 border border-stone-700 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
            <span className="text-xs font-bold text-stone-300">⚔️ 自チャンプ ＆ 敵対面チャンプ クイック切替:</span>
            <ChampionQuickSelector
              myChampion={myChamp}
              enemyChampion={enemyChamp}
              onMyChampionChange={(c) => setMyChamp(c)}
              onEnemyChampionChange={(c) => setEnemyChamp(c)}
            />
          </div>

          {/* 対面手順書カード（実戦用極太表示） */}
          <div className="bg-stone-950 p-2 sm:p-4 rounded-2xl border border-stone-800 shadow-2xl">
            <MatchupBlueprintCard
              myChampion={myChamp}
              enemyChampion={enemyChamp}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function HudPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-900 flex items-center justify-center text-amber-400 font-bold">HUD Hub 読み込み中...</div>}>
      <HudHubContent />
    </Suspense>
  );
}
