'use client';

import React, { useState } from 'react';

interface JgProfile {
  name: string;
  jpName: string;
  type: 'フルクリア型' | '3キャンプ即ガンク型' | 'インベード型';
  clearSpeed: '超高速 (3:15以前)' | '標準 (3:20〜3:30)' | '低速/ガンク特化';
  defaultStart: string;
  scuttleAdvice: '⭕ 有利（戦うべき）' | '❌ 不利（逆サイドへ逃げるべき）' | '⚠️ レーン主導権次第';
  earlyDangerSkills: string[];
  keyCounterTips: string;
}

const JG_DATABASE: Record<string, JgProfile> = {
  LeeSin: {
    name: 'LeeSin',
    jpName: 'リー・シン',
    type: '3キャンプ即ガンク型',
    clearSpeed: '標準 (3:20〜3:30)',
    defaultStart: 'BOT側赤スタート（Lv3ガンクまたはスカトル待機）',
    scuttleAdvice: '⚠️ レーン主導権次第',
    earlyDangerSkills: ['Q (音波/響掌) - 命中時の大ダメージ', 'W (防護) - シールド＆離脱'],
    keyCounterTips: 'Lv3〜4の1v1が強力。Qを避ければ勝てるが、ブッシュ待ち伏せに注意。スカトルで無理に戦わず反対サイドへ逃げるのも有効。',
  },
  Viego: {
    name: 'Viego',
    jpName: 'ヴィエゴ',
    type: 'フルクリア型',
    clearSpeed: '標準 (3:20〜3:30)',
    defaultStart: 'フルクリア（BOT側赤または青）',
    scuttleAdvice: '⚠️ レーン主導権次第',
    earlyDangerSkills: ['W (亡霊の顎) - スタン突進', 'Q (滅びの王剣) - 連続突き'],
    keyCounterTips: 'Lv6前はCCを当てれば脆い。フルクリア後にガンクまたはスカトルに来るので、カウンターガンクを狙いやすい。',
  },
  JarvanIV: {
    name: 'JarvanIV',
    jpName: 'ジャーヴァンIV',
    type: '3キャンプ即ガンク型',
    clearSpeed: '標準 (3:20〜3:30)',
    defaultStart: '3キャンプ(赤→青→グロンプ) ➔ 最速Lv3ガンク',
    scuttleAdvice: '⚠️ レーン主導権次第',
    earlyDangerSkills: ['E-Q コンボ (ノックアップ)', 'W (シールド＆スロウ)'],
    keyCounterTips: '2分40秒前後にBOTかMIDに突っ込んでくる。E-Qの旗を避ければダメージ半減。フラッシュ落ちしたレーンを徹底監視。',
  },
  Elise: {
    name: 'Elise',
    jpName: 'エリス',
    type: '3キャンプ即ガンク型',
    clearSpeed: '低速/ガンク特化',
    defaultStart: '3キャンプ ➔ 2:40タワーダイブ狙い',
    scuttleAdvice: '❌ 不利（逆サイドへ逃げるべき）',
    earlyDangerSkills: ['人形態E (結び糸スタン)', '蜘蛛形態Q (処刑咬みつき)', '蜘蛛形態E (宙づりタワーリセット)'],
    keyCounterTips: 'Lv3のタイマン・タワーダイブ能力は全JG最強格。スカトルで鉢合わせたら即死するため、絶対に逆サイドのスカトルを取ること。',
  },
  Nocturne: {
    name: 'Nocturne',
    jpName: 'ノクターン',
    type: 'フルクリア型',
    clearSpeed: '超高速 (3:15以前)',
    defaultStart: '最速フルクリア ➔ Lv6ラッシュ',
    scuttleAdvice: '❌ 不利（逆サイドへ逃げるべき）',
    earlyDangerSkills: ['E (底知れぬ恐怖) - 長時間恐怖', 'W (漆黒の帳) - スキル無効シールド', 'Q (黄泉の帳) - AD大幅増加'],
    keyCounterTips: 'Lv1〜3でもQ上のタイマンとE恐怖で殴り合いが非常に強い。タイマンを避け、Lv6になる前に味方レーンを押し広げて有利を作ること。',
  },
  Hecarim: {
    name: 'Hecarim',
    jpName: 'ヘカリム',
    type: 'フルクリア型',
    clearSpeed: '超高速 (3:15以前)',
    defaultStart: '最速フルクリア（3:15完了） ➔ スカトル',
    scuttleAdvice: '⭕ 有利（戦うべき）',
    earlyDangerSkills: ['Q (暴れ回り) - スタック維持', 'E (破滅の突撃) - 超加速ノックバック'],
    keyCounterTips: 'Qスタックが切れている序盤は弱い。1周目の青バフや赤バフを荒らすインベードが刺さりやすい。',
  },
  Shaco: {
    name: 'Shaco',
    jpName: 'シャコ',
    type: 'インベード型',
    clearSpeed: '低速/ガンク特化',
    defaultStart: '赤バフ箱敷き詰め ➔ 即敵ジャングル侵入またはLv2ガンク',
    scuttleAdvice: '⚠️ レーン主導権次第',
    earlyDangerSkills: ['W (びっくり箱) - フィアー＆罠', 'Q (幻惑) - ステルス瞬間移動'],
    keyCounterTips: '開始50秒に敵ジャングル入口にワード必須。自分の2つ目のバフ（青や赤）に潜伏してくるので、ブッシュにスキルを撃ってから狩ること。',
  },
  Kayn: {
    name: 'Kayn',
    jpName: 'ケイン',
    type: 'フルクリア型',
    clearSpeed: '超高速 (3:15以前)',
    defaultStart: 'フルクリア（単独ラプターまたは赤スタート）',
    scuttleAdvice: '⭕ 有利（戦うべき）',
    earlyDangerSkills: ['Q (飛天乱舞) - 短CD回転', 'E (影の歩み) - 壁抜け奇襲'],
    keyCounterTips: '変身前（序盤）のタイマンは最弱クラス。スカトルで積極的に仕掛けてフラッシュを吐かせたり、キャンプを奪うべき。',
  },
  Khazix: {
    name: 'Khazix',
    jpName: 'カ＝ジックス',
    type: '3キャンプ即ガンク型',
    clearSpeed: '標準 (3:20〜3:30)',
    defaultStart: 'フルクリアまたは3キャンプ',
    scuttleAdvice: '❌ 不利（逆サイドへ逃げるべき）',
    earlyDangerSkills: ['Q (甘美なる恐怖) - 孤立特大ダメージ', 'E (飛翔) - 長距離跳躍'],
    keyCounterTips: '中立モンスターや味方が近くにいれば「孤立」が発動せずダメージ半減。タイマン時は必ずキャンプやミニオンの隣で戦うこと。',
  },
  Nidalee: {
    name: 'Nidalee',
    jpName: 'ニダリー',
    type: 'インベード型',
    clearSpeed: '超高速 (3:15以前)',
    defaultStart: '高速フルクリアまたはLv2〜3敵陣侵入',
    scuttleAdvice: '⚠️ レーン主導権次第',
    earlyDangerSkills: ['人形態Q (ジャベリン投げ)', 'クーガー形態Q (処刑噛みつき)', 'クーガー形態W (飛びつき)'],
    keyCounterTips: '槍（Q）が当たったらクーガー飛びつきで即死する。視界外からの槍の射線を常にミニオンや壁で遮ること。',
  },
  Karthus: {
    name: 'Karthus',
    jpName: 'カーサス',
    type: 'フルクリア型',
    clearSpeed: '超高速 (3:15以前)',
    defaultStart: '最速フルクリア（3:10完了）',
    scuttleAdvice: '⭕ 有利（戦うべき）',
    earlyDangerSkills: ['Q (荒廃) - 単体ヒット倍ダメ', 'W (苦痛の壁) - スロウ＆MR低下'],
    keyCounterTips: '序盤の耐久力は紙。スカトルや敵ジャングルで捕まえれば100%キル可能。積極的にインベードしてファームを妨害せよ。',
  },
  XinZhao: {
    name: 'XinZhao',
    jpName: 'シン・ジャオ',
    type: '3キャンプ即ガンク型',
    clearSpeed: '標準 (3:20〜3:30)',
    defaultStart: '3キャンプ(赤→青→グロンプ) ➔ Lv3ファイト',
    scuttleAdvice: '❌ 不利（逆サイドへ逃げるべき）',
    earlyDangerSkills: ['E (無双突撃) - 突進＆AS増加', 'Q (三爪撃) - 3発目打ち上げ', 'W (風斬電刺) - 長射程突き'],
    keyCounterTips: 'Lv3のタイマン性能はトップクラス。3:30スカトルで真正面からぶつかると負ける。反対サイドのスカトルへ行くこと。',
  },
};

export default function JgMatchupPredictor() {
  const [selectedChamp, setSelectedChamp] = useState<string>('LeeSin');
  const [searchTerm, setSearchTerm] = useState('');

  const current = JG_DATABASE[selectedChamp] || JG_DATABASE['LeeSin'];

  const champList = Object.keys(JG_DATABASE).filter((key) => {
    const p = JG_DATABASE[key];
    return (
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.jpName.includes(searchTerm)
    );
  });

  return (
    <div className="bg-stone-50 border border-stone-300 rounded-xl p-4 space-y-3.5 shadow-sm text-stone-900">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-stone-200 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <div>
            <h3 className="text-xs font-black uppercase text-amber-900 tracking-wider">
              敵JG初動ルート ＆ 3:30スカトル予測カンペ (ロード画面30秒対策)
            </h3>
            <p className="text-[11px] text-stone-500">
              敵JGを選択すると、初動プラン・スカトル交戦判断・警戒スキルを即座に表示します
            </p>
          </div>
        </div>

        {/* チャンピオン検索・選択 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="JGチャンプ名..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-2.5 py-1 text-xs border border-stone-300 rounded-lg bg-white focus:outline-none focus:border-amber-500 w-32"
          />
        </div>
      </div>

      {/* チャンピオンクイックセレクトボタン一覧 */}
      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
        {champList.map((key) => {
          const p = JG_DATABASE[key];
          const isSelected = selectedChamp === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedChamp(key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-amber-800 text-amber-50 shadow-sm ring-2 ring-amber-500'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              <span>{p.jpName}</span>
              <span className="text-[9px] opacity-70">({p.type.slice(0, 4)})</span>
            </button>
          );
        })}
      </div>

      {/* 選択中JGの詳細カンペカード */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3 shadow-sm">
        {/* チャンプ名 & 基本特性バッジ */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-stone-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-stone-900">
              {current.jpName} <span className="text-xs font-normal text-stone-400">({current.name})</span>
            </span>
            <span className="text-[10px] bg-indigo-100 text-indigo-900 font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
              {current.type}
            </span>
          </div>

          <div className="text-xs">
            <span className="text-stone-400 mr-1">クリア速度:</span>
            <strong className="text-stone-800">{current.clearSpeed}</strong>
          </div>
        </div>

        {/* 3大要素グリッド */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* 初動ルート予測 */}
          <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 space-y-1">
            <div className="font-extrabold text-stone-700 flex items-center gap-1">
              <span>📍</span> 典型的な初動ルート・スタート
            </div>
            <p className="text-stone-800 font-medium text-[11px] leading-relaxed">
              {current.defaultStart}
            </p>
          </div>

          {/* 3:30スカトル交戦判断 */}
          <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200 space-y-1">
            <div className="font-extrabold text-amber-950 flex items-center gap-1">
              <span>🦀</span> 3:30 スカトル交戦判断
            </div>
            <p className="text-amber-900 font-black text-xs">
              {current.scuttleAdvice}
            </p>
          </div>
        </div>

        {/* Lv1〜3 警戒スキル */}
        <div className="space-y-1 text-xs">
          <div className="font-extrabold text-rose-900 flex items-center gap-1">
            <span>⚠️</span> Lv1〜3 警戒スキル（当たったら即死/不利）
          </div>
          <div className="flex flex-wrap gap-1.5">
            {current.earlyDangerSkills.map((s, i) => (
              <span key={i} className="text-[11px] bg-rose-50 border border-rose-200 text-rose-800 font-bold px-2 py-0.5 rounded-md">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* 必勝カウンター心得 */}
        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-xs space-y-1">
          <div className="font-extrabold text-emerald-950 flex items-center gap-1">
            <span>💡</span> 必勝カウンター心得 (JG視点)
          </div>
          <p className="text-emerald-900 text-[11px] font-medium leading-relaxed">
            {current.keyCounterTips}
          </p>
        </div>
      </div>
    </div>
  );
}
