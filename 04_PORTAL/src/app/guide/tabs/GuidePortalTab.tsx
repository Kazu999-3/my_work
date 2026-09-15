"use client";

import React from 'react';
import Link from 'next/link';
import { 
  Globe, 
  User, 
  Coins, 
  Trophy, 
  Swords, 
  HeartHandshake, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  ShieldAlert,
  Flame,
  ShoppingBag,
  TrendingUp,
  History
} from 'lucide-react';

export default function GuidePortalTab() {
  return (
    <div className="space-y-8">
      {/* イントロバナー */}
      <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-cyan-500/15 border border-cyan-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-800 text-xs font-black border border-cyan-500/30">
            <Globe size={14} className="text-cyan-600" />
            ポータルWeb機能ガイド
          </div>
          <h2 className="text-xl md:text-2xl font-black text-stone-900">
            ポータル（Webアプリ）の主要機能と活用法
          </h2>
          <p className="text-stone-700 text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
            マイページ管理からコインの勝敗予想ベット、相性分析、大会チーム分けまで、ポータルで利用できる多彩な機能をご紹介します。
          </p>
        </div>
      </div>

      {/* 機能別グリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. マイページ & プレイヤーカルテ */}
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-all group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-2xl group-hover:scale-105 transition">
                👤
              </div>
              <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">
                プレイヤー設定・戦績
              </span>
            </div>
            <h3 className="text-base font-black text-stone-900">マイページ ＆ プレイヤーカルテ</h3>
            <p className="text-stone-600 text-xs leading-relaxed">
              希望レーンやRiot ID連携、所持コイン・インベントリを管理。ロール別勝率と得意チャンピオン戦績を1画面で直感的に確認できます。
            </p>
            <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200/80 text-xs text-stone-700 space-y-1.5">
              <div className="font-bold text-stone-800 flex items-center gap-1.5 text-[11px]">
                <Sparkles size={13} className="text-amber-600" />
                主な機能
              </div>
              <p>・希望レーン（Main/Sub/NG/こだわり度）の柔軟な変更</p>
              <p>・🎁 <strong>デイリーログインボーナス</strong>（毎日アクセスでコインGET）</p>
              <p>・ロール勝率 ＆ 得意チャンプ戦績の統合カルテ表示</p>
              <p>・他プレイヤーへの感謝コイン送金（チップ機能）</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <Link
              href="/mypage"
              className="text-xs font-black text-amber-700 hover:text-amber-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              マイページへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 2. チーム分けバランサー */}
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-all group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 font-bold text-2xl group-hover:scale-105 transition">
                ⚖️
              </div>
              <span className="text-[11px] font-bold text-cyan-800 bg-cyan-100 px-2.5 py-1 rounded-full">
                運営・進行必須
              </span>
            </div>
            <h3 className="text-base font-black text-stone-900">チーム分けバランサー ＆ カスタム作成</h3>
            <p className="text-stone-600 text-xs leading-relaxed">
              参加プレイヤーのMMRや希望ロールをもとに、実力差を最小化する公平な5v5チーム分けを瞬時に自動生成します。
            </p>
            <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200/80 text-xs text-stone-700 space-y-1.5">
              <div className="font-bold text-stone-800 flex items-center gap-1.5 text-[11px]">
                <Swords size={13} className="text-cyan-600" />
                バランサーの強み
              </div>
              <p>・MMR均等化 ＆ 各自の希望レーンを自動最適配分</p>
              <p>・手動ドラッグ＆ドロップによる微調整とシャッフル</p>
              <p>・ワンクリックで全員の<strong>OP.GG一括コピー</strong>＆カスタムリンク生成</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <Link
              href="/balancer"
              className="text-xs font-black text-cyan-700 hover:text-cyan-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              バランサーへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 3. カジノ・勝敗予想ベット & ショップ */}
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-all group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-2xl group-hover:scale-105 transition">
                🪙
              </div>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                大人気
              </span>
            </div>
            <h3 className="text-base font-black text-stone-900">勝敗予想ベット ＆ KTMショップ</h3>
            <p className="text-stone-600 text-xs leading-relaxed">
              チーム分けが出たら [BLUE] か [RED] にコインを賭けて観戦！オッズは賭け金比率でリアルタイム変動します。貯めたコインはショップで特権チケットと交換可能！
            </p>
            <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200/80 text-xs text-stone-700 space-y-1.5">
              <div className="font-bold text-stone-800 flex items-center gap-1.5 text-[11px]">
                <ShoppingBag size={13} className="text-amber-600" />
                コインで交換できる特権
              </div>
              <p>・<strong className="text-stone-800">第一希望確約チケット</strong>（次回必ず希望レーンへ）</p>
              <p>・<strong className="text-stone-800">賞金首ターゲット指定権</strong>（特定プレイヤー撃破でボーナス）</p>
              <p>・<strong className="text-stone-800">全員ブレイバリー権</strong>（全員ランダムビルド発動）</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <Link
              href="/casino"
              className="text-xs font-black text-amber-700 hover:text-amber-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              勝敗ベット・ショップへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 4. 相性分析 & デュオ勝率 */}
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-all group">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold text-2xl group-hover:scale-105 transition">
                🤝
              </div>
              <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">
                統計・データ
              </span>
            </div>
            <h3 className="text-base font-black text-stone-900">チーム相性 ＆ デュオ勝率シミュレーター</h3>
            <p className="text-stone-600 text-xs leading-relaxed">
              過去の全カスタム戦績から、誰と組んだときに最も勝率が高いか（シナジー）、逆に敵になった時の勝率（ライバル関係）をグラフィカルに分析します。
            </p>
            <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200/80 text-xs text-stone-700 space-y-1.5">
              <div className="font-bold text-stone-800 flex items-center gap-1.5 text-[11px]">
                <HeartHandshake size={13} className="text-indigo-600" />
                見どころ
              </div>
              <p>・2人を選んで共闘勝率を即座にシミュレーション</p>
              <p>・3〜5人のグループ相性ランキング</p>
              <p>・個人の「宿敵＆カモ」プレイヤー分析</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <Link
              href="/synergy"
              className="text-xs font-black text-indigo-700 hover:text-indigo-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              相性分析ページへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 5. リーダーボード & コイン長者番付 */}
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-all group col-span-1 md:col-span-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold text-2xl group-hover:scale-105 transition">
                🏆
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                ランキング ＆ メタ統計
              </span>
            </div>
            <h3 className="text-base font-black text-stone-900">リーダーボード ＆ チャンピオン・メタ統計</h3>
            <p className="text-stone-600 text-xs leading-relaxed">
              勝率・MMRランキング、ロール別勝率、コイン長者番付に加え、サーバー内の流行チャンピオン勝率と各プレイヤーの使用実績を一覧できます。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/80 text-xs text-stone-700 space-y-1">
                <div className="font-bold text-stone-900 flex items-center gap-1 text-[11px]">
                  <span>👑</span> 総合順位表
                </div>
                <p className="text-[11px] text-stone-600">
                  勝率・MMR・総試合数・連勝記録で競う公式ランキング。
                </p>
              </div>
              <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/80 text-xs text-stone-700 space-y-1">
                <div className="font-bold text-stone-900 flex items-center gap-1 text-[11px]">
                  <span>🪙</span> コイン長者番付
                </div>
                <p className="text-[11px] text-stone-600">
                  予想ベットや日々の活動で貯めたKTMコイン資産TOP一覧。
                </p>
              </div>
              <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/80 text-xs text-stone-700 space-y-1">
                <div className="font-bold text-stone-900 flex items-center gap-1 text-[11px]">
                  <span>🛡️</span> ロール別覇者
                </div>
                <p className="text-[11px] text-stone-600">
                  TOP / JG / MID / ADC / SUP 各レーンの勝率トップを抽出。
                </p>
              </div>
              <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/80 text-xs text-stone-700 space-y-1">
                <div className="font-bold text-stone-900 flex items-center gap-1 text-[11px]">
                  <span>📊</span> チャンプ別メタ統計
                </div>
                <p className="text-[11px] text-stone-600">
                  各チャンプの勝率・ピック率と使用プレイヤー一覧を切替表示。
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100">
            <Link
              href="/leaderboard"
              className="text-xs font-black text-emerald-700 hover:text-emerald-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              リーダーボードへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 6. 師弟マッチングハブ */}
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-all group col-span-1 md:col-span-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-2xl group-hover:scale-105 transition">
                🤝
              </div>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
                新登場 ✨
              </span>
            </div>
            <h3 className="text-base md:text-lg font-black text-stone-900">
              師弟マッチングハブ（AI相性分析・キックオフ3ステップ ＆ 安心制度）
            </h3>
            <p className="text-stone-600 text-xs leading-relaxed">
              教えたい師匠（Mentor）と学びたい弟子（Pupil）を繋ぐ公式掲示板です。AI相性分析や安心の申請・承諾フローに加え、迷わず始められる「キックオフ3ステップ」や「師弟の心得」、気まずくならずにリセットできる「円満解散」機能を完備しています。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/80 text-xs text-stone-700 space-y-1">
                <div className="font-bold text-stone-900 flex items-center gap-1 text-[11px]">
                  <span>🎯</span> AI相性 ＆ 5大専門指導
                </div>
                <p className="text-[11px] text-stone-600">
                  相性スコア（60〜98%）自動算出。カイト、エンゲージ、ピール、ウェーブ管理などを体系化。
                </p>
              </div>
              <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/80 text-xs text-stone-700 space-y-1">
                <div className="font-bold text-stone-900 flex items-center gap-1 text-[11px]">
                  <span>🚀</span> キックオフ 3ステップ
                </div>
                <p className="text-[11px] text-stone-600">
                  ①挨拶＆OP.GG共有 ➔ ②目標を1つ決める ➔ ③ノーマル/カスタム1戦で迷わずスタート！
                </p>
              </div>
              <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/80 text-xs text-stone-700 space-y-1">
                <div className="font-bold text-stone-900 flex items-center gap-1 text-[11px]">
                  <span>🍃</span> 期間延長 ＆ 円満解散・管理
                </div>
                <p className="text-[11px] text-stone-600">
                  「⚡ そのまま実行」で即時延長、「🎓 卒業(+200🪙)」、「🍃 円満解散」、管理者による不正・不要カードの削除管理も完備。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-xs text-stone-800 space-y-1">
                <div className="font-black text-amber-950 flex items-center gap-1.5 text-[11px]">
                  <span>⭐</span> 師弟の匿名評価制度 (+100🪙)
                </div>
                <p className="text-[11px] text-stone-700 leading-relaxed font-medium">
                  ペア活動終了時や活動中に匿名で満足度や推薦タグを送信。相手のカードに「⭐ 4.9」「🏷️ 丁寧な指導」として安全に集約されます。
                </p>
              </div>

              <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200/80 text-xs text-stone-800 space-y-1">
                <div className="font-black text-indigo-950 flex items-center gap-1.5 text-[11px]">
                  <span>🌟</span> メンバー匿名評判・栄誉 (+50🪙)
                </div>
                <p className="text-[11px] text-stone-700 leading-relaxed font-medium">
                  個別カルテから1日1回「👑 キャリー力」「💖 ナイスマナー」などの称賛タグを匿名で贈れます。管理者相談窓口も完備。
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-xs text-stone-800 space-y-1">
              <div className="font-black text-amber-950 flex items-center gap-1.5 text-[11px]">
                <span>📜</span> 師弟の心得（ポジティブ指導文化）
              </div>
              <p className="text-[11px] text-stone-700 leading-relaxed font-medium">
                ・<strong>師匠:</strong> ダメ出しではなく良い所を褒める／1試合の課題は1つに絞る／優しく理由を伝える<br />
                ・<strong>弟子:</strong> 感謝を伝える／分からない事は遠慮なく質問する／1つずつ意識して実践する
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
            <span className="text-[11px] text-stone-500 font-medium">
              カードを登録して相性の良いバディを探してみましょう！
            </span>
            <Link
              href="/mentorship"
              className="text-xs font-black text-amber-700 hover:text-amber-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              師弟ハブへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
