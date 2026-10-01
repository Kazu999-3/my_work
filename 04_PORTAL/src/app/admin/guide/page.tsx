"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookOpen, Sparkles, Video, MessageSquare, Globe, ArrowRight,
  Database, RefreshCw, Activity, Cpu, CheckCircle2, Zap, Layers,
  Compass, ShieldCheck, ChevronRight, FileText, Swords, Gamepad2, Info
} from 'lucide-react';

export default function AdminGuidePage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pipeline' | 'dict' | 'coach' | 'ops'>('all');

  return (
    <div className="min-h-screen p-3 sm:p-6 max-w-6xl w-full mx-auto space-y-8 font-sans">
      {/* 🏛️ ページヘッダー */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface border border-border/90 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden"
      >
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-primary-100 border border-amber-300 text-primary-900 text-xs font-black">
                管理者専用マニュアル
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-subtle border border-border text-muted text-[11px] font-bold">
                Sovereign OS v2.6
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
              <span className="p-2 bg-primary-50 text-primary-600 border border-amber-200/80 rounded-2xl shadow-xs">
                🏛️
              </span>
              LoL データ収集・戦術辞典・AIコーチ連携 全貌仕様ガイド
            </h1>
            <p className="text-xs sm:text-sm text-muted max-w-3xl leading-relaxed font-medium">
              チャレンジャーの解説動画・Discord議論・Web攻略から知見を自動抽出し、
              チャンピオン辞典へ統合して、インゲームHUDやAIコーチとしてリアルタイムに手元へ還元する
              <strong className="text-primary-800 font-bold">「絶対勝利循環（The Sovereign Victory Loop）」</strong>の全貌を解説します。
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
            <Link
              href="/admin/knowledge"
              className="px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-stone-950 font-black text-xs transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <Sparkles size={14} />
              <span>📥 戦術取り込みを開く</span>
            </Link>
            <Link
              href="/champions"
              className="px-4 py-2 rounded-xl bg-surface-subtle hover:bg-surface-hover text-foreground-subtle font-bold text-xs transition-all border border-border flex items-center justify-center gap-2"
            >
              <BookOpen size={14} />
              <span>👑 チャンピオン辞典</span>
            </Link>
          </div>
        </div>

        {/* タブ切り替えバー */}
        <div className="flex items-center gap-2 pt-6 mt-6 border-t border-stone-100 overflow-x-auto">
          {[
            { id: 'all', label: '🌟 全体循環ループ' },
            { id: 'pipeline', label: '📥 3大データ収集パイプライン' },
            { id: 'dict', label: '👑 チャンピオン辞典 ＆ 承認' },
            { id: 'coach', label: '🎮 AIコーチ ＆ HUD連携' },
            { id: 'ops', label: '⚡ 日常運用 ＆ エラーリカバリ' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-stone-950 shadow-xs font-black'
                  : 'text-muted hover:text-foreground hover:bg-surface-subtle'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </motion.header>

      {/* 🔄 1. 全体循環モデル (The Sovereign Victory Loop) */}
      {(activeTab === 'all' || activeTab === 'pipeline') && (
        <section className="bg-surface border border-border/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
            <span className="p-2 bg-primary-50 text-primary-600 rounded-xl font-bold border border-amber-200/60">
              🔄
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                全体循環モデル：絶対勝利循環（The Sovereign Victory Loop）
              </h2>
              <p className="text-xs text-muted-strong font-medium">
                集めた知識が単なるアーカイブで終わらず、実際の試合で使える武器になるまでの5段階フロー
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
            {[
              {
                step: '01',
                title: '多角インプット',
                subtitle: 'YouTube / Discord / Web',
                desc: 'チャレンジャー動画、有識者のDiscord考察、パッチノートやWeb攻略記事を自動収集・キュー投入。',
                icon: '📥',
                color: 'bg-danger-50 border-rose-200 text-danger-900',
              },
              {
                step: '02',
                title: 'AI自動解析',
                subtitle: 'Whisper ＆ Gemini 2.5',
                desc: '音声文字起こし、実演シーン抽出、立ち回り・パワースパイク・没理由を構造化データとして抽出。',
                icon: '🧠',
                color: 'bg-primary-50 border-amber-200 text-primary-900',
              },
              {
                step: '03',
                title: '一括承認＆マージ',
                subtitle: '未承認ナレッジ ➔ 辞典',
                desc: '「⚡ 全件一括承認＆マージ」でSupabase DB（champion_facts）と戦術バイブルへ即座に統合。',
                icon: '✅',
                color: 'bg-success-50 border-emerald-200 text-success-900',
              },
              {
                step: '04',
                title: '実戦HUDアシスト',
                subtitle: 'Live Client Data (2999)',
                desc: 'LoLクライアントのリアルタイムデータと辞典を照合。対面パワースパイクやキルラインを画面に通知。',
                icon: '🎮',
                color: 'bg-primary-50 border-amber-200 text-primary-900',
              },
              {
                step: '05',
                title: '試合後自動反省',
                subtitle: '反省メモ ➔ 知見還元',
                desc: '敗因・デス原因を自己検証し、改善点を個人マイページおよびコミュニティナレッジへ還元。',
                icon: '📈',
                color: 'bg-secondary-50 border-teal-200 text-secondary-900',
              },
            ].map((node, i) => (
              <div
                key={node.step}
                className={`p-4 rounded-2xl border ${node.color} flex flex-col justify-between space-y-3 relative group hover:shadow-xs transition`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">{node.icon}</span>
                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-surface/80 border border-black/5">
                      STEP {node.step}
                    </span>
                  </div>
                  <h3 className="text-xs font-black">{node.title}</h3>
                  <p className="text-[10px] font-bold opacity-80 mb-2">{node.subtitle}</p>
                  <p className="text-[11px] leading-relaxed opacity-90">{node.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 📥 2. 3大データ収集パイプラインの詳細 */}
      {(activeTab === 'all' || activeTab === 'pipeline') && (
        <section className="bg-surface border border-border/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
            <span className="p-2 bg-danger-50 text-danger-600 rounded-xl font-bold border border-rose-200/60">
              📥
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                1. 3大データ収集パイプライン（取り込みハブの仕組み）
              </h2>
              <p className="text-xs text-muted-strong font-medium">
                プレイヤーが欲しい情報を手作業でまとめず、AIが自動で高密度な知識に精製する3つの収集ルート
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* ルートA: YouTube動画解析 */}
            <div className="p-5 rounded-2xl bg-background border border-border space-y-3">
              <div className="flex items-center gap-2 text-danger-600">
                <Video size={20} />
                <h3 className="text-sm font-black text-foreground">ルートA: YouTube動画解析</h3>
              </div>
              <p className="text-xs text-muted leading-relaxed font-medium">
                <strong>最も高密度な情報源。</strong> チャレンジャーやプロの実況解説動画から、立ち回り・ウェーブ管理・対面スキル回避タイミングを抽出します。
              </p>
              <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-2 text-[11px] text-muted">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span>⚙️</span> 内部パイプライン (`youtube_worker.py`):
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[10px] leading-relaxed text-muted-strong">
                  <li><strong>キュー投入</strong>: ポータルまたはDiscordからURLを登録</li>
                  <li><strong>Whisper音声認識</strong>: 高速文字起こしで全会話をテキスト化</li>
                  <li><strong>Gemini 2.5解析</strong>: チャンピオン判定、実演タイムスタンプ、立ち回りのコツを抽出</li>
                  <li><strong>ナレッジ化</strong>: 攻略記事を生成し「未承認知見」へ起票</li>
                </ol>
              </div>
              <div className="text-[10px] text-primary-800 bg-primary-50 p-2.5 rounded-xl border border-amber-200 font-medium">
                💡 <strong>ステータス管理</strong>: <code>pending</code> ➔ <code>downloading</code> ➔ <code>transcribing</code> ➔ <code>analyzing</code> ➔ <code>completed</code>
              </div>
            </div>

            {/* ルートB: Discord雑談・考察ログ抽出 */}
            <div className="p-5 rounded-2xl bg-background border border-border space-y-3">
              <div className="flex items-center gap-2 text-primary-600">
                <MessageSquare size={20} />
                <h3 className="text-sm font-black text-foreground">ルートB: Discord雑談・考察ログ抽出</h3>
              </div>
              <p className="text-xs text-muted leading-relaxed font-medium">
                <strong>コミュニティの生きた声。</strong> 定期カスタムや雑談チャンネルでの「このビルド試したら強かった」「この対面は無理」といった議論をAIが自動検知。
              </p>
              <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-2 text-[11px] text-muted">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span>⚙️</span> 内部パイプライン (`DiscordImportPanel`):
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[10px] leading-relaxed text-muted-strong">
                  <li><strong>チャンネル監視</strong>: <code>#lol-tactics</code> や雑談ログをスキャン</li>
                  <li><strong>知見判定</strong>: 単なる挨拶を除外し、攻略・マッチアップに関する発言のみを抽出</li>
                  <li><strong>没理由の保全</strong>: なぜダメだったのかの理由もセットで抽出</li>
                  <li><strong>未承認ナレッジ化</strong>: 承認待ちリストへ即時格納</li>
                </ol>
              </div>
              <div className="text-[10px] text-primary-800 bg-primary-50 p-2.5 rounded-xl border border-amber-200 font-medium">
                💡 <strong>利点</strong>: 身内のリアルなレベル帯（アイアン〜エメラルド）で本当に起きている課題が吸い上がります。
              </div>
            </div>

            {/* ルートC: Web記事・X (Twitter)・手動メモ */}
            <div className="p-5 rounded-2xl bg-background border border-border space-y-3">
              <div className="flex items-center gap-2 text-secondary-600">
                <Globe size={20} />
                <h3 className="text-sm font-black text-foreground">ルートC: Web / X / 手動メモ</h3>
              </div>
              <p className="text-xs text-muted leading-relaxed font-medium">
                <strong>速報性と即時メモ。</strong> パッチノート速報、X(Twitter)のチャレンジャーTips、自分の実戦メモをURLまたは自由文で瞬時に投入。
              </p>
              <div className="bg-surface p-3 rounded-xl border border-border/80 space-y-2 text-[11px] text-muted">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <span>⚙️</span> 内部パイプライン (`add/route.ts`):
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[10px] leading-relaxed text-muted-strong">
                  <li><strong>URLスクレイピング</strong>: Xポスト画像/本文やWeb記事を即時読込</li>
                  <li><strong>AIプレビュー</strong>: 要約結果をモーダルで即座に提示</li>
                  <li><strong>レーン一般論 vs 固有知見判定</strong>: 空欄ならレーンガイド、チャンピオン名があれば辞典へ自動分類</li>
                  <li><strong>ワンクリック保存</strong>: 修正・調整の上で即座に保存</li>
                </ol>
              </div>
              <div className="text-[10px] text-secondary-800 bg-secondary-50 p-2.5 rounded-xl border border-teal-200 font-medium">
                💡 <strong>利点</strong>: 「試合直後の気付き」を忘れないうちに30秒でインプット可能。
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 👑 3. チャンピオン辞典 ＆ 攻略ライブラリ */}
      {(activeTab === 'all' || activeTab === 'dict') && (
        <section className="bg-surface border border-border/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
            <span className="p-2 bg-primary-50 text-primary-600 rounded-xl font-bold border border-amber-200/60">
              👑
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                2. チャンピオン辞典 ＆ 攻略ライブラリ（知識の構造化とSSoT）
              </h2>
              <p className="text-xs text-muted-strong font-medium">
                「未承認知見」がどのようにチャンピオン辞典に組み込まれ、死蔵を防ぐか
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <span>📚</span> 2層構造の知識ストレージ（SSoT原則）
              </h3>
              <p className="text-xs text-muted leading-relaxed font-medium">
                本システムでは、知見を単なる1つのテキストファイルにせず、高速検索用の<strong>DB（Supabase）</strong>と、
                Git管理される<strong>Markdown戦術バイブル（原本）</strong>の2層で同期管理しています。
              </p>

              <div className="space-y-2.5">
                <div className="p-3.5 rounded-2xl bg-primary-50/60 border border-amber-200/80">
                  <div className="flex items-center gap-2 text-xs font-black text-primary-900">
                    <Database size={14} />
                    <span>層1: Supabase DB (`champion_facts`)</span>
                  </div>
                  <p className="text-[11px] text-primary-950 mt-1 leading-relaxed">
                    チャンピオン別・レーン別に細分化された構造化テーブル。Webポータルの辞典画面やインゲームHUDがミリ秒単位で高速逆引きするために使用。
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-primary-50/60 border border-amber-200/80">
                  <div className="flex items-center gap-2 text-xs font-black text-primary-900">
                    <FileText size={14} />
                    <span>層2: 戦術バイブル (`_tactics_bible.md`)</span>
                  </div>
                  <p className="text-[11px] text-primary-950 mt-1 leading-relaxed">
                    Gitリポジトリ内に保管される不変の戦術原典。AIが記事を執筆したり、対面マクロを総合判断するための深い文脈（コンテキスト）として保持。
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <span>⚡</span> 承認待ちの高速消化（一括承認＆マージ）
              </h3>
              <p className="text-xs text-muted leading-relaxed font-medium">
                以前は「知見が1件ずつ溜まり、承認が追いつかない」という問題がありました。
                現在は以下の高速化ツールが配備されています：
              </p>

              <div className="bg-background border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-foreground-soft border-b border-border pb-2">
                  <span>機能</span>
                  <span>効果</span>
                </div>
                <div className="flex items-start justify-between gap-3 text-xs">
                  <span className="font-bold text-success-700 shrink-0">☑️ 全選択チェック</span>
                  <span className="text-muted text-[11px]">ページ内の未承認知見をワンクリックで一括選択</span>
                </div>
                <div className="flex items-start justify-between gap-3 text-xs">
                  <span className="font-bold text-primary-700 shrink-0">⚡ 全件一括承認＆マージ</span>
                  <span className="text-muted text-[11px]">全知見を承認すると同時に、即座に該当チャンピオンの辞典へマージ反映</span>
                </div>
                <div className="flex items-start justify-between gap-3 text-xs">
                  <span className="font-bold text-secondary-700 shrink-0">🏷️ レーン一般論の自動仕分け</span>
                  <span className="text-muted text-[11px]">チャンピオン固有でない知見は自動でレーン・マクロ攻略へ振り分け</span>
                </div>
              </div>

              <div className="p-3 bg-success-50 border border-emerald-200 rounded-xl text-[11px] text-success-900 font-medium">
                ✅ <strong>運用のコツ</strong>: 週に1回「未承認知見」タブを開き、タイトルに明らかな誤りが無ければ「⚡ 全件一括承認＆マージ」を押すだけで最新データが手に入ります。
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 🎮 4. AIコーチ ＆ リアルタイムHUDオーバーレイ連携 */}
      {(activeTab === 'all' || activeTab === 'coach') && (
        <section className="bg-surface border border-border/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
            <span className="p-2 bg-primary-50 text-primary-600 rounded-xl font-bold border border-amber-200/60">
              🎮
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                3. AIコーチ ＆ リアルタイムHUDオーバーレイ連携
              </h2>
              <p className="text-xs text-muted-strong font-medium">
                蓄積された辞典データが、いかにして実際のゲームプレイ中にプレイヤーを支援するか
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-background border border-border space-y-3">
              <div className="flex items-center gap-2 text-primary-600 font-black text-xs">
                <Gamepad2 size={18} />
                <span>① Live Client Data API 連携</span>
              </div>
              <p className="text-xs text-muted leading-relaxed font-medium">
                LoLが起動すると、クライアント自身がローカル（<code>127.0.0.1:2999/liveclientdata</code>）にゲーム内情報を出力します。
                AIコーチはこのAPIと秒単位で通信し、現在の所持アイテム・キルデス・対面チャンピオンを検知します。
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-background border border-border space-y-3">
              <div className="flex items-center gap-2 text-danger-600 font-black text-xs">
                <Swords size={18} />
                <span>② キルライン ＆ パワースパイク警告</span>
              </div>
              <p className="text-xs text-muted leading-relaxed font-medium">
                チャンピオン辞典にある「Lv2先行時の即死コンボ」「相手の1コア完成タイミング」と現在のゲーム状況を照合。
                危険なタイミングやトレード勝機の境界線（キルライン）をリアルタイムに画面や音声で警告します。
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-background border border-border space-y-3">
              <div className="flex items-center gap-2 text-primary-600 font-black text-xs">
                <RefreshCw size={18} />
                <span>③ 試合後レビュー ＆ ナレッジ還元</span>
              </div>
              <p className="text-xs text-muted leading-relaxed font-medium">
                試合が終わると、デスした瞬間のタイムスタンプと相手のスキル状況を自動突合。
                「なぜ死んだのか」「どのパワースパイクを見落としたか」を自動で自己反省メモとして生成し、マイページやナレッジへ還元します。
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ⚡ 5. 日常運用 ＆ エラーリカバリ */}
      {(activeTab === 'all' || activeTab === 'ops') && (
        <section className="bg-surface border border-border/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
            <span className="p-2 bg-success-50 text-success-600 rounded-xl font-bold border border-emerald-200/60">
              ⚡
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                4. 管理者日常オペレーション ＆ エラーリカバリ
              </h2>
              <p className="text-xs text-muted-strong font-medium">
                ポータルを健全に保つための最低限のチェック項目と、問題発生時の対処法
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-background border border-border space-y-3">
              <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                <span>📋</span> 日常の3ステップ・ルーティン
              </h3>
              <ol className="list-decimal pl-4 space-y-2 text-xs text-muted font-medium leading-relaxed">
                <li>
                  <strong>システム運用ダッシュボード確認</strong>:
                  <br />
                  <Link href="/admin/dashboard" className="text-primary-700 underline font-bold">ダッシュボード</Link> で「ALL GREEN」になっているか、要対応タスクが無いかを見る。
                </li>
                <li>
                  <strong>承認待ちナレッジの処理</strong>:
                  <br />
                  <Link href="/admin/knowledge?tab=pending" className="text-primary-700 underline font-bold">戦術取り込み ＞ 承認待ち</Link> で「⚡ 全件一括承認＆マージ」を実行。
                </li>
                <li>
                  <strong>辞典ヘルスチェック</strong>:
                  <br />
                  <Link href="/champions?scope=health" className="text-primary-700 underline font-bold">辞典ヘルス</Link> でパッチ更新に伴う鮮度低下や重複知見が無いかを確認。
                </li>
              </ol>
            </div>

            <div className="p-5 rounded-2xl bg-background border border-border space-y-3">
              <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                <span>🛠️</span> よくあるエラーと対処法
              </h3>
              <div className="space-y-2 text-xs text-muted font-medium">
                <div className="p-2.5 rounded-xl bg-surface border border-border/80">
                  <div className="font-bold text-foreground text-[11px] mb-0.5">⚠️ エッジワーカー未起動</div>
                  <p className="text-[10px] text-muted-strong">
                    YouTube動画のWhisper解析などPCリソースが必要な処理のみワーカーが必要です。ダッシュボード上部の「ワーカー起動」またはコマンド実行で起動します。
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-surface border border-border/80">
                  <div className="font-bold text-foreground text-[11px] mb-0.5">⚠️ Gemini API 429 (混雑エラー)</div>
                  <p className="text-[10px] text-muted-strong">
                    Google APIの一時的な流量制限です。ワーカーが自動で待機・指数バックオフ再試行を行うため、通常は放置で自動解決します。
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-surface border border-border/80">
                  <div className="font-bold text-foreground text-[11px] mb-0.5">⚠️ 動画キューがエラーで止まる</div>
                  <p className="text-[10px] text-muted-strong">
                    「動画解析キュー」タブの「エラー動画を一括再試行」ボタンを押すことで、pending状態に戻して再実行できます。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 🧭 クイックナビゲーション */}
      <footer className="bg-stone-900 text-stone-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-4">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>🧭</span> 管理者クイックナビゲーション
            </h3>
            <p className="text-xs text-faint font-medium mt-0.5">
              各機能へワンクリックでアクセスできます
            </p>
          </div>
          <span className="text-[11px] text-muted-strong font-mono">
            Sovereign OS Operations
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <Link
            href="/admin/knowledge"
            className="p-3 rounded-xl bg-stone-800/80 hover:bg-stone-800 border border-stone-700 text-xs font-bold text-stone-200 hover:text-white transition flex items-center justify-between group"
          >
            <span>📥 戦術取り込み</span>
            <ChevronRight size={13} className="text-muted-strong group-hover:text-primary-400 group-hover:translate-x-0.5 transition" />
          </Link>

          <Link
            href="/champions"
            className="p-3 rounded-xl bg-stone-800/80 hover:bg-stone-800 border border-stone-700 text-xs font-bold text-stone-200 hover:text-white transition flex items-center justify-between group"
          >
            <span>👑 チャンピオン辞典</span>
            <ChevronRight size={13} className="text-muted-strong group-hover:text-primary-400 group-hover:translate-x-0.5 transition" />
          </Link>

          <Link
            href="/champions?scope=health"
            className="p-3 rounded-xl bg-stone-800/80 hover:bg-stone-800 border border-stone-700 text-xs font-bold text-stone-200 hover:text-white transition flex items-center justify-between group"
          >
            <span>🩺 辞典ヘルス</span>
            <ChevronRight size={13} className="text-muted-strong group-hover:text-primary-400 group-hover:translate-x-0.5 transition" />
          </Link>

          <Link
            href="/admin/dashboard"
            className="p-3 rounded-xl bg-stone-800/80 hover:bg-stone-800 border border-stone-700 text-xs font-bold text-stone-200 hover:text-white transition flex items-center justify-between group"
          >
            <span>📊 運用ダッシュボード</span>
            <ChevronRight size={13} className="text-muted-strong group-hover:text-primary-400 group-hover:translate-x-0.5 transition" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
