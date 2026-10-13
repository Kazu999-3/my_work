"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  ExternalLink,
  MessageSquare,
  Sliders,
  ShieldCheck,
  Gamepad2,
  Trophy,
  Coins,
  Copy,
  Check,
  Clock,
  HeartHandshake
} from 'lucide-react';

const INTRO_TEMPLATE = `【LoL ID】サモナー名#JP1
【最高ランク】シルバー1（未設定なら未記載でOK）
【得意レーン】MID、TOP（2つ程度）
【NGレーン】JG（あれば）
【ひとこと】よろしくお願いします！`;

export default function GuideQuickStartTab({ onSelectTab }: { onSelectTab?: (tab: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(INTRO_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* イントロバナー */}
      <div className="bg-gradient-to-r from-primary-500/15 via-primary-500/10 to-primary-500/15 border border-primary-edge-strong/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/20 text-primary-900 text-xs font-black border border-primary-edge-strong/30">
              <Sparkles size={14} className="text-primary-600 animate-pulse" />
              初回1分！今すぐ遊べる3ステップ
            </div>
            <h2 className="text-xl md:text-2xl font-black text-foreground">
              誰でもすぐ参加できる！KTMカスタム入門
            </h2>
            <p className="text-foreground-subtle text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
              Discordの「#📝自己紹介」にテンプレを貼るだけで名簿・希望レーン登録が自動完了！カスタム試合はDiscordだけでも全機能参加できます。ポータルは通算戦績分析や勝敗予想カジノを楽しみたいときの便利マイページです。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/mypage"
              className="px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-black text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              マイページで確認する <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* 3ステップ カード一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Step 1 */}
        <div className="bg-surface rounded-3xl p-6 border-2 border-primary-edge-soft/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-primary-edge transition-all group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-edge-soft flex items-center justify-center text-primary-600 font-bold text-2xl group-hover:scale-105 transition">
                📝
              </div>
              <span className="text-xs font-black text-primary-800 bg-primary-100 px-3 py-1 rounded-full border border-primary-edge-soft">
                STEP 1
              </span>
            </div>
            <h3 className="text-base font-black text-foreground">LoL ID（自己紹介）登録</h3>
            <p className="text-muted text-xs leading-relaxed">
              Discordの <strong className="text-foreground font-bold">「#📝自己紹介」</strong> にテンプレを貼るだけで、Botが自動でID・ランク・希望レーン・NGレーンを全自動登録！
            </p>
            
            {/* 自己紹介テンプレ・ワンタップコピーボックス */}
            <div className="bg-background border border-primary-edge-strong/30 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-primary-950 flex items-center gap-1">
                  <span>📋</span> 自己紹介テンプレ
                </span>
                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  className="px-2.5 py-1 rounded-lg bg-primary-500 hover:bg-primary-600 text-stone-950 text-[10px] font-black transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  {copied ? <Check size={12} className="text-success-800" /> : <Copy size={12} />}
                  <span>{copied ? 'コピー完了！' : 'ワンタップコピー'}</span>
                </button>
              </div>
              <pre className="text-[10px] text-muted-strong font-mono bg-surface-subtle p-2 rounded-xl overflow-x-auto whitespace-pre-wrap leading-tight select-all">
                {INTRO_TEMPLATE}
              </pre>
            </div>

            <div className="bg-background border border-border/80 rounded-xl p-2.5 text-[11px] text-muted space-y-0.5">
              <div className="font-bold text-foreground-soft flex items-center gap-1 text-[10px]">
                <CheckCircle2 size={12} className="text-success-600" />
                登録完了のメリット
              </div>
              <p>・過去ランク自動取得＆初期MMR算出</p>
              <p>・初期 <strong className="text-primary-700 font-bold">1,000コイン</strong> の自動付与</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-subtle">
            <Link
              href="/mypage"
              className="text-xs font-black text-primary-700 hover:text-primary-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              登録状況をマイページで見る <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-surface rounded-3xl p-6 border-2 border-primary-edge-soft/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-primary-edge transition-all group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-edge-soft flex items-center justify-center text-primary-600 font-bold text-2xl group-hover:scale-105 transition">
                🎯
              </div>
              <span className="text-xs font-black text-primary-800 bg-primary-100 px-3 py-1 rounded-full border border-primary-edge-soft">
                STEP 2
              </span>
            </div>
            <h3 className="text-base font-black text-foreground">希望・NGレーンの確認</h3>
            <p className="text-muted text-xs leading-relaxed">
              あなたの得意レーンと行きたくないレーン（NG）を設定。チーム分けAIがあなたの希望を最優先で考慮します。
            </p>
            <div className="bg-background border border-border/80 rounded-2xl p-3 text-[11px] text-muted space-y-1.5">
              <div className="font-bold text-foreground-soft flex items-center gap-1">
                <Sliders size={13} className="text-primary-600" />
                設定の3大要素
              </div>
              <p>・<strong className="text-foreground-soft">メイン</strong>: 最優先で配属（Pity消費）</p>
              <p>・<strong className="text-foreground-soft">サブ</strong>: 2番目に得意なレーン</p>
              <p>・<strong className="text-foreground-soft">NGレーン</strong>: <span className="text-danger-600 font-bold">絶対に避けたい位置を最大2つ除外</span></p>
            </div>
            <p className="text-[11px] text-muted-strong leading-relaxed">
              ※後から変更したいときは、Discordで <code className="bg-surface-subtle text-primary-900 px-1 py-0.5 rounded font-mono font-bold">/lane</code> と打つか、マイページからいつでも変更できます。
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-subtle">
            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('bot')}
              className="text-xs font-black text-primary-700 hover:text-primary-900 flex items-center gap-1 group-hover:translate-x-1 transition cursor-pointer"
            >
              /lane コマンドの詳細を見る <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-surface rounded-3xl p-6 border-2 border-primary-edge-soft/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-primary-edge transition-all group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-success-50 border border-success-edge-soft flex items-center justify-center text-success-600 font-bold text-2xl group-hover:scale-105 transition">
                ⚔️
              </div>
              <span className="text-xs font-black text-success-800 bg-success-100 px-3 py-1 rounded-full border border-success-edge-soft">
                STEP 3
              </span>
            </div>
            <h3 className="text-base font-black text-foreground">Discord募集にワンタップ参加！</h3>
            <p className="text-muted text-xs leading-relaxed">
              Discordの募集チャンネルにパネルが出たら、お好みの参加ボタンを押すだけ！10人集まると自動で公平チーム分けが始まります。
            </p>
            <div className="bg-background border border-border/80 rounded-2xl p-3 text-[11px] text-muted space-y-1">
              <div className="font-bold text-foreground-soft flex items-center gap-1">
                <Gamepad2 size={13} className="text-success-600" />
                ゲーム中の流れ
              </div>
              <p>1. チーム分け結果がDiscordに届く</p>
              <p>2. ポータルで勝敗予想ベットで盛り上がる🎲</p>
              <p>3. 試合終了後に勝敗が自動反映！</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-subtle">
            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('bot')}
              className="text-xs font-black text-success-700 hover:text-success-900 flex items-center gap-1 group-hover:translate-x-1 transition cursor-pointer"
            >
              募集ボタンの全機能を見る <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 🔰 初心者必見！募集ボタン「どれ押せばいいの？早見表」 */}
      <div className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-surface-subtle pb-4">
          <div className="w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-700 flex items-center justify-center font-bold">
            <HeartHandshake size={20} />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-black text-foreground">
              🔰 迷ったらコレ！募集ボタン「どれ押せばいいの？早見表」
            </h3>
            <p className="text-xs text-muted-strong">
              仕事やプライベートの予定に合わせて自由に選べます。途中抜け・1試合だけでも大歓迎です！
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-success-50/50 border border-success-edge-soft space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-success-600 text-white text-xs font-black">
                🟢 フル参加
              </span>
              <span className="text-[10px] font-bold text-success-800 bg-success-100 px-2 py-0.5 rounded-full">
                一番人気！
              </span>
            </div>
            <p className="text-xs font-black text-foreground">21:00〜最終戦まで</p>
            <p className="text-[11px] text-muted leading-relaxed">
              最初から最後までたっぷり遊びたい標準スタイル。<strong>迷ったらこれを押せば間違いなし！</strong>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-primary-50/50 border border-primary-edge-soft space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-primary-500 text-stone-950 text-xs font-black">
                ⏱️ 1戦のみ
              </span>
              <span className="text-[10px] font-bold text-primary-900 bg-primary-100 px-2 py-0.5 rounded-full">
                お試し推奨
              </span>
            </div>
            <p className="text-xs font-black text-foreground">21:00〜第1試合だけ</p>
            <p className="text-[11px] text-muted leading-relaxed">
              「明日朝早いから1試合だけ」「初参加でまず雰囲気を知りたい」という方向け。1試合終了後に自動交代！
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-primary-50/50 border border-primary-edge-soft space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-primary-500 text-stone-950 text-xs font-black">
                🌙 2戦目〜
              </span>
              <span className="text-[10px] font-bold text-primary-900 bg-primary-100 px-2 py-0.5 rounded-full">
                遅刻合流OK
              </span>
            </div>
            <p className="text-xs font-black text-foreground">21:50頃〜合流</p>
            <p className="text-[11px] text-muted leading-relaxed">
              「仕事やご飯で21時は間に合わないけど2戦目なら出られる！」という方向け。2戦目開始時にスムーズに合流！
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-subtle border border-border/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-stone-700 text-white text-xs font-black">
                👀 見学・応援
              </span>
              <span className="text-[10px] font-bold text-muted bg-background px-2 py-0.5 rounded-full">
                VC聞き専OK
              </span>
            </div>
            <p className="text-xs font-black text-foreground">観戦・勝敗予想</p>
            <p className="text-[11px] text-muted leading-relaxed">
              「今日はプレイせず配信やVCでみんなを応援したい」「勝敗予想カジノでコインを賭けたい」方向け。
            </p>
          </div>
        </div>
      </div>

      {/* カスタム参加のルール＆よくある質問 */}
      <div className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs space-y-6">
        <h3 className="text-lg font-black text-foreground flex items-center gap-2">
          <ShieldCheck className="text-primary-600" size={20} />
          カスタム参加にあたっての安心ガイド ＆ FAQ
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-1.5">
            <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
              <span>🌐</span> ポータル（Webサイト）にログインしなくてもカスタムに参加できますか？
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              はい、参加できます！Discordの「#📝自己紹介」で投稿していれば、募集ボタンを押すだけで自動的にチーム分けに組み込まれます。ポータルは自分の詳細な戦績分析や、勝敗予想カジノ・ショップを楽しみたい方向けのお楽しみ便利ツールです。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-1.5">
            <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
              <span>💡</span> 1戦だけのスポット参加や途中抜けはできますか？
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              大歓迎です！「1戦だけプレイしたい」「時間が合えば途中まで」という場合でも気軽に参加ボタン（⏱️ 1戦のみ）を押してください。交代や途中抜けも自由に行えます。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-1.5">
            <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
              <span>❓</span> 初心者やランクの低い人でも楽しめますか？
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              はい！チーム分けAIが「実力五分五分」に自動調整し、2ランク差対面（エメラルド対シルバー等）はシステム的に完全禁止されています。また20名以上の場合は上位部屋と初中級部屋の2部屋同時開催で全員が出場できます。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-1.5">
            <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
              <span>⏰</span> 開催判断は何時に行われますか？
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              当日20:00の時点で参加希望が10名未満の場合は開催中止（ワンクリックでノーマルやARAMの代替募集へ切り替え）となります。また8〜9名集まっている場合は「助っ人急募通知」が自動投稿されます。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-1.5">
            <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
              <span>🪙</span> コインはどうやって増やすのですか？
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              ポータルで毎日引ける「デイリーおみくじ（平均+165コイン/日）」のほか、カスタム参加で +100コイン、勝利で +150コイン（激闘チケット適用時は+600コイン！）が手に入ります。貯めたコインは勝敗予想ベットやスクラッチくじで使えます！
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-1.5">
            <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
              <span>🎪</span> 日曜日のお祭りカスタムは戦績に影響しますか？
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              日曜日のカスタムは「お祭りカスタム（完全戦績保護）」となっており、公式勝率・MMR変動が一切ノーカウントになります。普段使わないチャンピオンの練習やオフメタ構成も安心してワイワイ楽しめます！
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

