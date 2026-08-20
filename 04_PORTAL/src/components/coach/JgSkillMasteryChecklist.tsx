'use client';

import React, { useState, useEffect } from 'react';

interface ChecklistItem {
  id: string;
  step: number;
  stepName: string;
  title: string;
  detail: string;
  badge: string;
}

const JG_STEPS: ChecklistItem[] = [
  // STEP 1: 初級 (シルバー・ゴールド帯の基礎)
  {
    id: 's1_1',
    step: 1,
    stepName: 'STEP 1: ルート＆ファーム基礎',
    title: '1周目フルクリアを 3:30 以内にHP8割以上で完了できる',
    detail: 'カイト（引き撃ち）を意識し、スキルCDと通常攻撃を無駄なく回してスカトル出現(3:30)に間に合わせる。',
    badge: 'ファーム効率',
  },
  {
    id: 's1_2',
    step: 1,
    stepName: 'STEP 1: ルート＆ファーム基礎',
    title: '敵JGのスタート位置（赤or青）を開始1分で特定する',
    detail: '敵レーナー（TOP/BOT）のレーン出現タイミングとマナ・HPの減り具合からスタート側を特定。',
    badge: '索敵基礎',
  },
  // STEP 2: 中級 (プラチナ・エメラルド帯の壁突破)
  {
    id: 's2_1',
    step: 2,
    stepName: 'STEP 2: ガンク＆ウェーブ判断',
    title: 'ガンクに向かう前に、味方レーンの「ウェーブ状態（プッシュ/プル）」を目視確認する',
    detail: '味方がタワー下に押し込まれているか、敵がタワー下に釘付けになっているかを見て、ガンクかダイブか見送るかを判断。',
    badge: 'ウェーブ理解',
  },
  {
    id: 's2_2',
    step: 2,
    stepName: 'STEP 2: ガンク＆ウェーブ判断',
    title: 'レーン主導権のないサイドでのスカトル交戦を即座に諦める',
    detail: '味方が寄れない状態で3:30スカトルを争うと100%デスする。反対側のスカトルか自陣ファームに切り替える。',
    badge: '生存判断',
  },
  // STEP 3: 上級 (エメラルド〜ダイヤ帯)
  {
    id: 's3_1',
    step: 3,
    stepName: 'STEP 3: マップトレード＆オブジェクト',
    title: '敵JGがMAPに見えた瞬間、逆サイドのオブジェクトか敵キャンプを奪う（トレード意識）',
    detail: '敵がBOTにガンクしたなら、即座にヴォイドグラブを触るか敵のTOP側キャンプを全狩りして損害をゼロ以下にする。',
    badge: '逆サイド展開',
  },
  {
    id: 's3_2',
    step: 3,
    stepName: 'STEP 3: マップトレード＆オブジェクト',
    title: 'ドラゴン/ヴォイドグラブ発生1分前にベースへ戻りアイテムを更新する',
    detail: 'ゴールドを1500抱えたままオブジェクト前に突入しない。アイテム差でステータス優位を作ってから寄る。',
    badge: 'リコール管理',
  },
  // STEP 4: ダイヤ〜マスター級
  {
    id: 's4_1',
    step: 4,
    stepName: 'STEP 4: カウンタージャングル＆視界制圧',
    title: '敵キャンプの湧き時間（2分15秒周期）を予測して待ち伏せ・強奪する',
    detail: '敵バフやラプターが湧くタイミングに合わせてコントロールワードを刺し、先手を取ってキルする。',
    badge: 'キャンプ管理',
  },
  {
    id: 's4_2',
    step: 4,
    stepName: 'STEP 4: カウンタージャングル＆視界制圧',
    title: '味方の崩壊したレーンを捨て、勝っているレーン（勝ち筋）にリソースを全集中する',
    detail: '0/3のレーンを助けに行くと2v2でダブルキルされる。2/0で勝っているレーナーと一緒に敵JGを荒らす。',
    badge: '勝ち筋フォーカス',
  },
];

export default function JgSkillMasteryChecklist() {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jg_skill_checklist');
      if (saved) {
        setCheckedIds(new Set(JSON.parse(saved)));
      }
    } catch {}
  }, []);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      try {
        localStorage.setItem('jg_skill_checklist', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const total = JG_STEPS.length;
  const completed = checkedIds.size;
  const progressPercent = Math.round((completed / total) * 100);

  return (
    <div className="bg-stone-50 border border-stone-300 rounded-xl p-4 space-y-4 shadow-sm text-stone-900">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📋</span>
          <div>
            <h3 className="text-xs font-black uppercase text-amber-900 tracking-wider">
              ふつぐ式 JGステップアップ習熟度チェックリスト
            </h3>
            <p className="text-[11px] text-stone-500">
              勝敗に左右されないJGの不変原則。試合ごとに達成項目をチェックして実力を底上げします
            </p>
          </div>
        </div>

        {/* 進捗バッジ */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-sm">
          <span className="text-xs text-stone-500 font-bold">習熟度:</span>
          <span className="text-sm font-black text-amber-800">{progressPercent}%</span>
          <div className="w-16 h-2 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-stone-400">({completed}/{total})</span>
        </div>
      </div>

      {/* チェックリスト一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {JG_STEPS.map((item) => {
          const isDone = checkedIds.has(item.id);
          return (
            <div
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-all select-none ${
                isDone
                  ? 'bg-emerald-50/80 border-emerald-300 shadow-sm'
                  : 'bg-white border-stone-200 hover:border-amber-400 hover:bg-stone-50'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => {}} // onClick on container
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase">
                      {item.stepName}
                    </span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                      isDone ? 'bg-emerald-200 text-emerald-900' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {item.badge}
                    </span>
                  </div>

                  <div className={`text-xs font-bold ${isDone ? 'text-emerald-950 line-through opacity-80' : 'text-stone-900'}`}>
                    {item.title}
                  </div>

                  <p className="text-[11px] text-stone-500 leading-snug">
                    {item.detail}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
