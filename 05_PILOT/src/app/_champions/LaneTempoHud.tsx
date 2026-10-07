"use client";

import { Swords, Zap, Shield, Clock, Activity } from "lucide-react";
import { getLaneTempoMetrics } from "@/lib/tempoMetrics";
import type { MeasuredSpikes } from "./types";

// ⏱️⚡ レーン別実戦指標 ＆ パワースパイク推移ミニHUD
// 2026-10-07: app/page.tsx（2,840行）から分割。表示内容・動作は分割前と同じ。状態は page.tsx が持ち、ここは props で受け取って描画するだけ。
export default function LaneTempoHud({ currentRole, spikeValues, measuredSpikes, laneTempo }: {
  currentRole: string;
  spikeValues: { early: number; mid: number; late: number };
  measuredSpikes: MeasuredSpikes | null;
  laneTempo: ReturnType<typeof getLaneTempoMetrics> | null;
}) {
  return (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {/* レーン別実戦指標 */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    {currentRole === "JG" ? <Clock size={16} /> :
                     currentRole === "SUP" ? <Shield size={16} /> :
                     currentRole === "TOP" ? <Swords size={16} /> :
                     currentRole === "MID" ? <Zap size={16} /> :
                     <Activity size={16} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-zinc-100">
                        {laneTempo?.title || (
                          currentRole === "JG" ? "🌲 JG周回実戦基準" :
                          currentRole === "SUP" ? "🛡️ SUP視界・初動指標" :
                          currentRole === "TOP" ? "⚔️ TOPウェーブ管理指標" :
                          currentRole === "MID" ? "⚡ MIDローム・テンポ指標" :
                          "🏹 BOT/ADC指標"
                        )}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-bold border border-zinc-700">
                        {laneTempo?.badge || `${currentRole}標準`}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      {laneTempo?.subtitle || (
                        currentRole === "JG" ? "2026仕様: キャンプ0:55湧き / カニ2:55争奪" :
                        currentRole === "SUP" ? "Lv2先行プッシュ ＆ 視界スコア目標" :
                        currentRole === "TOP" ? "1stリコール目標 ＆ フリーズ基準" :
                        currentRole === "MID" ? "キャノン押し込み ＆ オブジェクト寄り" :
                        "1stコア目標 ＆ CSレート"
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  {laneTempo ? (
                    <>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">{laneTempo.metric1.label}</span>
                        <span className={`text-xs font-black ${laneTempo.metric1.color} font-mono`}>
                          {laneTempo.metric1.value}
                        </span>
                      </div>
                      <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-bold">{laneTempo.metric2.label}</span>
                        <span className={`text-xs font-black ${laneTempo.metric2.color} font-mono`}>
                          {laneTempo.metric2.value}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block font-bold">指標読込中</span>
                      <span className="text-xs font-black text-zinc-500 font-mono">--:--</span>
                    </div>
                  )}
                </div>
              </div>

              {/* パワースパイク推移
                  2026-10-07: 実測（試合時間帯別の勝率）があればそれを出す。無ければ型ごとの手書きの目安を「型ごとの目安」と明記して出す
                  （以前は目安の数字を「10段階指標」として、同じ型のチャンピオン全員に同じ値を表示していた） */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 shadow-sm flex flex-col justify-center gap-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Activity size={15} className="text-amber-400" />
                    <span className="text-xs font-black text-zinc-100">パワースパイク推移</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-bold">
                    {measuredSpikes ? "実測: 試合時間別の勝率" : "型ごとの目安（実測データ収集中）"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  {([
                    { key: "early", label: "序盤", sub: "〜25分", bar: "bg-amber-500", text: "text-amber-400" },
                    { key: "mid", label: "中盤", sub: "25〜32分", bar: "bg-emerald-500", text: "text-emerald-400" },
                    { key: "late", label: "終盤", sub: "32分〜", bar: "bg-teal-500", text: "text-teal-400" },
                  ] as const).map((ph) => {
                    const m = measuredSpikes?.[ph.key];
                    const width = m ? m.winRate : (spikeValues[ph.key] / 10) * 100;
                    return (
                      <div key={ph.key} className="bg-zinc-950 p-1.5 rounded-lg border border-zinc-800">
                        <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1 px-0.5">
                          <span>{ph.label}</span>
                          <span className={`font-bold ${ph.text}`}>{m ? `${Math.round(m.winRate)}%` : `${spikeValues[ph.key]}/10`}</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                          <div className={`${ph.bar} h-full rounded-full transition-all duration-500`} style={{ width: `${width}%` }} />
                        </div>
                        {m && <div className="text-[9px] text-zinc-500 mt-1">{ph.sub}で終わった{m.games}試合</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
  );
}
