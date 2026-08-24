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
      <div className="bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 text-stone-100 py-16 px-6 relative overflow-hidden border-b border-black/10">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#c2650f_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold tracking-wider mb-4 border border-amber-500/30">
            <Sparkles size={14} />
            WELCOME TO KTM LoL
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
            KTM スタートアップガイド
          </h1>
          <p className="text-stone-300 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            KTM LoL部へようこそ！公平で熱いカスタムマッチを楽しむための<br className="hidden md:inline" />
            「3ステップの初期登録」と便利なWebポータルの使い方をご案内します。
          </p>

          {/* クイックマイページ検索 */}
          <form onSubmit={handleSearch} className="mt-8 max-w-md mx-auto flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
              <input
                type="text"
                placeholder="サモナー名 or 名前を入力してマイページへ..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full bg-stone-950/80 border border-stone-700 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
              />
            </div>
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              検索 <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-[1550px] w-full mx-auto px-4 md:px-8 py-10 space-y-12">
        
        {/* 🌟 3ステップ初期登録 */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-amber-600/10 border border-amber-600/20 flex items-center justify-center text-amber-700 font-black">
              1
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-stone-900">
                参加のための初期設定 3ステップ
              </h2>
              <p className="text-stone-600 text-xs md:text-sm">
                Discordサーバー内のボタンまたはコマンドから約1分で完了します。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl p-6 border border-black/10 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 font-bold">
                  <UserCheck size={24} />
                </div>
                <div className="text-xs font-black text-amber-700 uppercase tracking-wider mb-1">Step 1</div>
                <h3 className="text-lg font-black text-stone-900 mb-2">サモナー名 (Riot ID) 登録</h3>
                <p className="text-stone-600 text-xs leading-relaxed mb-4">
                  Discordの「📝 サモナー名登録」ボタンまたは <code className="bg-stone-100 px-1.5 py-0.5 rounded text-amber-800 font-mono text-[11px]">/ign</code> であなたのLoLアカウント（例: <code className="text-stone-700 font-mono">Player#JP1</code>）を紐付けます。
                </p>
              </div>
              <div className="pt-3 border-t border-stone-100 flex items-center gap-2 text-[11px] text-stone-500 font-medium">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                最高ランク・戦績が自動同期されます
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl p-6 border border-black/10 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4 font-bold">
                  <MapPin size={24} />
                </div>
                <div className="text-xs font-black text-indigo-700 uppercase tracking-wider mb-1">Step 2</div>
                <h3 className="text-lg font-black text-stone-900 mb-2">得意・NGレーン設定</h3>
                <p className="text-stone-600 text-xs leading-relaxed mb-4">
                  「📍 希望レーン設定」ボタンまたは <code className="bg-stone-100 px-1.5 py-0.5 rounded text-indigo-800 font-mono text-[11px]">/lane</code> でメイン・サブレーンやNGレーンを登録します。
                </p>
              </div>
              <div className="pt-3 border-t border-stone-100 flex items-center gap-2 text-[11px] text-stone-500 font-medium">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                チーム分けAIが希望を最優先で考慮
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-2xl p-6 border border-black/10 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 font-bold">
                  <Swords size={24} />
                </div>
                <div className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-1">Step 3</div>
                <h3 className="text-lg font-black text-stone-900 mb-2">募集に参加する！</h3>
                <p className="text-stone-600 text-xs leading-relaxed mb-4">
                  募集チャンネル（<code className="bg-stone-100 px-1.5 py-0.5 rounded text-emerald-800 font-mono text-[11px]">#🎮募集</code> / <code className="bg-stone-100 px-1.5 py-0.5 rounded text-emerald-800 font-mono text-[11px]">#🔄定期カスタム</code>）のメッセージにある「✋ 参加する」を押すだけで完了！
                </p>
              </div>
              <div className="pt-3 border-t border-stone-100 flex items-center gap-2 text-[11px] text-stone-500 font-medium">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                10人揃うと自動でチーム分け実行
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
