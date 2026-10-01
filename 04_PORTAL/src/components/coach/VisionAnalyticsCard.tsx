'use client';

import React, { useState } from 'react';
import {
  Eye,
  ShieldCheck,
  MapPin,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Compass,
  CheckCircle2,
  HelpCircle,
  ShoppingBag,
  Clock,
  Shield,
  Coins,
} from 'lucide-react';
import { KAZURIN_VISION_METRICS, KAZURIN_STYLE_PROFILE, PROFILE_SNAPSHOT_DATE } from '../../lib/playerStyleProfile';

export default function VisionAnalyticsCard() {
  const vision = KAZURIN_VISION_METRICS;
  const p = KAZURIN_STYLE_PROFILE;
  const [selectedSpot, setSelectedSpot] = useState<number>(0);

  const DEEP_WARD_SPOTS = [
    {
      id: 'enemy_raptors',
      title: '① 敵ラプター裏ブッシュ (最重要)',
      timing: '3:30〜4:00 (1周目フルクリア直後)',
      target: '敵JGの赤バフ側周回・MID/BOTガンクの事前察知',
      benefit: '敵JGがラプターを触る瞬間が映るため、味方MIDとBOTが100%ガンクを回避可能。',
    },
    {
      id: 'enemy_blue_cross',
      title: '② 敵青バフ横・トライ交差点',
      timing: '4:30〜5:30 (ヴォイドグラブ前)',
      target: '敵JGの青サイド侵入・TOPガンク事前察知',
      benefit: 'グラブ湧き前の敵位置を確定させ、安全にヴォイドグラブを触れる。',
    },
    {
      id: 'dragon_deep_entry',
      title: '③ 敵赤バフ裏・リバー連絡通路',
      timing: 'ドラゴン湧き1分前 (4:00/9:00)',
      target: 'ドラゴンへの敵JG・BOTの寄りライン察知',
      benefit: 'ドラゴンファイト時の挟撃を未然に防ぎ、イニシエート権を奪取。',
    },
  ];

  return (
    <div className="rounded-3xl border border-border/90 bg-surface/95 p-5 md:p-6 shadow-xs space-y-5">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-50 border border-primary-edge-soft flex items-center justify-center text-xl text-primary-600 shadow-2xs shrink-0">
            👁️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-foreground">
                視界・マップコントロール客観解析
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 bg-primary-100 text-primary-900 border border-primary-edge-soft rounded-full">
                上位 {vision.visionRankPercentile}% (エメラルド級)
              </span>
            </div>
            <p className="text-[11px] text-muted-strong font-medium">
              視界診断とディープ配置戦略（{PROFILE_SNAPSHOT_DATE} 時点で手入力した固定値。自動更新はされません）
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs font-black text-primary-700">
            分間視界スコア {vision.visionScorePerMin} <span className="text-[10px] font-normal text-faint">/分</span>
          </div>
          <div className="text-[10px] text-success-600 font-bold">
            同帯平均 (1.18) 対比 +37%
          </div>
        </div>
      </div>

      {/* 4大メトリクスグリッド */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 分間視界スコア */}
        <div className="p-3 bg-background/80 rounded-2xl border border-border/70 space-y-1">
          <div className="text-[10px] font-bold text-muted-strong flex items-center justify-between">
            <span>分間視界 (VS/m)</span>
            <span className="text-primary-600 font-bold">上位18%</span>
          </div>
          <div className="text-base font-black text-foreground">
            {vision.visionScorePerMin}
          </div>
          <div className="text-[10px] text-muted-strong">
            エメラルド帯上位水準
          </div>
        </div>

        {/* コントロールワード */}
        <div className="p-3 bg-background/80 rounded-2xl border border-border/70 space-y-1">
          <div className="text-[10px] font-bold text-muted-strong flex items-center justify-between">
            <span>ピンクワード</span>
            <span className="text-success-600 font-bold">平均の2倍</span>
          </div>
          <div className="text-base font-black text-foreground">
            {vision.controlWardsPerGame} <span className="text-xs font-normal text-faint">本/戦</span>
          </div>
          <div className="text-[10px] text-success-700 font-bold">
            平均生存: {vision.controlWardAvgLifetimeSec}秒
          </div>
        </div>

        {/* ワード設置 */}
        <div className="p-3 bg-background/80 rounded-2xl border border-border/70 space-y-1">
          <div className="text-[10px] font-bold text-muted-strong">
            分間ワード設置
          </div>
          <div className="text-base font-black text-foreground">
            {vision.wardsPlacedPerMin} <span className="text-xs font-normal text-faint">個/分</span>
          </div>
          <div className="text-[10px] text-muted-strong">
            1戦 20〜25個
          </div>
        </div>

        {/* ワード破壊 */}
        <div className="p-3 bg-background/80 rounded-2xl border border-border/70 space-y-1">
          <div className="text-[10px] font-bold text-muted-strong">
            分間ワード破壊
          </div>
          <div className="text-base font-black text-foreground">
            {vision.wardsClearedPerMin} <span className="text-xs font-normal text-faint">個/分</span>
          </div>
          <div className="text-[10px] text-muted-strong">
            レンズ＆植物クリア
          </div>
        </div>
      </div>

      {/* 視界配置バランス（自陣防衛 76% vs 敵陣ディープ 24%） */}
      <div className="p-4 bg-background/60 rounded-2xl border border-border/80 space-y-3">
        <div className="flex items-center justify-between text-xs font-black text-foreground-soft">
          <span className="flex items-center gap-1.5">
            <Compass size={14} className="text-primary-600" />
            <span>視界配置バランス ＆ 侵入深度の客観データ</span>
          </span>
          <span className="text-[10px] text-muted-strong">
            防衛 {vision.defensiveWardRatioPercent}% / 敵陣攻め {vision.deepWardRatioPercent}%
          </span>
        </div>

        {/* スプリットバー */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-full rounded-full bg-surface-hover flex overflow-hidden shadow-inner">
            <div
              className="h-full bg-success-500"
              style={{ width: `${vision.defensiveWardRatioPercent}%` }}
              title={`自陣・リバー防衛視界: ${vision.defensiveWardRatioPercent}%`}
            />
            <div
              className="h-full bg-primary-500"
              style={{ width: `${vision.deepWardRatioPercent}%` }}
              title={`敵陣ディープ視界: ${vision.deepWardRatioPercent}%`}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-success-700 flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-success-500" />
              🛡️ 自陣・リバー防衛視界 ({vision.defensiveWardRatioPercent}%)
            </span>
            <span className="text-primary-700 flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />
              ⚡ 敵陣ディープ視界 ({vision.deepWardRatioPercent}%)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs pt-1">
          <div className="p-2.5 bg-success-50 rounded-xl border border-success-edge-soft text-foreground-subtle space-y-1">
            <span className="font-bold text-success-950 flex items-center gap-1">
              <span>✅</span> 驚異的な生存率（被デス 3.46）の源泉
            </span>
            <p className="text-[11px] text-muted leading-relaxed font-medium">
              自陣侵入経路とオブジェクト前の防衛視界が鉄壁なため、敵JGのインベードや事故死を未然に防げています。
            </p>
          </div>

          <div className="p-2.5 bg-primary-50 rounded-xl border border-primary-edge-soft text-foreground-subtle space-y-1">
            <span className="font-bold text-primary-950 flex items-center gap-1">
              <span>⚠️</span> 15分キル関与（KP@15 35%）向上の急所
            </span>
            <p className="text-[11px] text-muted leading-relaxed font-medium">
              敵陣深部へのワードが24%に留まるため、敵JGの初動察知がレーン到達直前になりがちです。敵陣視界を増やすことで味方の被ガンクを劇的に減らせます。
            </p>
          </div>
        </div>
      </div>

      {/* 🎯 3:30 黄金のディープワードスポット3選 */}
      <div className="space-y-2.5">
        <div className="text-xs font-black text-foreground-soft flex items-center gap-1.5">
          <MapPin size={14} className="text-primary-600" />
          <span>🎯 勝率を跳ね上げる「黄金のディープワードスポット 3選」</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {DEEP_WARD_SPOTS.map((spot, idx) => {
            const isSelected = selectedSpot === idx;
            return (
              <button
                key={spot.id}
                type="button"
                onClick={() => setSelectedSpot(idx)}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? 'border-primary-edge-strong bg-primary-50/80 shadow-xs ring-2 ring-primary-400/30'
                    : 'border-border bg-surface hover:bg-background'
                }`}
              >
                <div className="text-xs font-black text-foreground truncate">
                  {spot.title}
                </div>
                <div className="text-[10px] font-bold text-primary-700">
                  ⏰ {spot.timing}
                </div>
                <div className="text-[10px] text-muted-strong line-clamp-2">
                  {spot.target}
                </div>
              </button>
            );
          })}
        </div>

        {/* 選択スポットの詳細解説カード */}
        <div className="p-3.5 bg-primary-50/60 rounded-2xl border border-primary-edge-soft/80 space-y-1.5 animate-in fade-in">
          <div className="text-xs font-black text-primary-950 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-primary-600" />
            <span>{DEEP_WARD_SPOTS[selectedSpot].title} の戦術メリット:</span>
          </div>
          <p className="text-xs text-foreground-soft font-medium leading-relaxed">
            {DEEP_WARD_SPOTS[selectedSpot].benefit}
          </p>
        </div>
      </div>

      {/* 🔴 コントロールワード（ピンクワード）最適購入タイミング＆運用黄金ルール */}
      <div className="p-4 md:p-5 bg-danger-50/40 rounded-3xl border border-danger-edge-soft/80 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-danger-edge-soft pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-danger-100 text-danger-700 flex items-center justify-center font-black text-xs shadow-2xs">
              🔴
            </span>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-foreground flex items-center gap-1.5">
                <span>コントロールワード 最適購入タイミング ＆ 運用黄金ルール</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-danger-100 text-danger-800 rounded">
                  75Gの投資対効果最大化
                </span>
              </h4>
              <p className="text-[11px] text-muted-strong font-medium">
                「いつ買い、いつ買ってはいけないか」の明確な基準
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-danger-700 bg-surface px-2 py-0.5 rounded-full border border-danger-edge-soft">
            常時1本所持推奨
          </span>
        </div>

        {/* 4つのベスト購入タイミング */}
        <div className="space-y-2">
          <span className="text-[11px] font-black text-foreground-subtle flex items-center gap-1">
            <Coins size={13} className="text-primary-600" />
            <span>ベストな購入タイミング（迷わず買う瞬間）:</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 bg-surface rounded-2xl border border-border shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-black">
                <span className="text-danger-700 flex items-center gap-1">
                  <Clock size={12} /> 1. 1stリコール時 (4:00〜5:30)
                </span>
                <span className="text-[10px] text-faint font-normal">余剰75G〜150G時</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed font-medium">
                素材アイテムや靴を買った後に75G以上余ったら即1本購入。敵ラプター裏やヴォイドグラブ連絡路に刺すことで、敵JGの初動を完全制圧できます。
              </p>
            </div>

            <div className="p-3 bg-surface rounded-2xl border border-border shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-black">
                <span className="text-danger-700 flex items-center gap-1">
                  <Clock size={12} /> 2. 主要オブジェクト湧き1分前
                </span>
                <span className="text-[10px] text-faint font-normal">ドラゴン / グラブ / バロン前</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed font-medium">
                湧き45秒〜1分前のリコールで必ず1〜2本確保。敵の視界を消滅（デニス）させて相手フェイスチェックを誘い、先制エンゲージの起点を作ります。
              </p>
            </div>

            <div className="p-3 bg-surface rounded-2xl border border-border shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-black">
                <span className="text-danger-700 flex items-center gap-1">
                  <Clock size={12} /> 3. 1コア完成パワースパイク直後
                </span>
                <span className="text-[10px] text-faint font-normal">サイドプッシュ準備</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed font-medium">
                第1コア完成のお釣りで購入。強い時間帯にサイドレーンを押し込む際、敵JGの裏回りルートに置くことで1v1でのキルチャンスと安全を両立できます。
              </p>
            </div>

            <div className="p-3 bg-surface rounded-2xl border border-border shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-black">
                <span className="text-danger-700 flex items-center gap-1">
                  <Clock size={12} /> 4. 20分以降のバロンセットアップ
                </span>
                <span className="text-[10px] text-faint font-normal">チーム全員で暗黒化</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed font-medium">
                サポートだけに任せず、チーム全員でピンクワードを1本ずつ持ち寄りバロンピット周囲を完全暗黒化。敵が視界を取りに来た瞬間をキャッチして試合を決定づけます。
              </p>
            </div>
          </div>
        </div>

        {/* ⚠️ 買ってはいけないNGタイミング ＆ ロール別基準 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
          {/* 買ってはいけないNGタイミング */}
          <div className="p-3 bg-primary-50/80 rounded-2xl border border-primary-edge-soft space-y-1.5">
            <span className="text-xs font-black text-primary-950 flex items-center gap-1">
              <AlertTriangle size={13} className="text-primary-700" />
              <span>⚠️ 買ってはいけないNGタイミング（テンポロス）</span>
            </span>
            <ul className="text-[11px] text-foreground-subtle space-y-1 font-medium">
              <li className="flex items-start gap-1">
                <span className="text-primary-600 font-bold">•</span>
                <span><strong>コアアイテム完成が75G遅れる時:</strong> 次のパワースパイク（例: ロストチャプターや完成品）があと75Gで届く場合は、ピンクワードを我慢して装備完成を最優先。</span>
              </li>
              <li className="flex items-start gap-1">
                <span className="text-primary-600 font-bold">•</span>
                <span><strong>置く場所・目的が決まっていない時:</strong> 買ったままインベントリで5分間放置されるピンクワードは「75Gの死に金」。置く予定のブッシュを頭に描いてから購入すること。</span>
              </li>
            </ul>
          </div>

          {/* ロール別推奨購入目安 */}
          <div className="p-3 bg-background rounded-2xl border border-border space-y-1.5">
            <span className="text-xs font-black text-foreground flex items-center gap-1">
              <Shield size={13} className="text-primary-600" />
              <span>ロール別 1試合あたりの推奨購入目安</span>
            </span>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] pt-0.5">
              <div className="p-1.5 bg-surface rounded-xl border border-border">
                <span className="text-faint font-bold block">TOP / BOT</span>
                <span className="text-foreground font-black text-xs">2〜3本</span>
                <span className="text-[9px] text-muted-strong block">リバー防衛</span>
              </div>
              <div className="p-1.5 bg-surface rounded-xl border border-border">
                <span className="text-faint font-bold block">JG / MID</span>
                <span className="text-primary-700 font-black text-xs">4〜6本</span>
                <span className="text-[9px] text-muted-strong block">ディープ・オブジェクト</span>
              </div>
              <div className="p-1.5 bg-surface rounded-xl border border-border">
                <span className="text-faint font-bold block">SUPPORT</span>
                <span className="text-success-700 font-black text-xs">6〜10本</span>
                <span className="text-[9px] text-muted-strong block">常時2本所持・デニス</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
