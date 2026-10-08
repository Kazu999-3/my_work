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
  Zap,
  Users
} from 'lucide-react';

export default function GuideRulesTab() {
  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* イントロダクション */}
      <div className="bg-surface/80 border border-border/90 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-500 text-stone-950 flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
            📜
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground tracking-tight">
              KTM カスタム公式ルールブック ＆ 特殊レギュレーション
            </h2>
            <p className="text-xs md:text-sm text-muted mt-1 leading-relaxed font-medium">
              KTMコミュニティで定期開催されるカスタムマッチのレギュレーション一覧です。<br />
              通常カスタムから日曜お祭りマッチ、アラームカスタム、BO3シリーズまで、安心して楽しくプレイするためのルールをまとめています。
            </p>
          </div>
        </div>
      </div>

      {/* 1. 定期カスタム 人数決め ＆ 開催優先度ルール */}
      <div className="bg-surface/80 dark:bg-surface/80 border border-border/90 dark:border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-stone-100 dark:border-border pb-4">
          <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-700 dark:text-primary-400">
            <Users size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-foreground dark:text-white">1. 定期カスタム 開催＆人数決め優先度ルール</h3>
            <p className="text-xs text-muted-strong">参加人数に応じた部屋分け・選出基準・開催判断の公式ガイドライン</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ① 20人揃えば2部屋開催 */}
          <div className="p-5 rounded-2xl bg-success-50/50 dark:bg-success-950/20 border border-success-edge-soft/80 dark:border-success-edge-strong/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-success-600 text-white text-xs font-black">
                ① 20名以上
              </span>
              <span className="text-xs font-bold text-success-700 dark:text-success-400">🎉 2部屋同時開催</span>
            </div>
            <h4 className="text-sm font-black text-foreground dark:text-white">👑 上位10名 ＆ 下位10名 スプリット</h4>
            <p className="text-xs text-muted leading-relaxed">
              MMR上位10名（上級部屋）とMMR下位10名（初中級部屋）に綺麗に分かれて同時開催！実力差が離れず、両部屋とも最高に白熱するマッチになります。
            </p>
          </div>

          {/* ② 10名以上の場合は2ランク格差防止（1ランク差選出） */}
          <div className="p-5 rounded-2xl bg-primary-50/50 dark:bg-primary-950/20 border border-primary-edge-soft/80 dark:border-primary-edge-strong/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-primary-500 text-stone-950 text-xs font-black">
                ② 10名〜19名
              </span>
              <span className="text-xs font-bold text-primary-800 dark:text-primary-300">⚔️ 1部屋 開催</span>
            </div>
            <h4 className="text-sm font-black text-foreground dark:text-white">🎯 2ランク格差防止（1ランク差以内で10名選出）</h4>
            <p className="text-xs text-muted leading-relaxed">
              「シルバー対プラチナ」のような2ランク差対戦を防ぐため、最多層に合わせて<strong>実力差が1ランク差以内の10名</strong>を自動選出！<br />
              （例：ゴールド最多なら「シルバー＋ゴールド」または「ゴールド＋プラチナ」のどちらかで開催し、シルバー対プラチナは同室になりません）<br />
              <span className="font-bold text-primary-900 dark:text-primary-200">※選考外となった方は「観戦・配信応援」または「2戦目に最優先で交代参加」となります。20名集まれば2部屋同時開催で全員出場可能です。</span>
            </p>
            <div className="mt-2 pt-2 border-t border-primary-edge-soft/60 text-[11px] text-primary-900 dark:text-primary-300 space-y-0.5">
              <p className="font-bold">📊 判定基準：</p>
              <p>・ソロQランクではなく<strong>KTM MMR（独自レート）</strong>を基準に公平に判定されます</p>
            </div>
          </div>

          {/* ③ 当日19時までに7名以下なら中止 */}
          <div className="p-5 rounded-2xl bg-background/80 dark:bg-stone-800/30 border border-border/80 dark:border-stone-700/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-stone-500 text-white text-xs font-black">
                ③ 7名以下
              </span>
              <span className="text-xs font-bold text-muted">💤 開催見送り（中止）</span>
            </div>
            <h4 className="text-sm font-black text-foreground dark:text-white">⏰ 当日19:00で確定判断</h4>
            <p className="text-xs text-muted leading-relaxed">
              当日19:00の時点で参加希望が7名以下の場合は開催中止とし、参加予定の方がソロキューや他の予定に切り替えられるようにします。
            </p>
          </div>
        </div>
      </div>

      {/* 2. 週末定期カスタムの基本フォーマット */}
      <div className="bg-surface/80 dark:bg-surface/80 border border-border/90 dark:border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-stone-100 dark:border-border pb-4">
          <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-700 dark:text-primary-400">
            <Swords size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-foreground dark:text-white">2. 週末定期カスタム（土曜・日曜）</h3>
            <p className="text-xs text-muted-strong">毎週土日 21:00〜 開催されるコミュニティ恒例マッチ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 土曜: ランク別・ガチカスタム */}
          <div className="p-5 rounded-2xl bg-primary-50/50 dark:bg-primary-950/20 border border-primary-edge-soft/80 dark:border-primary-edge-strong/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-primary-500 text-stone-950 text-xs font-black">
                土曜日 21:00〜
              </span>
              <span className="text-xs font-bold text-primary-800 dark:text-primary-300">⚔️ ランク別ガチ勝負</span>
            </div>
            <h4 className="text-sm font-black text-foreground dark:text-white">👑 土曜：バランス重視・実力伯仲カスタム</h4>
            <p className="text-xs text-muted leading-relaxed">
              KTM独自のMMRアルゴリズムに基づき、両チームの戦力が最も均等になるようにチーム分けを実施します。日頃の練習の成果を発揮する熱いバトルが楽しめます！
            </p>
            <ul className="text-xs text-muted space-y-1 pt-1">
              <li className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={14} className="text-primary-600 shrink-0" />
                <span>MMR自動均等分け（ロール適性・得意チャンピオン考慮）</span>
              </li>
              <li className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={14} className="text-primary-600 shrink-0" />
                <span>勝敗に応じたMMR変動あり</span>
              </li>
            </ul>
          </div>

          {/* 日曜: お祭りカスタム */}
          <div className="p-5 rounded-2xl bg-primary-50/50 dark:bg-primary-950/20 border border-primary-edge-soft/80 dark:border-primary-edge-strong/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg bg-primary-600 text-white text-xs font-black">
                日曜日 21:00〜
              </span>
              <span className="text-xs font-bold text-primary-700 dark:text-primary-300">🎪 ランク無差別・お祭り</span>
            </div>
            <h4 className="text-sm font-black text-foreground dark:text-white">🎲 日曜：完全ランダム・お祭りカスタム</h4>
            <p className="text-xs text-muted leading-relaxed">
              ランク・MMR・レート差を完全無視！ランダムシャッフルでチーム分けを行い、初心者から上級者までワイワイ盛り上がるお祭りナイトです。
            </p>
            <ul className="text-xs text-muted space-y-1 pt-1">
              <li className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={14} className="text-primary-600 shrink-0" />
                <span>MMR変動なし（完全カジュアル）</span>
              </li>
              <li className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={14} className="text-primary-600 shrink-0" />
                <span>オフメタピック・新チャンピオン練習大歓迎✨</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. スタイル別エントリー ＆ 途中参加システム */}
      <div className="bg-surface/80 border border-border/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-surface-subtle pb-4">
          <div className="p-2.5 rounded-xl bg-success-500/10 text-success-700">
            <Clock size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-foreground">2. スタイル別エントリー ＆ 2戦目交代システム</h3>
            <p className="text-xs text-muted-strong">仕事や予定に合わせて無理なく参加できる3つのスタイル</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-success-100 text-success-800 text-xs font-black">
                🟢 フル参加
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed font-medium">
              21:00の第1試合から最終戦までフルで参加する標準スタイルです。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-primary-100 text-primary-800 text-xs font-black">
                ⏱️ 1戦のみ
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed font-medium">
              「21時からは出られるけど次の日早いから1試合だけ」という方向け。第1試合終了後に自動で交代します。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-primary-100 text-primary-800 text-xs font-black">
                🌙 途中参加 (2戦目〜)
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed font-medium">
              「21時は間に合わないけど21:50頃からの第2試合なら出られる！」という方向け。第2試合開始時にスムーズに合流できます。
            </p>
          </div>
        </div>

        {/* ピンポイント助っ人急募について */}
        <div className="p-4 rounded-2xl bg-primary-500/10 border border-primary-edge-strong/30 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
          <div className="text-xs text-foreground-subtle leading-relaxed">
            <span className="font-black text-primary-950">🚨 20:00 ピンポイント助っ人通知システム：</span><br />
            開催当日の20:00時点で「第1試合があと1〜2名不足しているが、2戦目から合流できる人がいる」場合、Discordに「1試合目だけのピンポイント助っ人急募」通知が自動投稿されます！
          </div>
        </div>
      </div>

      {/* 3. 特殊ルール（アラームカスタム・ハンディキャップ） */}
      <div className="bg-surface/80 border border-border/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-surface-subtle pb-4">
          <div className="p-2.5 rounded-xl bg-danger-500/10 text-danger-700">
            <Flame size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-foreground">3. 特殊カスタムルール（企画マッチ）</h3>
            <p className="text-xs text-muted-strong">定期イベントや突発企画で開催される特別レギュレーション</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* アラームカスタム */}
          <div className="p-5 rounded-2xl bg-background border border-border/80 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-danger-600 text-white text-xs font-black">
                ⏰ アラームカスタム
              </span>
              <span className="text-xs font-bold text-muted-strong">（時間制限サドンデス）</span>
            </div>
            <p className="text-xs text-muted leading-relaxed font-medium">
              インゲームタイマーが一定分（例：25分）に達した瞬間、<strong>「全員リコールしてMIDレーンに集合・全員で最終決戦集団戦を行う」</strong>特別ルールです。<br />
              レーン戦での有利を活かすか、集団戦構成で逆転を狙うかの駆け引きが楽しめます。
            </p>
          </div>

          {/* BO3 シリーズマッチ */}
          <div className="p-5 rounded-2xl bg-background border border-border/80 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-primary-600 text-white text-xs font-black">
                🏆 BO3 シリーズマッチ
              </span>
              <span className="text-xs font-bold text-muted-strong">（2本先取・サイド交代）</span>
            </div>
            <p className="text-xs text-muted leading-relaxed font-medium">
              同一メンバーで2本先取（最大3試合）を戦う本格シリーズ。第1試合で敗北したチームが第2試合の<strong>「サイド選択権（Blue / Red）」</strong>を獲得します。
              ポータルのバランサー画面からスコアボード・サイド交代をワンクリックで管理できます。
            </p>
          </div>

          {/* 10人以上お祭り・ARAMローテーション ＆ ロールランダム5v5 */}
          <div className="p-5 rounded-2xl bg-background border border-border/80 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-primary-600 text-white text-xs font-black">
                🎲 10人以上お祭り ＆ ロールランダム5v5
              </span>
              <span className="text-xs font-bold text-muted-strong">（ARAM公平交代 / いつもと違うロール）</span>
            </div>
            <p className="text-xs text-muted leading-relaxed font-medium">
              参加者が10名を超えたお祭り・ARAMカスタムでは、全員の出場回数を公平化する自動交代システムが稼働します。<br />
              さらに新機能<strong>「ロールランダム5v5」</strong>を使えば、全員の希望レーンを完全ランダムにシャッフルしつつ、チーム間の総合MMRが互角になるよう自動調整！いつものメインレーンから離れて新鮮なバトルを楽しめます。
            </p>
          </div>
        </div>
      </div>

      {/* 4. マナー ＆ エチケット */}
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-stone-100 rounded-3xl p-6 md:p-8 shadow-md space-y-4">
        <div className="flex items-center gap-2 text-primary-400 font-black text-sm">
          <ShieldAlert size={18} />
          <span>KTM カスタムの心得（マナー ＆ エチケット）</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-faint leading-relaxed font-medium">
          <div className="p-3.5 rounded-xl bg-surface/5 border border-white/10 space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>🤝 リスペクトと楽しむ心</span>
            </div>
            <p>ミスを責めず、良いプレイをお互いに称え合いましょう！</p>
          </div>
          <div className="p-3.5 rounded-xl bg-surface/5 border border-white/10 space-y-1">
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
