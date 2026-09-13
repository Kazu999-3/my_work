"use client";

import React from 'react';
import { 
  Sparkles, 
  Swords, 
  Clock, 
  Dices, 
  ShieldAlert, 
  Trophy, 
  Flame, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Zap
} from 'lucide-react';

export default function GuideRulesTab() {
  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* イントロダクション */}
      <div className="bg-white/80 border border-stone-200/90 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-stone-950 flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
            📜
          </div>
          <div>
            <h2 className="text-xl font-black text-stone-900 tracking-tight">
              KTM カスタム公式ルールブック ＆ 特殊レギュレーション
            </h2>
            <p className="text-xs md:text-sm text-stone-600 mt-1 leading-relaxed font-medium">
              KTMコミュニティで定期開催されるカスタムマッチのレギュレーション一覧です。<br />
              通常カスタムから日曜お祭りマッチ、アラームカスタム、BO3シリーズまで、安心して楽しくプレイするためのルールをまとめています。
            </p>
          </div>
        </div>
      </div>

      {/* 1. 週末定期カスタムの基本フォーマット */}
      <div className="bg-white/80 border border-stone-200/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-700">
            <Swords size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-stone-900">1. 週末定期カスタム（土曜・日曜）</h3>
            <p className="text-xs text-stone-500">毎週土日 21:00〜 開催されるコミュニティ恒例マッチ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 土曜: ランク別・ガチカスタム */}
          <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-stone-950 text-xs font-black">
                土曜日 21:00〜
              </span>
              <span className="text-xs font-bold text-amber-800">⚔️ ランク別ガチ勝負</span>
            </div>
            <h4 className="text-sm font-black text-stone-900">👑 土曜：バランス重視・実力伯仲カスタム</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              KTM独自のMMRアルゴリズムに基づき、両チームの戦力が最も均等になるようにチーム分けを実施します。日頃の練習の成果を発揮する熱いバトルが楽しめます！
            </p>
            <ul className="text-xs text-stone-600 space-y-1 pt-1">
              <li className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                <span>MMR自動均等分け（ロール適性・得意チャンピオン考慮）</span>
              </li>
              <li className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                <span>勝敗に応じたMMR変動あり</span>
              </li>
            </ul>
          </div>

          {/* 日曜: お祭りカスタム */}
          <div className="p-5 rounded-2xl bg-purple-50/50 border border-purple-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-black">
                日曜日 21:00〜
              </span>
              <span className="text-xs font-bold text-purple-700">🎪 ランク無差別・お祭り</span>
            </div>
            <h4 className="text-sm font-black text-stone-900">🎲 日曜：完全ランダム・お祭りカスタム</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              ランク・MMR・レート差を完全無視！ランダムシャッフルでチーム分けを行い、初心者から上級者までワイワイ盛り上がるお祭りナイトです。
            </p>
            <ul className="text-xs text-stone-600 space-y-1 pt-1">
              <li className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                <span>MMR変動なし（完全カジュアル）</span>
              </li>
              <li className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                <span>オフメタピック・新チャンピオン練習大歓迎✨</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. スタイル別エントリー ＆ 途中参加システム */}
      <div className="bg-white/80 border border-stone-200/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-700">
            <Clock size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-stone-900">2. スタイル別エントリー ＆ 2戦目交代システム</h3>
            <p className="text-xs text-stone-500">仕事や予定に合わせて無理なく参加できる3つのスタイル</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-black">
                🟢 フル参加
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed font-medium">
              21:00の第1試合から最終戦までフルで参加する標準スタイルです。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-black">
                ⏱️ 1戦のみ
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed font-medium">
              「21時からは出られるけど次の日早いから1試合だけ」という方向け。第1試合終了後に自動で交代します。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-black">
                🌙 途中参加 (2戦目〜)
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed font-medium">
              「21時は間に合わないけど21:50頃からの第2試合なら出られる！」という方向け。第2試合開始時にスムーズに合流できます。
            </p>
          </div>
        </div>

        {/* ピンポイント助っ人急募について */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-stone-700 leading-relaxed">
            <span className="font-black text-amber-950">🚨 20:00 ピンポイント助っ人通知システム：</span><br />
            開催当日の20:00時点で「第1試合があと1〜2名不足しているが、2戦目から合流できる人がいる」場合、Discordに「1試合目だけのピンポイント助っ人急募」通知が自動投稿されます！
          </div>
        </div>
      </div>

      {/* 3. 特殊ルール（アラームカスタム・ハンディキャップ） */}
      <div className="bg-white/80 border border-stone-200/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-700">
            <Flame size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-stone-900">3. 特殊カスタムルール（企画マッチ）</h3>
            <p className="text-xs text-stone-500">定期イベントや突発企画で開催される特別レギュレーション</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* アラームカスタム */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-black">
                ⏰ アラームカスタム
              </span>
              <span className="text-xs font-bold text-stone-500">（時間制限サドンデス）</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed font-medium">
              インゲームタイマーが一定分（例：25分）に達した瞬間、<strong>「全員リコールしてMIDレーンに集合・全員で最終決戦集団戦を行う」</strong>特別ルールです。<br />
              レーン戦での有利を活かすか、集団戦構成で逆転を狙うかの駆け引きが楽しめます。
            </p>
          </div>

          {/* BO3 シリーズマッチ */}
          <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-black">
                🏆 BO3 シリーズマッチ
              </span>
              <span className="text-xs font-bold text-stone-500">（2本先取・サイド交代）</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed font-medium">
              同一メンバーで2本先取（最大3試合）を戦う本格シリーズ。第1試合で敗北したチームが第2試合の<strong>「サイド選択権（Blue / Red）」</strong>を獲得します。
              ポータルのバランサー画面からスコアボード・サイド交代をワンクリックで管理できます。
            </p>
          </div>
        </div>
      </div>

      {/* 4. マナー ＆ エチケット */}
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-stone-100 rounded-3xl p-6 md:p-8 shadow-md space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
          <ShieldAlert size={18} />
          <span>KTM カスタムの心得（マナー ＆ エチケット）</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-stone-300 leading-relaxed font-medium">
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>🤝 リスペクトと楽しむ心</span>
            </div>
            <p>ミスを責めず、良いプレイをお互いに称え合いましょう！</p>
          </div>
          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>🎁 GG＆お疲れ様コール</span>
            </div>
            <p>試合終了後は勝敗にかかわらず「ナイスゲーム！」「GG！」と気持ちよく挨拶しましょう。</p>
          </div>
        </div>
      </div>

    </div>
  );
}
