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
  Users,
  ZoomIn,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GuidePage() {
  const router = useRouter();
  const [searchName, setSearchName] = useState('');
  const [modalImage, setModalImage] = useState<{ src: string; title: string } | null>(null);

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
        <section className="bg-white text-stone-900 rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-stone-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-2xl font-bold">
                🪙
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-stone-900">
                  勝敗予想 ＆ KTMショップで遊ぶ！
                </h2>
                <p className="text-stone-600 text-xs md:text-sm">
                  観戦者も参加者も全員が熱狂できるKTM独自のコイン＆特権システム
                </p>
              </div>
            </div>
            <Link
              href="/casino"
              className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-amber-600 text-white font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              勝敗予想画面へ行く <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="text-base font-black text-stone-900">🎯 1. 勝敗を予想</div>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                カスタムの試合が決まったら、BLUEかREDの勝つと思う方にコインを予想投票！
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="text-base font-black text-stone-900">💰 2. コインを倍増</div>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                予想が当たればオッズに応じてコインが手元にザクザク戻ってきます！
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="text-base font-black text-stone-900">🛒 3. 特権アイテムと交換</div>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                「🛡️ チャンピオンプロテクト権」や「🚫 全員BAN禁止権」「🎯 賞金首指定権」と交換！
              </p>
            </div>
          </div>

          {/* コイン獲得5大ルート一覧 */}
          <div className="pt-4 border-t border-stone-100 space-y-3">
            <h4 className="text-sm font-black text-stone-900">🪙 コインを自動で貯める 5つの方法</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-[10px] text-stone-500 font-bold">初回ログイン</div>
                <div className="font-mono font-black text-emerald-600 text-sm mt-0.5">+1,000 pt</div>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-[10px] text-stone-500 font-bold">試合参加賞</div>
                <div className="font-mono font-black text-emerald-600 text-sm mt-0.5">+100 pt</div>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-[10px] text-stone-500 font-bold">試合勝利</div>
                <div className="font-mono font-black text-emerald-600 text-sm mt-0.5">+150 pt</div>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                <div className="text-[10px] text-stone-500 font-bold">募集主催</div>
                <div className="font-mono font-black text-emerald-600 text-sm mt-0.5">+200 pt</div>
              </div>
              <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 col-span-2 sm:col-span-1">
                <div className="text-[10px] text-stone-500 font-bold">勝敗予想的中</div>
                <div className="font-mono font-black text-amber-600 text-sm mt-0.5">賭け金 × 2倍</div>
              </div>
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
        <section className="bg-white text-stone-900 rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-black text-xl">
              ⚡
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-stone-900">
                Discord 爆速募集コマンド (<code className="text-amber-600 font-mono text-base">/recruit</code>)
              </h2>
              <p className="text-stone-600 text-xs md:text-sm">
                オプション不要！チャットに打つだけで、AIが時刻・人数・モードを自動判定してリッチな募集カードを投下します。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-1">
              <div className="text-xs font-mono text-amber-800 font-bold bg-amber-100/80 px-2 py-0.5 rounded w-fit mb-1.5 border border-amber-200">
                /recruit
              </div>
              <div className="text-xs font-black text-stone-900">ノーマル5人募集（デフォルト）</div>
              <p className="text-[11px] text-stone-600 leading-relaxed">何も書かずに打つだけで「今から・ノーマル5人募集」を即時作成します。</p>
            </div>

            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-1">
              <div className="text-xs font-mono text-amber-800 font-bold bg-amber-100/80 px-2 py-0.5 rounded w-fit mb-1.5 border border-amber-200">
                /recruit 10 21:00
              </div>
              <div className="text-xs font-black text-stone-900">カスタム10人募集</div>
              <p className="text-[11px] text-stone-600 leading-relaxed">「本日21:00〜開始」の10人カスタム募集を即時作成します。</p>
            </div>

            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 space-y-1">
              <div className="text-xs font-mono text-amber-800 font-bold bg-amber-100/80 px-2 py-0.5 rounded w-fit mb-1.5 border border-amber-200">
                /recruit ARAM
              </div>
              <div className="text-xs font-black text-stone-900">ARAM 5人募集</div>
              <p className="text-[11px] text-stone-600 leading-relaxed">「今から・ARAM5人」の募集を即時作成します。</p>
            </div>
          </div>
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
            <span>💡 何も文字を入れずに <code className="text-amber-700 font-bold font-mono">/recruit</code> と打つだけで、自動で「今からノーマル5人募集」になります！</span>
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

        {/* 🗺️ どこを見ればいい？ ポータル機能まるわかり案内マップ */}
        <section className="bg-stone-900 text-white rounded-3xl p-6 md:p-8 border border-white/10 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black text-xl">
              🗺️
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white">
                どこを見ればいい？ ポータル機能まるわかりマップ
              </h2>
              <p className="text-stone-300 text-xs md:text-sm">
                使いたい機能に合わせて、各ページをワンタップで開けます！
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. 勝敗予想 & ショップ */}
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-amber-400 transition-all flex flex-col justify-between space-y-4 group shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🎯</span>
                  <span className="text-[10px] font-black text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                    /casino
                  </span>
                </div>
                <h3 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                  勝敗予想 ＆ KTMショップ
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  試合の勝利チーム予想、貯めたコインでの特権チケット交換、長者番付TOP10をリアルタイム確認！
                </p>

                {/* 折りたたみ使い方例 */}
                <details className="mt-2 text-xs bg-black/40 rounded-xl border border-white/10 p-3 group/details">
                  <summary className="font-bold text-amber-400 cursor-pointer select-none flex items-center justify-between">
                    <span>📸 使い方・画面例を見る</span>
                    <span className="text-[10px] text-stone-400 group-open/details:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2.5 text-[11px] text-stone-300">
                    <button
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalImage({ src: '/guide/casino_clean_preview.png', title: '勝敗予想 ＆ KTMショップ 画面例' });
                      }}
                      className="w-full relative group/img cursor-zoom-in rounded-2xl overflow-hidden border border-white/20 shadow-md block text-left"
                    >
                      <img
                        src="/guide/casino_clean_preview.png"
                        alt="勝敗予想とKTMショップ画面例"
                        className="w-full object-cover group-hover/img:scale-102 transition-transform duration-300 pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-black text-xs pointer-events-none">
                        <ZoomIn size={16} />
                        <span>クリックで拡大</span>
                      </div>
                    </button>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-amber-500/20">
                      <div className="font-bold text-amber-300 mb-0.5">① 勝敗予想カード</div>
                      <p>「🟦 BLUE勝利 (x1.8)」または「🟥 RED勝利 (x2.1)」をワンタップして予想完了！</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-indigo-500/20">
                      <div className="font-bold text-indigo-300 mb-0.5">② 特権ショップ</div>
                      <p>「🛡️ チャンピオンプロテクト権」や「🚫 全員BAN禁止権」をコインで即時交換！</p>
                    </div>
                  </div>
                </details>
              </div>

              <Link
                href="/casino"
                className="mt-2 text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center justify-between pt-2 border-t border-white/10"
              >
                <span>ページを開く</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {/* 2. チーム分け */}
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-rose-400 transition-all flex flex-col justify-between space-y-4 group shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">⚔️</span>
                  <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">
                    /balancer
                  </span>
                </div>
                <h3 className="text-sm font-black text-white group-hover:text-rose-300 transition-colors">
                  チーム分け (KTM Balancer)
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  10人の実力・ロール希望を考慮した完全自動チーム分け ＆ 勝率50:50シミュレーション！
                </p>

                {/* 折りたたみ使い方例 */}
                <details className="mt-2 text-xs bg-black/40 rounded-xl border border-white/10 p-3 group/details">
                  <summary className="font-bold text-rose-400 cursor-pointer select-none flex items-center justify-between">
                    <span>📸 使い方・画面例を見る</span>
                    <span className="text-[10px] text-stone-400 group-open/details:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2.5 text-[11px] text-stone-300">
                    <button
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalImage({ src: '/guide/balancer_preview.png', title: 'チーム分け (KTM Balancer) 画面例' });
                      }}
                      className="w-full relative group/img cursor-zoom-in rounded-2xl overflow-hidden border border-white/20 shadow-md block text-left"
                    >
                      <img
                        src="/guide/balancer_preview.png"
                        alt="チーム分けバランサー画面例"
                        className="w-full object-cover group-hover/img:scale-102 transition-transform duration-300 pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-black text-xs pointer-events-none">
                        <ZoomIn size={16} />
                        <span>クリックで拡大</span>
                      </div>
                    </button>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-rose-500/20">
                      <div className="font-bold text-rose-300 mb-0.5">① 10人選択 ➔ 即チーム分け</div>
                      <p>参加者10人にチェックを入れるだけで、AIが最も実力差が小さくなるチームを自動生成！</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-amber-500/20">
                      <div className="font-bold text-amber-300 mb-0.5">② 予想勝率グラフ</div>
                      <p>「BLUE 49.8% vs RED 50.2%」のように完全互角な黄金バランスを視覚表示！</p>
                    </div>
                  </div>
                </details>
              </div>

              <Link
                href="/balancer"
                className="mt-2 text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center justify-between pt-2 border-t border-white/10"
              >
                <span>ページを開く</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {/* 3. プレイヤー名簿 */}
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-indigo-400 transition-all flex flex-col justify-between space-y-4 group shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">👥</span>
                  <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                    /player
                  </span>
                </div>
                <h3 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors">
                  プレイヤー名簿 ＆ マイ戦績
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  メンバー全員の得意ロール・最高ランク・通算勝率・ロール別MMR（実力値）カルテをチェック！
                </p>

                {/* 折りたたみ使い方例 */}
                <details className="mt-2 text-xs bg-black/40 rounded-xl border border-white/10 p-3 group/details">
                  <summary className="font-bold text-indigo-400 cursor-pointer select-none flex items-center justify-between">
                    <span>📸 使い方・画面例を見る</span>
                    <span className="text-[10px] text-stone-400 group-open/details:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2.5 text-[11px] text-stone-300">
                    <button
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalImage({ src: '/guide/player_preview.png', title: 'プレイヤー名簿 ＆ カルテ 画面例' });
                      }}
                      className="w-full relative group/img cursor-zoom-in rounded-2xl overflow-hidden border border-white/20 shadow-md block text-left"
                    >
                      <img
                        src="/guide/player_preview.png"
                        alt="プレイヤー名簿画面例"
                        className="w-full object-cover group-hover/img:scale-102 transition-transform duration-300 pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-black text-xs pointer-events-none">
                        <ZoomIn size={16} />
                        <span>クリックで拡大</span>
                      </div>
                    </button>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-indigo-500/20">
                      <div className="font-bold text-indigo-300 mb-0.5">① レーダーチャート＆カルテ</div>
                      <p>TOP/JG/MID/ADC/SUPそれぞれの実力レート（MMR）と勝率推移が一目で丸わかり！</p>
                    </div>
                  </div>
                </details>
              </div>

              <Link
                href="/player"
                className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center justify-between pt-2 border-t border-white/10"
              >
                <span>ページを開く</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {/* 4. リーダーボード */}
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-yellow-400 transition-all flex flex-col justify-between space-y-4 group shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🏆</span>
                  <span className="text-[10px] font-black text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded-full border border-yellow-500/30">
                    /leaderboard
                  </span>
                </div>
                <h3 className="text-sm font-black text-white group-hover:text-yellow-300 transition-colors">
                  リーダーボード (順位表)
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  KTMサーバー内のMMR総合ランキング、月間最多キル・最高勝率トッププレイヤーを表彰！
                </p>

                {/* 折りたたみ使い方例 */}
                <details className="mt-2 text-xs bg-black/40 rounded-xl border border-white/10 p-3 group/details">
                  <summary className="font-bold text-yellow-400 cursor-pointer select-none flex items-center justify-between">
                    <span>📸 使い方・画面例を見る</span>
                    <span className="text-[10px] text-stone-400 group-open/details:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2.5 text-[11px] text-stone-300">
                    <button
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalImage({ src: '/guide/leaderboard_preview.png', title: 'リーダーボード 順位表 画面例' });
                      }}
                      className="w-full relative group/img cursor-zoom-in rounded-2xl overflow-hidden border border-white/20 shadow-md block text-left"
                    >
                      <img
                        src="/guide/leaderboard_preview.png"
                        alt="リーダーボード順位表画面例"
                        className="w-full object-cover group-hover/img:scale-102 transition-transform duration-300 pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-black text-xs pointer-events-none">
                        <ZoomIn size={16} />
                        <span>クリックで拡大</span>
                      </div>
                    </button>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-yellow-500/20">
                      <div className="font-bold text-yellow-300 mb-0.5">① サーバー内最強ランキング</div>
                      <p>全メンバーのカスタム成績に基づき、1位〜最下位までの総合順位をリアルタイム集計！</p>
                    </div>
                  </div>
                </details>
              </div>

              <Link
                href="/leaderboard"
                className="mt-2 text-xs text-yellow-400 hover:text-yellow-300 font-bold flex items-center justify-between pt-2 border-t border-white/10"
              >
                <span>ページを開く</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {/* 5. 試合履歴 */}
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-orange-400 transition-all flex flex-col justify-between space-y-4 group shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">📜</span>
                  <span className="text-[10px] font-black text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded-full border border-orange-500/30">
                    /history
                  </span>
                </div>
                <h3 className="text-sm font-black text-white group-hover:text-orange-300 transition-colors">
                  試合履歴 ＆ 対戦ログ
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  過去のカスタム対戦結果、対面勝敗、KDA、MMR変動の詳細ログをいつでも振り返り！
                </p>

                {/* 折りたたみ使い方例 */}
                <details className="mt-2 text-xs bg-black/40 rounded-xl border border-white/10 p-3 group/details">
                  <summary className="font-bold text-orange-400 cursor-pointer select-none flex items-center justify-between">
                    <span>📸 使い方・画面例を見る</span>
                    <span className="text-[10px] text-stone-400 group-open/details:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2.5 text-[11px] text-stone-300">
                    <button
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalImage({ src: '/guide/history_preview.png', title: '試合履歴 ＆ 対戦ログ 画面例' });
                      }}
                      className="w-full relative group/img cursor-zoom-in rounded-2xl overflow-hidden border border-white/20 shadow-md block text-left"
                    >
                      <img
                        src="/guide/history_preview.png"
                        alt="試合履歴・対戦ログ画面例"
                        className="w-full object-cover group-hover/img:scale-102 transition-transform duration-300 pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-black text-xs pointer-events-none">
                        <ZoomIn size={16} />
                        <span>クリックで拡大</span>
                      </div>
                    </button>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-orange-500/20">
                      <div className="font-bold text-orange-300 mb-0.5">① 10人全員のスコアボード</div>
                      <p>各レーンの対面対決（KDA・ダメージ・獲得MMR）が綺麗に並んだ試合ログを閲覧可能！</p>
                    </div>
                  </div>
                </details>
              </div>

              <Link
                href="/history"
                className="mt-2 text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center justify-between pt-2 border-t border-white/10"
              >
                <span>ページを開く</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {/* 6. チームシナジー */}
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-fuchsia-400 transition-all flex flex-col justify-between space-y-4 group shadow-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🤝</span>
                  <span className="text-[10px] font-black text-fuchsia-400 bg-fuchsia-500/20 px-2 py-0.5 rounded-full border border-fuchsia-500/30">
                    /synergy
                  </span>
                </div>
                <h3 className="text-sm font-black text-white group-hover:text-fuchsia-300 transition-colors">
                  チームシナジー ＆ 相性診断
                </h3>
                <p className="text-xs text-stone-300 leading-relaxed">
                  「誰と誰が組むと勝率が高いか？」メンバー同士のベストコンビ・シナジーを自動解析！
                </p>

                {/* 折りたたみ使い方例 */}
                <details className="mt-2 text-xs bg-black/40 rounded-xl border border-white/10 p-3 group/details">
                  <summary className="font-bold text-fuchsia-400 cursor-pointer select-none flex items-center justify-between">
                    <span>📸 使い方・画面例を見る</span>
                    <span className="text-[10px] text-stone-400 group-open/details:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2.5 text-[11px] text-stone-300">
                    <button
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalImage({ src: '/guide/synergy_preview.png', title: 'チームシナジー ＆ 相性診断 画面例' });
                      }}
                      className="w-full relative group/img cursor-zoom-in rounded-2xl overflow-hidden border border-white/20 shadow-md block text-left"
                    >
                      <img
                        src="/guide/synergy_preview.png"
                        alt="チームシナジー相性画面例"
                        className="w-full object-cover group-hover/img:scale-102 transition-transform duration-300 pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-black text-xs pointer-events-none">
                        <ZoomIn size={16} />
                        <span>クリックで拡大</span>
                      </div>
                    </button>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-fuchsia-500/20">
                      <div className="font-bold text-fuchsia-300 mb-0.5">① 最強DUO・コンビ発掘</div>
                      <p>勝率70%超えの相性抜群ペアや、逆に勝率が振るわない組み合わせをデータで分析！</p>
                    </div>
                  </div>
                </details>
              </div>

              <Link
                href="/synergy"
                className="mt-2 text-xs text-fuchsia-400 hover:text-fuchsia-300 font-bold flex items-center justify-between pt-2 border-t border-white/10"
              >
                <span>ページを開く</span>
                <ArrowRight size={12} />
              </Link>
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

      {/* 🔍 画像拡大ライトボックスモーダル（超特大フルスクリーン） */}
      {modalImage && (
        <div 
          onClick={() => setModalImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 cursor-zoom-out select-none"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-[96vw] w-full max-h-[94vh] bg-stone-900 rounded-3xl border border-white/20 shadow-2xl overflow-hidden cursor-default flex flex-col"
          >
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-stone-950/90 shrink-0">
              <div className="flex items-center gap-2 text-sm md:text-base font-black text-white">
                <span>📸</span>
                <span>{modalImage.title}</span>
              </div>
              <button
                onClick={() => setModalImage(null)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                title="閉じる"
              >
                <X size={16} />
                <span>閉じる</span>
              </button>
            </div>

            {/* 拡大画像本体（超特大） */}
            <div className="p-2 sm:p-4 bg-stone-950/95 flex items-center justify-center overflow-auto flex-1">
              <img
                src={modalImage.src}
                alt={modalImage.title}
                className="w-full h-auto max-h-[84vh] object-contain rounded-xl shadow-2xl border border-white/10"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
