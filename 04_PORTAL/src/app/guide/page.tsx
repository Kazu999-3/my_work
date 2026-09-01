"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Compass, 
  UserCheck, 
  MapPin, 
  Trophy, 
  Swords, 
  HelpCircle, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Search, 
  Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GuidePage() {
  const router = useRouter();
  const [searchName, setSearchName] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchName.trim()) {
      router.push(`/player/${encodeURIComponent(searchName.trim())}`);
    }
  };

  return (
    <div className="min-h-screen pb-16 bg-[#eae4d4] text-[#201c2b]">
      {/* ヒーローセクション */}
      <div className="bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 text-stone-100 py-12 px-6 relative overflow-hidden border-b border-black/10">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#c2650f_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black tracking-wider border border-amber-500/30">
            <Sparkles size={14} />
            KTM LoL 1分スタートガイド
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            1分でわかる！KTMカスタム参加手順
          </h1>
          <p className="text-stone-300 text-xs md:text-sm max-w-xl mx-auto font-medium">
            3ステップ登録で即参戦！公平なチーム分けで熱いカスタムを楽しもう🔥
          </p>

          {/* クイックマイページ検索 */}
          <form onSubmit={handleSearch} className="mt-6 max-w-md mx-auto flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
              <input
                type="text"
                placeholder="サモナー名でマイページを即検索..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full bg-stone-950/80 border border-stone-700 text-white rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
              />
            </div>
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              検索 <ArrowRight size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-[1400px] w-full mx-auto px-4 md:px-8 py-8 space-y-8">
        
        {/* 🌟 3ステップ初期登録 */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">⚡</span>
            <div>
              <h2 className="text-lg md:text-xl font-black text-stone-900">
                1分で完了！今すぐ遊べる3ステップ
              </h2>
              <p className="text-xs text-stone-500">登録しておけば、募集が出た時にワンタップで参加できます！</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="bg-white rounded-3xl p-6 border-2 border-amber-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between hover:border-amber-400 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-2xl">
                    📝
                  </div>
                  <span className="text-xs font-black text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded-full">STEP 1</span>
                </div>
                <h3 className="text-base font-black text-stone-900 mb-2">サモナー名 (Riot ID) 登録</h3>
                <p className="text-stone-600 text-xs leading-relaxed mb-4">
                  Discordの「📝 サモナー名登録」ボタンを押して、あなたのLoL ID（<code className="bg-stone-100 px-1 py-0.5 rounded text-amber-800 font-mono text-[10px]">名前#JP1</code>）を入力するだけ！
                </p>
              </div>
              <div className="pt-3 border-t border-stone-100 flex items-center gap-1.5 text-xs text-emerald-700 font-black">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                最高ランク・戦績を全自動同期
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-3xl p-6 border-2 border-indigo-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between hover:border-indigo-400 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold text-2xl">
                    📍
                  </div>
                  <span className="text-xs font-black text-indigo-700 bg-indigo-100/70 px-2.5 py-1 rounded-full">STEP 2</span>
                </div>
                <h3 className="text-base font-black text-stone-900 mb-2">希望レーン ＆ NGレーン設定</h3>
                <p className="text-stone-600 text-xs leading-relaxed mb-4">
                  「📍 希望レーン設定」で得意ロールや絶対やりたくないNGレーンをポチッと選ぶだけ！
                </p>
              </div>
              <div className="pt-3 border-t border-stone-100 flex items-center gap-1.5 text-xs text-indigo-700 font-black">
                <CheckCircle2 size={15} className="text-indigo-600 shrink-0" />
                NGレーンには絶対に配置されません
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-3xl p-6 border-2 border-emerald-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between hover:border-emerald-400 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold text-2xl">
                    ⚔️
                  </div>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-full">STEP 3</span>
                </div>
                <h3 className="text-base font-black text-stone-900 mb-2">募集に参加 ＆ コインGET！</h3>
                <p className="text-stone-600 text-xs leading-relaxed mb-4">
                  募集通知の「✋ 参加する」を押すだけ！試合や勝敗予想でコインを稼ぎ、特権アイテムと交換しよう🔥
                </p>
              </div>
              <div className="pt-3 border-t border-stone-100 flex items-center gap-1.5 text-xs text-emerald-700 font-black">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                初心者から上級者まで完全公平マッチ
              </div>
            </div>
          </div>
        </section>

        {/* 🎯 勝敗予想 ＆ KTMショップの遊び方 */}
        <section className="bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950 text-white rounded-3xl p-6 md:p-8 border border-amber-500/30 shadow-xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-amber-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-2xl">
                🪙
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white">
                  勝敗予想 ＆ KTMショップで遊ぶ！
                </h2>
                <p className="text-stone-300 text-xs md:text-sm">
                  観戦者も参加者も全員が熱狂できるKTM独自のコイン＆特権システム
                </p>
              </div>
            </div>
            <Link
              href="/casino"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              勝敗予想画面へ行く <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-stone-900/80 border border-amber-500/20 space-y-2">
              <div className="text-lg">🎯 1. 勝敗を予想</div>
              <p className="text-stone-300 leading-relaxed text-[11px]">
                カスタムの試合が決まったら、BLUEかREDの勝つと思う方にコインをベット！
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-stone-900/80 border border-amber-500/20 space-y-2">
              <div className="text-lg">💰 2. コインを倍増</div>
              <p className="text-stone-300 leading-relaxed text-[11px]">
                予想が当たればオッズに応じてコインが手元にザクザク戻ってきます！
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-stone-900/80 border border-amber-500/20 space-y-2">
              <div className="text-lg">🛒 3. 特権アイテムと交換</div>
              <p className="text-stone-300 leading-relaxed text-[11px]">
                「第一希望ロール確約チケット」や「賞金首ターゲット権」と交換して次回カスタムを有利に！
              </p>
            </div>
          </div>
        </section>

        {/* ⚖️ KTM Balancerの仕組み */}
        <section className="bg-white rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-stone-100 border border-black/10 flex items-center justify-center text-stone-800 font-black">
              2
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-stone-900">
                公平なチーム分けの仕組み (KTM Balancer)
              </h2>
              <p className="text-stone-600 text-xs md:text-sm">
                単純なランダムではなく、全員が楽しめるよう細かく計算されています。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-black/5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0 text-sm">
                  MMR
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">ロール別MMR（内部レート）</h4>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    TOP/JG/MID/ADC/SUP ごとに独立した実力レートを持ちます。対面相手との実力差が最小限になるよう自動調整されます。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-black/5">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center font-bold shrink-0 text-sm">
                  Pity
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">不運度 (Pity) 救済システム</h4>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    サブレーンに回されたり、見学者（待機枠）になった回数を自動記録。次回は優先的にメインレーンや試合メンバーに選出されます。
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-black/5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold shrink-0 text-sm">
                  NG
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">NGレーン厳守</h4>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    「このレーンだけは絶対やりたくない」というNGレーン（最大2つ）には絶対に配置されないよう強固なペナルティガードが働きます。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-black/5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 text-sm">
                  Boost
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">プレースメント期間（新メンバー歓迎）</h4>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    初めの10試合はMMR変動量が2〜3倍にブーストされ、あなたの本当の実力レートへ素早く収束します。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ⚡ 爆速募集コマンド (/recruit) の使い方 */}
        <section className="bg-gradient-to-br from-stone-900 to-stone-850 text-white rounded-3xl p-6 md:p-8 border border-stone-700 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-black">
              ⚡
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white">
                Discord 爆速募集コマンド (<code className="text-amber-400 font-mono">/recruit</code>)
              </h2>
              <p className="text-stone-300 text-xs md:text-sm">
                オプション不要！チャットに打つだけで、AIが時刻・人数・モードを自動判定してリッチな募集カードを投下します。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            <div className="bg-stone-950/80 p-4 rounded-2xl border border-stone-800">
              <div className="text-xs font-mono text-amber-400 font-bold bg-amber-950/40 px-2 py-1 rounded w-fit mb-2">
                /recruit 21:00
              </div>
              <div className="text-xs font-bold text-stone-200">カスタム10人募集</div>
              <p className="text-[11px] text-stone-400 mt-1">「本日21:00〜開始」の10人カスタム募集を即時作成します。</p>
            </div>

            <div className="bg-stone-950/80 p-4 rounded-2xl border border-stone-800">
              <div className="text-xs font-mono text-amber-400 font-bold bg-amber-950/40 px-2 py-1 rounded w-fit mb-2">
                /recruit 5 楽しく
              </div>
              <div className="text-xs font-bold text-stone-200">ノーマル5人募集</div>
              <p className="text-[11px] text-stone-400 mt-1">「今から・ノーマル5人・メモ: 楽しく」で即時投下します。</p>
            </div>

            <div className="bg-stone-950/80 p-4 rounded-2xl border border-stone-800">
              <div className="text-xs font-mono text-amber-400 font-bold bg-amber-950/40 px-2 py-1 rounded w-fit mb-2">
                /recruit ARAM
              </div>
              <div className="text-xs font-bold text-stone-200">ARAM 5人募集</div>
              <p className="text-[11px] text-stone-400 mt-1">「今から・ARAM5人」の募集を即時作成します。</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
            <span>💡 何も文字を入れずに <code className="text-amber-300 font-mono">/recruit</code> と打つだけでも、デフォルト（カスタム10人・今から）で即募集できます！</span>
          </div>
        </section>

        {/* 🌐 Webポータルの便利機能 */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-stone-100 border border-black/10 flex items-center justify-center text-stone-800 font-black">
              3
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-stone-900">
                Webポータルのおすすめ機能
              </h2>
              <p className="text-stone-600 text-xs md:text-sm">
                あなたの戦績確認やチーム分析、大会運営に役立つツール群です。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Link href="/player" className="bg-white rounded-2xl p-5 border border-black/10 hover:border-amber-400 transition-all hover:shadow-md group">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Users size={20} />
              </div>
              <h3 className="font-bold text-stone-900 group-hover:text-amber-700 transition-colors flex items-center justify-between text-base">
                プレイヤー名簿・マイページ
                <ArrowRight size={16} className="text-stone-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                全メンバーの戦績、勝率、ロール別MMR、相性の良いパートナーをグラフィカルに閲覧できます。
              </p>
            </Link>

            <Link href="/leaderboard" className="bg-white rounded-2xl p-5 border border-black/10 hover:border-amber-400 transition-all hover:shadow-md group">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Trophy size={20} />
              </div>
              <h3 className="font-bold text-stone-900 group-hover:text-amber-700 transition-colors flex items-center justify-between text-base">
                リーダーボード (順位表)
                <ArrowRight size={16} className="text-stone-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                サーバー内の総合勝率ランキング、MMRランキング、ロール別TOPプレイヤーを一覧表示。
              </p>
            </Link>

            <Link href="/balancer" className="bg-white rounded-2xl p-5 border border-black/10 hover:border-amber-400 transition-all hover:shadow-md group">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Swords size={20} />
              </div>
              <h3 className="font-bold text-stone-900 group-hover:text-amber-700 transition-colors flex items-center justify-between text-base">
                チーム分けシミュレーター
                <ArrowRight size={16} className="text-stone-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                参加メンバーを自由に選んで、AIによる最適チーム分けをリアルタイムでシミュレーションできます。
              </p>
            </Link>
          </div>
        </section>

        {/* 🎲 勝敗ベット ＆ KTMショップ ＆ コインシステムの使い方 */}
        <section className="bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950 text-white rounded-3xl p-6 md:p-8 border border-amber-500/30 shadow-xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black text-xl">
                🎲
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                  勝敗予想ベット ＆ KTMショップ ＆ 長者番付
                </h2>
                <p className="text-amber-200/80 text-xs md:text-sm">
                  カスタムを見る人も出る人も全員が熱狂！貯めたコインで特権アイテムをGETしよう🔥
                </p>
              </div>
            </div>
            <Link
              href="/casino"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              勝敗ベット画面へ <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="bg-stone-950/80 p-5 rounded-2xl border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🪙</span>
                <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">STEP 1</span>
              </div>
              <h3 className="text-sm font-black text-white">コインを貯める</h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                募集を立てる（<strong>+100〜200</strong>）、参加する（<strong>+50〜100</strong>）、勝つ（<strong>+150</strong>）、MVP（<strong>+200</strong>）で自然とザクザク貯まります！
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-stone-950/80 p-5 rounded-2xl border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🎲</span>
                <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">STEP 2</span>
              </div>
              <h3 className="text-sm font-black text-white">勝敗予想にベット！</h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                Discord通知やWeb画面で <strong>[🟦 BLUE]</strong> または <strong>[🟥 RED]</strong> を押すだけ！見事的中するとオッズ倍率でコインが増加！
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-stone-950/80 p-5 rounded-2xl border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl">🛒</span>
                <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">STEP 3</span>
              </div>
              <h3 className="text-sm font-black text-white">ショップでアイテム交換</h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                「<strong>第一希望確約チケット</strong>」「<strong>賞金首指定権</strong>」「<strong>全員ブレイバリー権</strong>」「<strong>週末メガ宝くじ</strong>」といつでも交換可能！
              </p>
            </div>
          </div>
        </section>

        {/* ❓ よくある質問 (FAQ) */}
        <section className="bg-white rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-stone-100 border border-black/10 flex items-center justify-center text-stone-800 font-black">
              <HelpCircle size={20} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-stone-900">
                よくある質問 (FAQ)
              </h2>
              <p className="text-stone-600 text-xs md:text-sm">
                新メンバーの方からよく寄せられる質問をまとめました。
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <span className="text-amber-600 font-black">Q.</span>
                勝敗ベットやコインの利用に、アカウント登録やパスワードは必要ですか？
              </h4>
              <p className="text-xs text-stone-700 mt-2 pl-5 leading-relaxed">
                <strong>いいえ、アカウント登録やパスワードは一切不要です！</strong><br />
                Discordから使う時は「あなたのDiscordアカウント」、Webポータルから使う時は「あなたのサモナー名（名簿名）」を入力するだけで、システムが自動であなたを識別してコインを安全に管理します。
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-black/5">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <span className="text-amber-600 font-black">Q.</span>
                レーン設定やサモナー名登録は毎回やる必要がありますか？
              </h4>
              <p className="text-xs text-stone-600 mt-2 pl-5 leading-relaxed">
                いいえ、一度設定すればデータベースに安全に保存されます。メインレーンを変えたい時やサモナー名を改名した時だけ再度設定してください。
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-black/5">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <span className="text-amber-600 font-black">Q.</span>
                10人以上集まった場合はどうなりますか？
              </h4>
              <p className="text-xs text-stone-600 mt-2 pl-5 leading-relaxed">
                Pity（不運度）が高い人から優先して10名選ばれます。選ばれなかった方は「待機枠」となり、Pityが+10ポイント加算されるため、次の試合は最優先で出場できます。
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-black/5">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <span className="text-amber-600 font-black">Q.</span>
                LoLを始めたばかりの初心者でも参加できますか？
              </h4>
              <p className="text-xs text-stone-600 mt-2 pl-5 leading-relaxed">
                大歓迎です！バランサーは初心者が偏らないよう自動でチームを均等化し、難しいロール（JG/MID等）への強制配置を避ける保護機能も備わっています。
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
