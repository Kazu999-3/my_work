import Link from 'next/link';
import { ArrowLeft, Coins, Info, AlertTriangle } from 'lucide-react';

/**
 * カジノ ルール ＆ 確率一覧ページ
 *
 * ⚠️ このページの数値は「実装から実測した値」であり、雰囲気で書いてはならない。
 * 配当テーブルや抽選確率を変更したら必ず `node scripts/casino_rtp_report.js` を実行し、
 * 出力された実測値でこのページを更新すること。
 * （2026-09-22 実測。スロットは固定テーブルのため解析値、他は200万回試行）
 */
export const metadata = {
  title: 'カジノ ルール ＆ 確率 | KTM Portal',
  description: 'KTMカジノ各ゲームのルール、配当、当選確率、還元率(RTP)の一覧。',
};

// 静的な内容のみのページ。1日キャッシュして構わない。
export const revalidate = 86400;

const CARD = 'rounded-2xl border border-stone-300 bg-white/70 p-5 md:p-6 shadow-sm';
const H2 = 'text-lg md:text-xl font-black text-stone-900 flex items-center gap-2 mb-1';
const TH = 'text-left font-black text-stone-600 text-[11px] uppercase tracking-wide px-3 py-2';
const TD = 'px-3 py-2 text-stone-800 border-t border-stone-200';

/** 還元率バッジ。数値そのままを出し、良し悪しを色で補足する */
function RtpBadge({ rtp }: { rtp: number }) {
  const tone =
    rtp >= 0.95
      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
      : rtp >= 0.9
      ? 'bg-amber-50 text-amber-900 border-amber-300'
      : 'bg-rose-50 text-rose-900 border-rose-300';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-black ${tone}`}>
      RTP {(rtp * 100).toFixed(1)}%
    </span>
  );
}

const SLOT_ROWS = [
  { label: '💎 Hextechジェム ×3', prob: '0.2%', mult: '×50' },
  { label: '👾 バロンナッシャー ×3', prob: '1.0%', mult: '×15' },
  { label: '🐉 ドラゴン ×3', prob: '3.0%', mult: '×5' },
  { label: '🗡️ ドランブレード ×3', prob: '7.0%', mult: '×3' },
  { label: '🐹 ポロ ×3', prob: '12.0%', mult: '×2' },
  { label: '💎 Hextechジェム ×2', prob: '2.0%', mult: '×1.5' },
  { label: '🐹 ポロ ×2', prob: '5.0%', mult: '×1（元返し）' },
  { label: 'ハズレ', prob: '69.8%', mult: '×0' },
];

const BACCARAT_ROWS = [
  { label: 'PLAYER', prob: '44.6%', mult: '×2.00', rtp: '98.6%', edge: '1.4%' },
  { label: 'BANKER', prob: '45.9%', mult: '×1.95', rtp: '99.1%', edge: '0.9%' },
  { label: 'TIE（引き分け）', prob: '9.5%', mult: '×9.00', rtp: '85.8%', edge: '14.2%' },
];

const CRASH_ROWS = [
  { target: '1.1x', reach: '87.3%' },
  { target: '1.5x', reach: '64.0%' },
  { target: '2.0x', reach: '48.0%' },
  { target: '3.0x', reach: '32.0%' },
  { target: '5.0x', reach: '19.2%' },
  { target: '10x', reach: '9.6%' },
  { target: '20x', reach: '4.8%' },
  { target: '50x', reach: '1.9%（上限）' },
];

const OMIKUJI_ROWS = [
  { label: '👑 大大吉', prob: '10%', coins: '+300' },
  { label: '🌟 大吉', prob: '25%', coins: '+200' },
  { label: '🎯 中吉', prob: '40%', coins: '+150' },
  { label: '🍀 小吉', prob: '25%', coins: '+100' },
];

export default function CasinoRulesPage() {
  return (
    <div className="min-h-screen pb-16 bg-[#eae4d4] text-[#201c2b]">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 py-8 px-4 md:px-6 border-b border-amber-500/30">
        <div className="max-w-4xl mx-auto space-y-3">
          <Link
            href="/casino"
            className="inline-flex items-center gap-1.5 text-xs font-black text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft size={14} />
            カジノへ戻る
          </Link>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-stone-900 flex items-center gap-2.5">
            <Coins className="text-amber-600" size={28} />
            ルール ＆ 確率一覧
          </h1>
          <p className="text-stone-700 text-xs md:text-sm font-medium max-w-2xl">
            各ゲームの当選確率と還元率（RTP）をすべて公開しています。数値は実際の抽選コードを
            200万回試行して実測したものです。
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* RTPの説明 */}
        <div className="rounded-2xl border border-stone-300 bg-stone-100/80 p-5">
          <h2 className="text-sm font-black text-stone-900 flex items-center gap-2 mb-2">
            <Info size={16} className="text-stone-600" />
            還元率（RTP）の読み方
          </h2>
          <p className="text-xs md:text-sm text-stone-700 leading-relaxed">
            RTP は「賭けたコインのうち、長期的に平均して手元へ戻ってくる割合」です。
            RTP 96% なら、100コイン賭けるごとに平均4コインずつ減っていきます。
            <strong className="text-stone-900">
              どのゲームも RTP は100%未満なので、長く遊べば遊ぶほど必ず減ります。
            </strong>
            短期的には大きく増えることもありますが、それは運によるブレです。
          </p>
        </div>

        {/* スロット */}
        <section className={CARD}>
          <h2 className={H2}>
            🎰 Hextechスロット <RtpBadge rtp={0.93} />
          </h2>
          <p className="text-xs text-stone-600 mb-3">
            ベット額は 100 / 500 / 1000 コインの3択。3つのリールが揃うと配当が発生します。
            15倍以上が出るとDiscordへ自動で祝賀通知が飛びます。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-stone-100">
                  <th className={TH}>出目</th>
                  <th className={TH}>確率</th>
                  <th className={TH}>配当</th>
                </tr>
              </thead>
              <tbody>
                {SLOT_ROWS.map((r) => (
                  <tr key={r.label}>
                    <td className={TD}>{r.label}</td>
                    <td className={`${TD} font-mono`}>{r.prob}</td>
                    <td className={`${TD} font-mono font-black`}>{r.mult}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">
            何かしらの配当が出る確率は 30.2%。ハウスエッジ（胴元の取り分）は 7.0% です。
          </p>
        </section>

        {/* バカラ */}
        <section className={CARD}>
          <h2 className={H2}>
            🃏 KTMバカラ <RtpBadge rtp={0.991} />
          </h2>
          <p className="text-xs text-stone-600 mb-3">
            8デッキを使った本格ルール（ナチュラル8・9、プレイヤー5以下ドロー、バンカーの3枚目条件表）で進行します。
            最低ベットは10コイン。<strong>TIE が出たとき、PLAYER / BANKER に賭けていた場合は掛け金が全額返還</strong>されます。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-stone-100">
                  <th className={TH}>賭け先</th>
                  <th className={TH}>勝率</th>
                  <th className={TH}>配当</th>
                  <th className={TH}>RTP</th>
                  <th className={TH}>ハウスエッジ</th>
                </tr>
              </thead>
              <tbody>
                {BACCARAT_ROWS.map((r) => (
                  <tr key={r.label}>
                    <td className={`${TD} font-black`}>{r.label}</td>
                    <td className={`${TD} font-mono`}>{r.prob}</td>
                    <td className={`${TD} font-mono font-black`}>{r.mult}</td>
                    <td className={`${TD} font-mono`}>{r.rtp}</td>
                    <td className={`${TD} font-mono`}>{r.edge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <AlertTriangle size={15} className="text-amber-700 mt-0.5 shrink-0" />
            <p className="text-[11px] md:text-xs text-amber-900 leading-relaxed">
              <strong>TIE は配当9倍と大きい代わりに、ハウスエッジが 14.2% と他の2つの10倍以上あります。</strong>
              これは本場のバカラでも同じ性質です。コインを長持ちさせたいなら BANKER（エッジ 0.9%）が最も有利です。
            </p>
          </div>
        </section>

        {/* クラッシュ */}
        <section className={CARD}>
          <h2 className={H2}>
            🚀 ポロ・クラッシュ <RtpBadge rtp={0.96} />
          </h2>
          <p className="text-xs text-stone-600 mb-3">
            ベット額は 50 / 100 / 300 / 500 / 1000 コイン。倍率が時間とともに上昇し、好きなタイミングで利確できます。
            ロケットが爆発する前に利確できれば「ベット額 × 利確倍率」を獲得、間に合わなければ全額没収です。
            クラッシュする倍率はゲーム開始時にサーバー側で決定され、外部からは一切見えません。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-stone-100">
                  <th className={TH}>利確目標</th>
                  <th className={TH}>到達する確率</th>
                  <th className={TH}>RTP</th>
                </tr>
              </thead>
              <tbody>
                {CRASH_ROWS.map((r) => (
                  <tr key={r.target}>
                    <td className={`${TD} font-mono font-black`}>{r.target}</td>
                    <td className={`${TD} font-mono`}>{r.reach}</td>
                    <td className={`${TD} font-mono`}>96.0%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">
            約5%の確率で 1.00倍のまま即クラッシュします。最大倍率は 50倍です。
            <strong className="text-stone-700">
              どの倍率を狙っても RTP は 96% で一定
            </strong>
            なので、「低く刻む方が得」「高く狙う方が得」というような有利不利はありません。狙う倍率は好みで選べます。
          </p>
        </section>

        {/* 勝敗予想ベット */}
        <section className={CARD}>
          <h2 className={H2}>🎯 勝敗予想ベット</h2>
          <p className="text-xs text-stone-600 mb-3">
            開催中のカスタムで BLUE / RED どちらが勝つかに賭けます。
            <strong>出場選手は自分の試合にベットできません。</strong>
          </p>
          <ul className="text-xs md:text-sm text-stone-700 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              オッズはパリミュチュエル方式（<span className="font-mono">0.95 ÷ その陣営への投票比率</span>）で、
              <strong>人気のない側ほど高配当</strong>になります。
            </li>
            <li>
              オッズの範囲は <span className="font-mono font-black">1.15倍 〜 10.0倍</span>。
              まだ誰も賭けていないときは BLUE 1.85倍 / RED 1.95倍 から始まります。
            </li>
            <li>
              適用されるオッズは<strong>ベットした瞬間の投票状況でサーバーが確定</strong>させます。
              あとから投票が偏っても、確定済みのオッズは変わりません。
            </li>
            <li>
              連勝ボーナス: 2連勝 +5% / 3連勝 +10% / 5連勝以上 +20%（配当倍率に上乗せ）。
            </li>
            <li>ベット額の5%がサーバー共有ジャックポット金庫へ積み立てられます。</li>
          </ul>
        </section>

        {/* おみくじ */}
        <section className={CARD}>
          <h2 className={H2}>🎋 デイリーおみくじ</h2>
          <p className="text-xs text-stone-600 mb-3">
            1日1回、無料で引けます。日本時間の 0:00 に切り替わります。平均獲得は 165コイン/日です。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-stone-100">
                  <th className={TH}>結果</th>
                  <th className={TH}>確率</th>
                  <th className={TH}>獲得コイン</th>
                </tr>
              </thead>
              <tbody>
                {OMIKUJI_ROWS.map((r) => (
                  <tr key={r.label}>
                    <td className={TD}>{r.label}</td>
                    <td className={`${TD} font-mono`}>{r.prob}</td>
                    <td className={`${TD} font-mono font-black`}>{r.coins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">
            💸 <strong>破産救済保険</strong>: 残高が100コイン未満のとき、月1回だけ +300コインを受け取れます。
          </p>
        </section>

        {/* 宝くじ */}
        <section className={CARD}>
          <h2 className={H2}>🎟️ 週末メガ宝くじ</h2>
          <p className="text-xs text-stone-600 mb-3">
            ショップで1口100コインで購入し、毎週日曜22:00に抽選します。口数を増やすほど当選しやすくなります。
          </p>
          <ul className="text-xs md:text-sm text-stone-700 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              <strong>🥇 1等（ジャックポット総取り）</strong>: 毎回 8% の確率で当選者が出ます。
              当たった人は金庫の全額を獲得。誰も当たらなければ全額が翌週へ繰り越されます。
            </li>
            <li>
              <strong>🥈 2等（ラッキー賞）</strong>: 毎回必ず1口が当選し、売上の10%（上限1,000コイン）を獲得します。
            </li>
            <li>
              <strong>🥉 3等（参加還元賞）</strong>: 購入した全員が、1口につき30コインを受け取れます（1等・2等に当たった人も対象）。
            </li>
          </ul>
          <p className="text-[11px] text-stone-500 mt-2">
            賞金はすべて当週の売上の中から配分されます（3等に30% / 2等に10% / 残り60%を金庫へ積立）。
            外部から新しいコインが追加されることはないため、宝くじはコインの再分配として機能します。
          </p>
        </section>

        {/* ジャックポット金庫 */}
        <section className={CARD}>
          <h2 className={H2}>💎 サーバー共有ジャックポット金庫</h2>
          <p className="text-xs text-stone-600 mb-3">
            全員で積み立てる共有の賞金プールです。次の2つの方法で総取りできます。
          </p>
          <ul className="text-xs md:text-sm text-stone-700 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              <strong>🔥 カスタムでペンタキルを達成し、その試合に勝利する</strong>: 試合結果がRiot APIと
              同期された時点で判定され、条件を満たした人が金庫を全額獲得します。
              <span className="text-stone-500">※ペンタキルを取っても負けた試合は対象外です。</span>
            </li>
            <li>
              <strong>🎟️ 週末メガ宝くじの1等を引く</strong>: 毎週日曜22:00の抽選で8%の確率。
            </li>
          </ul>
          <p className="text-[11px] text-stone-500 mt-2">
            積立は「勝敗予想ベット額の5%」「カスタム1試合につき100コイン」「宝くじ売上の60%」から行われます。
            金庫には上限があり、上限に達している間は積立が止まります。
          </p>
        </section>

        {/* 免責 */}
        <div className="rounded-2xl border border-stone-300 bg-stone-100/80 p-5">
          <p className="text-[11px] md:text-xs text-stone-600 leading-relaxed">
            コインはKTM内でのみ使える遊び用のポイントで、現金や現金価値のあるものとは一切交換できません。
            抽選はすべてサーバー側で行われ、結果は確定するまでクライアントへ送信されません。
            このページの数値は <span className="font-mono">scripts/casino_rtp_report.js</span> による実測値です
            （2026-09-22 時点）。
          </p>
        </div>
      </div>
    </div>
  );
}
