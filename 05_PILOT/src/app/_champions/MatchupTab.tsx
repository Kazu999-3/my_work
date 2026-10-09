"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { ShieldAlert, Swords, Skull, CheckCircle2, BookOpen, ExternalLink, Search, Filter } from "lucide-react";
import { getChampIcon } from "@/lib/ddragonClient";
import championsDetailMap from "@/data/champions_detail_map.json";
import type { ChampionDetail, MatchupItem, LibraryKnowledgeItem } from "./types";
import FactClaimList from "./FactClaimList";

// 相手チャンピオン名（日本語または英語ID）から英語IDと日本語名を逆引き
const allChamps = Object.values(championsDetailMap as Record<string, any>);

function resolveEnemy(raw: string): { id: string; nameJa: string } {
  const clean = raw.trim();
  if (!clean) return { id: "", nameJa: "" };
  const found = allChamps.find(
    (c) => c.jpName === clean || c.id.toLowerCase() === clean.toLowerCase() || clean.includes(c.jpName) || clean.toLowerCase().includes(c.id.toLowerCase())
  );
  if (found) return { id: found.id, nameJa: found.jpName };
  return { id: clean, nameJa: clean };
}

// チャンピオンのデフォルトレーン推測
function getChampDefaultLane(champId: string): string {
  const c = (championsDetailMap as Record<string, any>)[champId];
  if (c?.tags && Array.isArray(c.tags) && c.tags.length > 0) {
    return c.tags[0];
  }
  return "MID";
}

// 記事タイトルから対面相手とレーンを抽出
function extractMatchupArticleInfo(item: LibraryKnowledgeItem, myChampId: string) {
  const title = item.title || "";
  const snippet = item.snippet || "";
  const fullText = `${title} ${snippet}`;

  // 1. "A vs B" パターン
  let enemyRaw = "";
  const vsMatch = title.match(/([^\s【\[(]+?)\s*(?:vs\.?|VS\.?|Vs\.?)\s*([^\s】\])\s:：,，!！]+)/i);
  if (vsMatch) {
    const left = vsMatch[1].replace(/^[【\[(]+/, '').trim();
    const right = vsMatch[2].replace(/[】\])!\?！？]+$/, '').trim();
    const leftResolved = resolveEnemy(left);
    const rightResolved = resolveEnemy(right);

    if (leftResolved.id && rightResolved.id) {
      if (leftResolved.id.toLowerCase() === myChampId.toLowerCase()) {
        enemyRaw = rightResolved.id;
      } else {
        enemyRaw = leftResolved.id;
      }
    } else if (rightResolved.id) {
      enemyRaw = rightResolved.id;
    }
  }

  // 2. "対面〇〇" / "対〇〇" / "〇〇対策"
  if (!enemyRaw) {
    const taiMatch = title.match(/(?:対面|対|fight\s+|vs\s+)([A-Za-z\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+)/i)
      || title.match(/([A-Za-z\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+?)(?:対策|攻略)/i);
    if (taiMatch) {
      const res = resolveEnemy(taiMatch[1]);
      if (res.id && res.id.toLowerCase() !== myChampId.toLowerCase()) {
        enemyRaw = res.id;
      }
    }
  }

  // レーン推測
  let lane = "COMMON";
  if (/\b(top|toplane)\b|トップ/i.test(fullText)) lane = "TOP";
  else if (/\b(jg|jungle)\b|ジャングル/i.test(fullText)) lane = "JG";
  else if (/\b(mid|midlane)\b|ミッド/i.test(fullText)) lane = "MID";
  else if (/\b(adc|bot)\b|ボット/i.test(fullText)) lane = "ADC";
  else if (/\b(sup|support)\b|サポート/i.test(fullText)) lane = "SUP";

  const resolvedEnemy = enemyRaw ? resolveEnemy(enemyRaw) : { id: "", nameJa: "" };

  return {
    isMatchup: !!enemyRaw || /vs|対面|マッチアップ/i.test(title),
    enemyId: resolvedEnemy.id,
    enemyNameJa: resolvedEnemy.nameJa,
    lane,
  };
}

// タブ2: 対面相性 ＆ キルライン（レーン別割り振り ＆ 対面攻略記事統合）
export default function MatchupTab({
  selectedDetail,
  currentRole = "MID",
  setCurrentRole,
  availableRoles = [],
  openKnowledgeModal,
}: {
  selectedDetail: ChampionDetail;
  currentRole?: string;
  setCurrentRole?: (role: string) => void;
  availableRoles?: string[];
  openKnowledgeModal?: (id: string | number) => void;
}) {
  const claims = selectedDetail.facts?.claims;

  // レーンフィルター ('ALL' または 'TOP', 'JG', 'MID', 'ADC', 'SUP')
  const [selectedLane, setSelectedLane] = useState<string>("ALL");
  // 相手チャンピオン検索キーワード
  const [enemySearch, setEnemySearch] = useState<string>("");

  // 1. 攻略ライブラリ記事からの対面記事抽出
  const matchupArticles = useMemo(() => {
    const list = selectedDetail.libraryKnowledge || [];
    return list
      .map((item) => {
        const info = extractMatchupArticleInfo(item, selectedDetail.id);
        return {
          ...item,
          ...info,
        };
      })
      .filter((item) => item.isMatchup);
  }, [selectedDetail.libraryKnowledge, selectedDetail.id]);

  // 2. Matchup Sentinel 個別メモ
  const matchupMemos = useMemo(() => {
    return (selectedDetail.matchups || []).map((m) => {
      const resolved = resolveEnemy(m.enemy);
      const enemyLane = getChampDefaultLane(resolved.id);
      return {
        ...m,
        enemyId: resolved.id,
        enemyNameJa: resolved.nameJa,
        lane: enemyLane,
      };
    });
  }, [selectedDetail.matchups]);

  // レーン＆キーワードフィルタリング適用
  const filteredArticles = useMemo(() => {
    return matchupArticles.filter((art) => {
      const matchLane = selectedLane === "ALL" || art.lane === selectedLane || (art.lane === "COMMON" && selectedLane === currentRole);
      const q = enemySearch.toLowerCase().trim();
      const matchSearch = !q || art.title.toLowerCase().includes(q) || art.enemyNameJa.toLowerCase().includes(q) || art.enemyId.toLowerCase().includes(q);
      return matchLane && matchSearch;
    });
  }, [matchupArticles, selectedLane, enemySearch, currentRole]);

  const filteredMemos = useMemo(() => {
    return matchupMemos.filter((memo) => {
      const matchLane = selectedLane === "ALL" || memo.lane === selectedLane;
      const q = enemySearch.toLowerCase().trim();
      const matchSearch = !q || memo.enemy.toLowerCase().includes(q) || memo.enemyNameJa.toLowerCase().includes(q) || memo.note.toLowerCase().includes(q);
      return matchLane && matchSearch;
    });
  }, [matchupMemos, selectedLane, enemySearch]);

  const handleRoleSelect = (role: string) => {
    setSelectedLane(role);
    if (setCurrentRole && role !== "ALL" && availableRoles.includes(role)) {
      setCurrentRole(role);
    }
  };

  const LANES = [
    { key: "ALL", label: "全レーン" },
    { key: "TOP", label: "⚔️ TOP" },
    { key: "JG", label: "🌲 JG" },
    { key: "MID", label: "⚡ MID" },
    { key: "ADC", label: "🏹 ADC" },
    { key: "SUP", label: "🛡️ SUP" },
  ];

  return (
    <div className="space-y-4">
      {/* 🗺️ レーン別割り振り ＆ 相手検索コントロールバー */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* レーン切り替えボタン群 */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-xs font-bold text-zinc-400 shrink-0 flex items-center gap-1 mr-1">
              <span>🗺️ レーン:</span>
            </span>
            {LANES.map((lane) => {
              const isSelected = selectedLane === lane.key;
              const isMainRole = availableRoles.includes(lane.key);
              return (
                <button
                  key={lane.key}
                  type="button"
                  onClick={() => handleRoleSelect(lane.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-amber-500 text-zinc-950 font-black shadow-sm scale-102"
                      : isMainRole
                      ? "bg-zinc-950 text-amber-300 hover:bg-zinc-800 border border-amber-500/30 font-bold"
                      : "bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800"
                  }`}
                >
                  {lane.label}
                  {isMainRole && lane.key !== "ALL" && (
                    <span className="ml-1 text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">本職</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 相手チャンピオン検索インプット */}
          <div className="relative w-full sm:w-60 shrink-0">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="対面相手で絞り込み..."
              value={enemySearch}
              onChange={(e) => setEnemySearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>
        </div>

        {/* 状態サマリーバナー */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/60">
          <span>
            {selectedDetail.jpName} の対面知見:{" "}
            <strong className="text-amber-400">{filteredArticles.length}</strong> 件の攻略記事 /{" "}
            <strong className="text-zinc-200">{filteredMemos.length}</strong> 件の実戦メモ
          </span>
          {selectedLane !== "ALL" && (
            <span className="text-amber-300 font-bold">
              【{selectedLane} レーン基準で表示中】
            </span>
          )}
        </div>
      </div>

      {/* ⚔️ 対面攻略記事セクション（ライブラリから抽出された対面バイブル） */}
      {filteredArticles.length > 0 && (
        <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
              <BookOpen size={16} className="text-amber-400" />
              対面攻略記事バイブル ({filteredArticles.length}件)
            </h3>
            <span className="text-[10px] text-zinc-500">ライブラリ（personal_knowledge）連動</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredArticles.map((art) => (
              <div
                key={art.id}
                onClick={() => openKnowledgeModal && openKnowledgeModal(art.id)}
                className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 transition cursor-pointer flex flex-col justify-between gap-2.5 shadow-xs group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {art.enemyId && (
                        <div className="w-5 h-5 rounded-md overflow-hidden border border-zinc-700 shrink-0">
                          <img
                            src={getChampIcon(art.enemyId)}
                            alt={art.enemyNameJa}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        </div>
                      )}
                      <span className="font-black text-xs text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-500/30">
                        vs {art.enemyNameJa || art.enemyId || "対面"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {art.lane && art.lane !== "COMMON" && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 font-bold border border-zinc-700">
                          {art.lane}
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                        📘 攻略記事
                      </span>
                    </div>
                  </div>

                  <h4 className="font-bold text-xs text-zinc-100 group-hover:text-amber-300 transition line-clamp-2 leading-snug">
                    {art.title}
                  </h4>

                  {art.snippet && (
                    <p className="text-[11px] text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed bg-zinc-900/60 p-2 rounded-lg border border-zinc-900 font-mono">
                      {art.snippet}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-zinc-850 text-[10px] text-zinc-500" onClick={(e) => e.stopPropagation()}>
                  <span>{art.channel || "攻略知見"}</span>
                  <div className="flex items-center gap-2">
                    {openKnowledgeModal && (
                      <button
                        onClick={() => openKnowledgeModal(art.id)}
                        className="text-amber-400 hover:text-amber-300 font-bold transition flex items-center gap-0.5 cursor-pointer"
                      >
                        全文を読む ↗
                      </button>
                    )}
                    <Link
                      href={`/library?id=${art.id}`}
                      className="text-zinc-400 hover:text-zinc-200 transition"
                      title="ライブラリで開く"
                    >
                      <ExternalLink size={11} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 即死キルライン・コンボ */}
      {selectedDetail.bible?.killCombo && (
        <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-black text-rose-300 mb-1 flex items-center gap-2">
            <Skull size={16} className="text-rose-400" /> 即死キルライン ＆ コンボ手順
          </h3>
          <p className="text-xs text-zinc-200 leading-relaxed bg-zinc-950 p-3 rounded-xl border border-zinc-800 mt-2 font-mono">
            {selectedDetail.bible.killCombo}
          </p>
        </div>
      )}

      {/* カモ vs 天敵 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* カモ（有利な展開・強み） */}
        <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <h3 className="text-sm font-black text-emerald-300">
                🟢 有利な展開 ＆ 活かすべき強み
              </h3>
            </div>
            {claims?.strengths ? (
              <FactClaimList claims={claims.strengths} marker="✓" markerClass="text-emerald-400" />
            ) : selectedDetail.facts?.strengths && selectedDetail.facts.strengths.length > 0 ? (
              <div className="space-y-2 text-xs">
                {selectedDetail.facts.strengths.map((s, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 text-zinc-300 leading-relaxed">
                    <span className="text-emerald-400 font-black mt-0.5">✓</span>
                    <span className="leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">強み・カモ情報登録なし</p>
            )}
          </div>
        </div>

        {/* 天敵（不利・カウンター・マストBAN） */}
        <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={16} className="text-rose-400" />
              <h3 className="text-sm font-black text-rose-300">
                🔴 不利・天敵 ＆ マストBAN推奨
              </h3>
            </div>

            {/* マストBAN */}
            {claims?.mustBan ? (
              <div>
                <span className="font-black block text-[10px] text-rose-400 uppercase mb-1">🚨 マストBAN推奨</span>
                <FactClaimList claims={claims.mustBan} marker="🚨" markerClass="text-rose-400" />
              </div>
            ) : selectedDetail.facts?.mustBan && selectedDetail.facts.mustBan.length > 0 && (
              <div className="bg-rose-950/40 p-2.5 rounded-xl border border-rose-500/50 text-rose-200">
                <span className="font-black block text-[10px] text-rose-400 uppercase mb-0.5">🚨 マストBAN推奨</span>
                <span className="font-bold leading-relaxed">{selectedDetail.facts.mustBan.join(" / ")}</span>
              </div>
            )}

            {/* 警戒すべきカウンタータイプ */}
            {claims?.counters ? (
              <FactClaimList claims={claims.counters} marker="✕" markerClass="text-rose-400" />
            ) : selectedDetail.facts?.counters && selectedDetail.facts.counters.length > 0 && (
              <div className="space-y-1.5">
                {selectedDetail.facts.counters.map((c, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-zinc-950 p-2.5 rounded-xl border border-rose-500/20 text-zinc-300 leading-relaxed">
                    <span className="text-rose-400 font-black mt-0.5">✕</span>
                    <span className="leading-relaxed">{c}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 弱点・脆さ */}
            {claims?.weaknesses ? (
              <div className="mt-2">
                <span className="text-amber-400 font-bold block mb-1 text-[11px]">⚠️ 立ち回りの注意点・弱点</span>
                <FactClaimList claims={claims.weaknesses} marker="⚠" markerClass="text-amber-400" />
              </div>
            ) : selectedDetail.facts?.weaknesses && selectedDetail.facts.weaknesses.length > 0 && (
              <div className="mt-2 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80 text-zinc-400 text-[11px] leading-relaxed">
                <span className="text-amber-400 font-bold block mb-0.5">⚠️ 立ち回りの注意点・弱点</span>
                {selectedDetail.facts.weaknesses.join(" ")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Matchup Sentinel 個別対面相性メモ一覧 */}
      {filteredMemos.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-zinc-100 flex items-center gap-2">
              <Swords size={16} className="text-amber-400" />
              個別対面相性メモ ({filteredMemos.length}件)
            </h3>
            <span className="text-[10px] text-zinc-500">チャレンジャー実戦ログ (Matchup Sentinel)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {filteredMemos.map((m) => (
              <div key={m.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition">
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {m.enemyId && (
                      <div className="w-5 h-5 rounded-md overflow-hidden border border-zinc-700 shrink-0">
                        <img
                          src={getChampIcon(m.enemyId)}
                          alt={m.enemyNameJa}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                    <span className="font-black text-amber-400 text-xs">
                      vs {m.enemyNameJa ? `${m.enemyNameJa} (${m.enemy})` : m.enemy}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {m.lane && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-bold">
                        {m.lane}
                      </span>
                    )}
                    {m.result && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        m.result === 'Win' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {m.result}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {m.note}
                </p>

                {m.trap && (
                  <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/20 p-1.5 rounded border border-rose-500/20">
                    ⚠️ 罠: {m.trap}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 検索結果がゼロの場合の案内 */}
      {filteredArticles.length === 0 && filteredMemos.length === 0 && (
        <div className="p-8 text-center bg-zinc-900/50 rounded-2xl border border-zinc-800 text-zinc-400 space-y-2">
          <p className="text-xs">
            {selectedLane !== "ALL" ? `【${selectedLane} レーン】の該当する対面知見は見つかりませんでした。` : "該当する対面知見は見つかりませんでした。"}
          </p>
          {selectedLane !== "ALL" && (
            <button
              onClick={() => setSelectedLane("ALL")}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold transition cursor-pointer underline"
            >
              「全レーン」で再表示する
            </button>
          )}
        </div>
      )}
    </div>
  );
}
