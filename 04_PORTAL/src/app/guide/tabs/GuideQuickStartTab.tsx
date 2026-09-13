"use client";

import React from 'react';
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
  Coins
} from 'lucide-react';

export default function GuideQuickStartTab({ onSelectTab }: { onSelectTab?: (tab: string) => void }) {
  return (
    <div className="space-y-8">
      {/* イントロバナー */}
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-800 text-xs font-black border border-amber-500/30">
              <Sparkles size={14} className="text-amber-600 animate-pulse" />
              初回1分！今すぐ遊べる3ステップ
            </div>
            <h2 className="text-xl md:text-2xl font-black text-stone-900">
              誰でもすぐ参加できる！KTMカスタム入門
            </h2>
            <p className="text-stone-700 text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
              登録は3ステップで完了！一度設定すれば、Discordの募集ボタンを1タップするだけで公平なチーム分けに参加できます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/mypage"
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              マイページで設定する <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* 3ステップ カード一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Step 1 */}
        <div className="bg-white rounded-3xl p-6 border-2 border-amber-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-amber-400 transition-all group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-2xl group-hover:scale-105 transition">
                📝
              </div>
              <span className="text-xs font-black text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
                STEP 1
              </span>
            </div>
            <h3 className="text-base font-black text-stone-900">Riot ID（サモナー名）登録</h3>
            <p className="text-stone-600 text-xs leading-relaxed">
              ポータル右上の <strong className="text-stone-900 font-bold">「Discordログイン」</strong> から連携するか、マイページでゲーム内の <code className="bg-stone-100 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">名前#TAG</code> を入力します。
            </p>
            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3 text-[11px] text-stone-600 space-y-1">
              <div className="font-bold text-stone-800 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-600" />
                登録するとできること
              </div>
              <p>・過去のソロQランク自動取得</p>
              <p>・カスタム勝率・MMRの自動集計</p>
              <p>・初期 <strong className="text-amber-700 font-bold">1,000コイン</strong> の自動受取</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <Link
              href="/mypage"
              className="text-xs font-black text-amber-700 hover:text-amber-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              マイページを開く <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white rounded-3xl p-6 border-2 border-amber-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-amber-400 transition-all group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold text-2xl group-hover:scale-105 transition">
                🎯
              </div>
              <span className="text-xs font-black text-indigo-800 bg-indigo-100 px-3 py-1 rounded-full border border-indigo-200">
                STEP 2
              </span>
            </div>
            <h3 className="text-base font-black text-stone-900">希望レーンの設定</h3>
            <p className="text-stone-600 text-xs leading-relaxed">
              あなたの得意レーンと行きたくないレーン（NG）を設定します。Discordで <code className="bg-stone-100 text-indigo-900 px-1.5 py-0.5 rounded font-mono font-bold">/lane</code> と打つか、マイページから登録可能です。
            </p>
            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3 text-[11px] text-stone-600 space-y-1">
              <div className="font-bold text-stone-800 flex items-center gap-1">
                <Sliders size={13} className="text-indigo-600" />
                設定できる項目
              </div>
              <p>・<strong className="text-stone-800">メインレーン</strong>（最優先で配置）</p>
              <p>・<strong className="text-stone-800">サブレーン</strong>（2番目に得意）</p>
              <p>・<strong className="text-stone-800">NGレーン</strong>（絶対に避けたい位置）</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('bot')}
              className="text-xs font-black text-indigo-700 hover:text-indigo-900 flex items-center gap-1 group-hover:translate-x-1 transition cursor-pointer"
            >
              /lane コマンドの詳細を見る <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white rounded-3xl p-6 border-2 border-amber-200/90 shadow-sm relative overflow-hidden flex flex-col justify-between hover:border-amber-400 transition-all group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold text-2xl group-hover:scale-105 transition">
                ⚔️
              </div>
              <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                STEP 3
              </span>
            </div>
            <h3 className="text-base font-black text-stone-900">Discord募集にワンタップ参加！</h3>
            <p className="text-stone-600 text-xs leading-relaxed">
              Discordのカスタム募集チャンネルにパネルが出たら、<strong className="text-stone-900 font-bold">[✋ どこでも参加]</strong> を押すだけ！10人集まると自動でチーム分けが始まります。
            </p>
            <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3 text-[11px] text-stone-600 space-y-1">
              <div className="font-bold text-stone-800 flex items-center gap-1">
                <Gamepad2 size={13} className="text-emerald-600" />
                ゲーム中の流れ
              </div>
              <p>1. チーム分け結果がDiscordに届く</p>
              <p>2. ポータルで勝敗予想ベットで盛り上がる🎲</p>
              <p>3. 試合終了後に勝敗が自動反映！</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('bot')}
              className="text-xs font-black text-emerald-700 hover:text-emerald-900 flex items-center gap-1 group-hover:translate-x-1 transition cursor-pointer"
            >
              募集ボタンの全機能を見る <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* カスタム参加のルール＆よくある質問 */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-stone-200 shadow-xs space-y-6">
        <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
          <ShieldCheck className="text-amber-600" size={20} />
          カスタム参加にあたっての安心ガイド
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1.5">
            <h4 className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <span>💡</span> 1戦だけのスポット参加や途中抜けはできますか？
            </h4>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              大歓迎です！「1戦だけプレイしたい」「時間が合えば途中まで」という場合でも気軽に参加ボタンを押してください。交代や途中抜けも自由に行えます。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1.5">
            <h4 className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <span>🔲</span> シルバー以下のピック形式やルールはどうなっていますか？
            </h4>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              シルバー以下カスタムは「ブラインドピック（MMR変動あり）」を採用しています！BANや相手のカウンターを気にせず、自分の使いたい得意チャンピオンで気楽に対戦しながらMMR勝負を楽しめます。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1.5">
            <h4 className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <span>❓</span> 初心者やランクの低い人でも楽しめますか？
            </h4>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              はい！ゴルプラ帯とシルバー以下帯は完全に部屋を分けて開催されます。また、20:00時点で10名集まらなかった場合はカスタムを中止し、ノーマルやメイヘムでワイワイ遊ぶ形式へ切り替わります。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1.5">
            <h4 className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <span>🪙</span> コインはどうやって増やすのですか？
            </h4>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              マイページで毎日受取できるデイリーボーナス（+100コイン）、カスタム参加で +100コイン、勝利で +150コインが手に入ります！貯めたコインは勝敗予想ベットやショップ特権で使えます。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1.5">
            <h4 className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <span>🔁</span> 連戦時（BO3形式）のチーム分けはどうなりますか？
            </h4>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              バランサー画面の「BO3（チーム維持）」機能により、同じメンバー構成のままサイドを交代して第2戦・第3戦を行うことができます。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-1.5">
            <h4 className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <span>🎪</span> お祭りカスタム（ネタ構成）の時は戦績に影響しますか？
            </h4>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              「お祭りカスタム（完全戦績保護）」トグルがONになっている試合では、公式勝率・MMR変動が一切ノーカウントになります。安心してオフメタやランダムを楽しめます！
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
