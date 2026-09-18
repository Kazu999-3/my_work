/**
 * 👁️ 対面・敵チャンピオン別のコントロールワード（ピンクワード）警戒ルール＆アドバイス
 */

export type VisionThreatLevel = 'CRITICAL' | 'HIGH' | 'STANDARD';

export interface VisionAlertRule {
  championName: string;
  threatLevel: VisionThreatLevel;
  badgeLabel: string;
  title: string;
  reason: string;
  timingAdvice: string;
  placementAdvice: string;
  recommendedItem?: string;
}

export const VISION_ALERT_DATABASE: Record<string, VisionAlertRule> = {
  Evelynn: {
    championName: 'Evelynn',
    threatLevel: 'CRITICAL',
    badgeLabel: '🔴 カモフラージュ奇襲（通常ワード無効）',
    title: 'Lv6以降はコントロールワードのみが命綱！',
    reason: 'Lv6以降の常時カモフラージュは黄色ワードでは映りません。ブッシュ内に設置したコントロールワードでのみ侵入を事前に察知できます。',
    timingAdvice: '4分〜5分台（イブリンのLv6到達前）の1stリコールで75Gを残して必ず購入。',
    placementAdvice: '川の浅瀬中央のピントブッシュ、または自陣ジャングル入口（赤/青バフ裏の交差点）。',
    recommendedItem: 'コントロールワード ＆ オラクルレンズ（Lv6〜）',
  },
  Shaco: {
    championName: 'Shaco',
    threatLevel: 'CRITICAL',
    badgeLabel: '🔴 インビジブル＋瞬間ブリンク急襲',
    title: '通常ルート外からの裏周りガンクに警戒！',
    reason: 'Qの長距離ステルスブリンクにより、通常の川ブッシュ手前を無視して背後から襲いかかります。ボックス（W）の無力化にも視界が必須です。',
    timingAdvice: 'Lv1〜Lv3の早期インベード・ガンクに備え、1stリコールで即購入。',
    placementAdvice: '川の奥深く（ドラゴン/リフトヘラルド裏）やレーン背後の三叉路・壁際ブッシュ。',
    recommendedItem: 'コントロールワード ＆ オラクルレンズ（ボックス探査）',
  },
  Twitch: {
    championName: 'Twitch',
    threatLevel: 'CRITICAL',
    badgeLabel: '🔴 長距離ステルス＋奇襲急襲',
    title: 'レーン中央・斜めからの突撃を事前に防ぐ！',
    reason: 'Qによるカモフラージュで通常視界をすり抜けて一気にキルラインに持ち込んできます。姿が見えた瞬間にはすでに毒スタックを積まれています。',
    timingAdvice: '対面または敵ジャングルにいる場合、1stリコールで必ず1本確保。',
    placementAdvice: 'レーン中央の端（ブッシュ外・ミニオン通過線横）や川の合流ブッシュ。',
  },
  Akshan: {
    championName: 'Akshan',
    threatLevel: 'HIGH',
    badgeLabel: '🟠 無限カモフラージュ＋ローム急襲',
    title: '壁際走行での超高速ガンクを遮断！',
    reason: 'Wで壁際を走る間は永続カモフラージュ状態になります。通常ワードに映らず川を渡って他レーンを急襲します。',
    timingAdvice: 'ロームが活発化するLv4〜Lv6以降、リコールごとに常備。',
    placementAdvice: '川の要所（ピクセルブッシュ・ドラゴン前壁際）。',
  },
  Rengar: {
    championName: 'Rengar',
    threatLevel: 'HIGH',
    badgeLabel: '🟠 ウルトカモフラージュ＋長距離飛びつき',
    title: '頭上の目玉マーク前に防衛線を敷く！',
    reason: 'Rを発動して接近してくる間は通常視界に映りません。ブッシュを介したリープで即死バーストを出されます。',
    timingAdvice: 'Lv6以降、孤立ファームする際は必ず足元にコントロールワードを設置。',
    placementAdvice: '自陣タワー手前のブッシュ、またはファームするサイドレーン側の川ブッシュ。',
  },
  Pyke: {
    championName: 'Pyke',
    threatLevel: 'HIGH',
    badgeLabel: '🟠 潜行フック＋視界消去パッシブ',
    title: 'ブッシュ潜行を看破してフックを回避！',
    reason: 'Wで潜行してブッシュに隠れ、チャージQで引き寄せてきます。ブッシュ内の視界優位を取られないことが最重要。',
    timingAdvice: '序盤レーン戦の1stリコールでサポート・ADC共に75G残し購入。',
    placementAdvice: 'ボットレーン側の中央ブッシュ、または川のトライブッシュ。',
  },
  Talon: {
    championName: 'Talon',
    threatLevel: 'HIGH',
    badgeLabel: '🟠 壁越え（E）＋ウルトステルス急襲',
    title: '地形を無視した高速ロームを早期察知！',
    reason: 'Eで壁を跳び越えて視界のない暗がりから急接近し、Rのインビジブルで接近・離脱を行います。',
    timingAdvice: 'タロンがLv6を迎える直前、サイドレーナーは必ず警戒ワードを配置。',
    placementAdvice: '川の壁裏ルート、ジャングル連絡路の開けた交差点。',
  },
  Teemo: {
    championName: 'Teemo',
    threatLevel: 'HIGH',
    badgeLabel: '🟠 ステルス待ち伏せ＋キノコ地雷原',
    title: 'キノコ（R）を踏む前にコントロールワードで無力化！',
    reason: 'オブジェクト前やブッシュ内に大量のキノコを埋めてきます。コントロールワードを置くだけで周辺のキノコがすべて可視化・無力化されます。',
    timingAdvice: 'Lv6以降、リコール時はオラクルレンズへの交換とピンク常時2本買いを徹底。',
    placementAdvice: 'ドラゴン/バロンピット前、川の重要ブッシュ入口。',
    recommendedItem: 'コントロールワード 2本 ＆ オラクルレンズ必須',
  },
  Kayn: {
    championName: 'Kayn',
    threatLevel: 'HIGH',
    badgeLabel: '🟠 壁抜けガンク（E・シャドウステップ）',
    title: '通常の川ではなく「壁の出口」に視界を置く！',
    reason: 'Eで壁の中から直接レーンに侵入してくるため、通常の川ブッシュにワードを置いても通過を検知できません。',
    timingAdvice: '1stリコール時。壁沿いにプッシュする際は即設置。',
    placementAdvice: '自陣タワー横の壁出口、レーン背後の厚い壁の切れ目。',
  },
  Zac: {
    championName: 'Zac',
    threatLevel: 'HIGH',
    badgeLabel: '🟠 超長距離スリングショット急襲（E）',
    title: '川の手前ではなく「ジャンプの溜め地点」を照らす！',
    reason: 'Eのチャージにより、F6裏や壁の向こうなど視界外の遥か遠くから直接レーン中央へ飛び込んできます。',
    timingAdvice: 'Lv4以降（Eの射程が伸びるタイミング）。',
    placementAdvice: '相手側のF6（ラプター）裏、ドラゴン/バロンピット裏の壁際ディープ視界。',
  },
  Fiddlesticks: {
    championName: 'Fiddlesticks',
    threatLevel: 'HIGH',
    badgeLabel: '🟠 壁裏からの奇襲集団戦ウルト（R）',
    title: '集団戦前に壁裏の死角ブッシュをすべて検問！',
    reason: '視界外からのR（クロウストーム）発動で全体恐怖＋大ダメージを与えてきます。壁裏の視界さえあれば完全に無力化できます。',
    timingAdvice: '中盤以降のオブジェクト戦前、必ず1〜2本保持して前哨ブッシュをクリア。',
    placementAdvice: 'ピット裏の孤立ブッシュ、ジャングル内のクランク壁裏。',
    recommendedItem: 'コントロールワード ＆ オラクルレンズ',
  },
  Nocturne: {
    championName: 'Nocturne',
    threatLevel: 'HIGH',
    badgeLabel: '🟠 暗闇ダイブ（R・パラノイア）',
    title: 'Lv6前に周回位置を特定してウルト発動を阻止！',
    reason: 'Rが発動すると全味方の視界が奪われるため、発動されてからでは逃げられません。事前にジャングル内に視界を敷いて位置を特定するのが唯一の対策です。',
    timingAdvice: 'Lv6前（4〜5分台）に敵ジャングル入口にディープ設置。',
    placementAdvice: '敵赤/青バフ周辺の交差点、川の横断路。',
  },
  Akali: {
    championName: 'Akali',
    threatLevel: 'STANDARD',
    badgeLabel: '🟡 煙幕ステルス（W・薄暮の帳）',
    title: 'ファイト中の煙幕逃走・再突入を抑え込む！',
    reason: 'Wの煙幕で姿を消し、スキルのクールダウンを稼がれます。ブッシュ内ファイト時はピンクワードで視界確保が有利に働きます。',
    timingAdvice: 'オールイン戦が発生するLv6前後に1本保持。',
    placementAdvice: 'レーン中央のブッシュ内（ファイトが発生しやすい場所）。',
  },
  KhaZix: {
    championName: 'KhaZix',
    threatLevel: 'STANDARD',
    badgeLabel: '🟡 孤立狩り＋ウルトインビジブル',
    title: '孤立地帯の安全確保と奇襲ルート警戒！',
    reason: 'Rのインビジブルと高い機動性で暗がりから奇襲を仕掛けてきます。リバーのコントロールワードで侵入を防ぎます。',
    timingAdvice: '1stリコール時。',
    placementAdvice: 'リバーピクセルブッシュ、自陣ジャングルへの侵入路。',
  },
  LeeSin: {
    championName: 'LeeSin',
    threatLevel: 'STANDARD',
    badgeLabel: '🟡 序盤超攻撃的ガンク（Lv3パワースパイク）',
    title: 'Lv3の早回し・川通過をキャッチする！',
    reason: '序盤の交戦力が極めて高く、川を通ってサイドレーンへ積極的にガンクを仕掛けてきます。',
    timingAdvice: '1stリコールで75G残し、早期に川の主導権を確保。',
    placementAdvice: 'カニ（スカトル）前のピクセルブッシュ、自陣トライブッシュ。',
  },
  Elise: {
    championName: 'Elise',
    threatLevel: 'STANDARD',
    badgeLabel: '🟡 タワーダイブ急襲（蜘蛛形態E）',
    title: 'ローHP時のタワー下ダイブを未然に察知！',
    reason: '蜘蛛Eのタゲ切りにより、タワー下でも強引にダイブキルを狙ってきます。ウェーブが押し込まれる前に接近を察知することが肝心。',
    timingAdvice: '序盤3分〜5分台。',
    placementAdvice: '自陣タワー裏のブッシュ、または川入口。',
  },
};

/**
 * チャンピオン名から視界警戒ルールを取得
 */
export function getVisionAlertRule(championName?: string): VisionAlertRule | null {
  if (!championName) return null;
  const clean = championName.trim();

  // 完全一致または前方一致
  for (const [key, rule] of Object.entries(VISION_ALERT_DATABASE)) {
    if (key.toLowerCase() === clean.toLowerCase()) {
      return rule;
    }
  }

  return null;
}
