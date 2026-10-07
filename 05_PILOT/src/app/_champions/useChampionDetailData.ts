"use client";

import { useState, useMemo, useEffect } from "react";
import championsDetailMap from "@/data/champions_detail_map.json";
import { detectChampionArchetype, getPresetBuildDetails, type ChampionArchetype } from "@/lib/archetype";
import { translateItem } from "@/lib/itemTranslator";
import { getLaneTempoMetrics, getStageTactics } from "@/lib/tempoMetrics";
import { getDynamicPickGuide } from "@/lib/pickGuideDynamic";
import type { ChampionDetail, BuildPreset } from "./types";

// 選択中チャンピオン（URL ?c=）から計算する表示用の値。2026-10-07 app/page.tsx から分離（計算内容は分離前と同じ）。
export function useChampionDetailData({ rawChampParam, vsEnemyId, customRoles, customItemDict, buildPreset, opggMeta }: {
  rawChampParam: string | null;
  vsEnemyId: string;
  customRoles: Record<string, string[]>;
  customItemDict: Record<string, string>;
  buildPreset: BuildPreset;
  opggMeta: any;
}) {
  // チャンピオン詳細データの取得
  const selectedDetail: ChampionDetail | null = useMemo(() => {
    if (!rawChampParam) return null;
    const map = championsDetailMap as unknown as Record<string, ChampionDetail>;
    const direct = map[rawChampParam];
    if (direct) return direct;
    const foundKey = Object.keys(map).find(
      (k) => k.toLowerCase() === rawChampParam.toLowerCase()
    );
    return foundKey ? map[foundKey] : null;
  }, [rawChampParam]);

  // VS敵チャンピオンの詳細データ
  const vsEnemyDetail: ChampionDetail | null = useMemo(() => {
    if (!vsEnemyId) return null;
    const map = championsDetailMap as unknown as Record<string, ChampionDetail>;
    return map[vsEnemyId] || null;
  }, [vsEnemyId]);

  // 選択中チャンピオンの利用可能レーン（ユーザーカスタム設定優先）
  const availableRoles = useMemo(() => {
    if (!selectedDetail) return ["MID"];
    const custom = customRoles[selectedDetail.id];
    if (custom && Array.isArray(custom) && custom.length > 0) return custom;
    if (selectedDetail.tags && Array.isArray(selectedDetail.tags) && selectedDetail.tags.length > 0) {
      return selectedDetail.tags;
    }
    return ["MID"];
  }, [selectedDetail, customRoles]);

  // 選択中チャンピオンのロール
  const [currentRole, setCurrentRole] = useState<string>("MID");
  useEffect(() => {
    if (availableRoles.length > 0) {
      if (!availableRoles.includes(currentRole)) {
        setCurrentRole(availableRoles[0]);
      }
    }
  }, [availableRoles, currentRole]);

  // 選択中レーンに対応する OP.GG 公式メタデータ
  const currentLaneMeta = useMemo(() => {
    if (!selectedDetail) return null;
    const laneKey = currentRole === "BOT" ? "ADC" : currentRole;
    return opggMeta?.lanes?.[laneKey]?.[selectedDetail.id] || null;
  }, [selectedDetail, currentRole, opggMeta]);

  // アーキタイプ判定
  const archetype: ChampionArchetype = useMemo(() => {
    if (!selectedDetail) return "ad_fighter";
    return detectChampionArchetype(
      selectedDetail.id,
      selectedDetail.tags || [],
      selectedDetail.info,
      "",
      currentRole
    );
  }, [selectedDetail, currentRole]);

  // シチュエーション別ビルド（アイテム辞書翻訳をリアルタイム適用）
  // 選択中ロールの実測ビルド（あれば「標準コア」をこちらで置き換える。2026-10-07）
  // 実測ビルドのキーは BOT。レーン設定（DB の champion_lane_roles）由来だと ADC で来るため揃える（本番で Jinx 等が出ていなかった）
  const measuredBuild = selectedDetail?.facts?.measuredBuilds?.[currentRole === "ADC" ? "BOT" : currentRole] || null;

  const currentBuild = useMemo(() => {
    const rawItems = measuredBuild?.core.length ? measuredBuild.core.map((c) => c.name) : (selectedDetail?.facts?.trendItems || []);
    const trendItems = rawItems.map((it) => translateItem(it, customItemDict));
    const trendKeystone = measuredBuild?.keystone?.name || selectedDetail?.facts?.trendRunes?.keystone || "";
    return getPresetBuildDetails(archetype, buildPreset, trendItems, trendKeystone, customItemDict, selectedDetail?.id);
  }, [archetype, buildPreset, selectedDetail, customItemDict, measuredBuild]);

  // 対戦相手（VS）のアーキタイプ判定
  const vsEnemyArchetype: ChampionArchetype = useMemo(() => {
    if (!vsEnemyDetail) return "ad_fighter";
    return detectChampionArchetype(
      vsEnemyDetail.id,
      vsEnemyDetail.tags || [],
      vsEnemyDetail.info,
      "",
      currentRole
    );
  }, [vsEnemyDetail, currentRole]);

  // 試合時間帯別の実測勝率（あれば「パワースパイク推移」はこちらを表示。2026-10-07）
  const measuredSpikes = selectedDetail?.facts?.measuredSpikes?.[currentRole === "ADC" ? "BOT" : currentRole] || null;

  // パワースパイク推定値（型ごとの手書きの目安。実測が無い時に「型ごとの目安」と明記して表示する）
  const spikeValues = useMemo(() => {
    switch (archetype) {
      case "ad_assassin": return { early: 8, mid: 9, late: 5 };
      case "ap_mage": return { early: 5, mid: 8, late: 9 };
      case "tank": return { early: 6, mid: 8, late: 8 };
      case "marksman": return { early: 4, mid: 7, late: 10 };
      case "enchanter": return { early: 6, mid: 7, late: 8 };
      default: return { early: 7, mid: 9, late: 7 };
    }
  }, [archetype]);

  // 目標ランク×ロールの実測平均（/api/coach/rank-benchmark）。「目標CS」をこれで置き換える（2026-10-08）
  const [roleBench, setRoleBench] = useState<{ tier: string; roles: Record<string, any> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/coach/rank-benchmark', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.roles) setRoleBench({ tier: d.targetTier, roles: d.roles }); })
      .catch(() => { /* 取れなければ従来の表示のまま */ });
    return () => { cancelled = true; };
  }, []);

  // ⚡ レーン別・チャンピオン固有のテンポ指標（動的算出）
  const laneTempo = useMemo(() => {
    if (!selectedDetail) return null;
    const base = getLaneTempoMetrics({
      id: selectedDetail.id,
      jpName: selectedDetail.jpName,
      archetype,
      role: currentRole,
      spikeValues,
      powerSpikesText: selectedDetail.facts?.powerSpikes,
      earlyStageText: selectedDetail.bible?.stages?.early,
    });
    if (!base) return base;
    // ★ 2026-10-08: 「最速フルクリア」「1stコア平均」「目標CS」は型ごとの固定値（全員 02:45〜02:50 / 11:20 / 8.5+ など）だった。
    //   実測（jungleTiming / 目標ランク平均）があれば置き換え、JGで実測が無い時は「データなし」にする
    const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
    const jt = selectedDetail.jungleTiming;
    const ROLE_TO_BENCH: Record<string, string> = { TOP: 'TOP', JG: 'JUNGLE', MID: 'MIDDLE', BOT: 'BOTTOM', ADC: 'BOTTOM', SUP: 'UTILITY' };
    const bench = roleBench?.roles?.[ROLE_TO_BENCH[currentRole] || ''];
    const benchCs = bench?.values?.cs_per_min;
    const fix = (m: any) => {
      if (!m) return m;
      if (m.label === '最速フルクリア') {
        return { ...m, value: jt?.fastestClearSec ? mmss(jt.fastestClearSec) : 'データなし', label: '最速フルクリア（実測）' };
      }
      if (m.label === '1stコア平均') {
        return jt?.avgFirstCoreSec
          ? { ...m, value: mmss(jt.avgFirstCoreSec), label: `1stコア平均（${jt.sampleCount ?? '?'}試合）` }
          : { ...m, value: 'データなし' };
      }
      if (m.label === '目標CS' && typeof benchCs === 'number') {
        return { ...m, value: `${benchCs.toFixed(1)} /分`, label: `目標CS（${roleBench?.tier}平均）` };
      }
      return m;
    };
    return { ...base, metric1: fix(base.metric1), metric2: fix(base.metric2) };
  }, [selectedDetail, archetype, currentRole, spikeValues, roleBench]);

  // 📖 序盤・中盤・終盤の立ち回り指南（動的生成）
  const stageTactics = useMemo(() => {
    if (!selectedDetail) return null;
    return getStageTactics({
      id: selectedDetail.id,
      jpName: selectedDetail.jpName,
      role: currentRole,
      archetype,
      bibleStages: selectedDetail.bible?.stages,
      powerSpikesText: selectedDetail.facts?.powerSpikes,
      strengths: selectedDetail.facts?.strengths,
      weaknesses: selectedDetail.facts?.weaknesses,
    });
  }, [selectedDetail, currentRole, archetype]);

  // 🎯 ピック判断ガイド（先出し・後出し・勝ち筋の動的生成）
  const dynamicPickGuide = useMemo(() => {
    if (!selectedDetail) return null;
    return getDynamicPickGuide({
      id: selectedDetail.id,
      jpName: selectedDetail.jpName,
      archetype,
      role: currentRole,
      strengths: selectedDetail.facts?.strengths,
      weaknesses: selectedDetail.facts?.weaknesses,
      counters: selectedDetail.facts?.counters,
      mustBan: selectedDetail.facts?.mustBan,
      winRate: currentLaneMeta?.winRate,
      tier: currentLaneMeta?.tier,
      staticPickGuide: selectedDetail.pickGuide,
    });
  }, [selectedDetail, archetype, currentRole, currentLaneMeta]);

  // 特定対面の特化メモ（Matchup Sentinelから検索）
  const matchedVsNote = useMemo(() => {
    if (!selectedDetail || !vsEnemyId) return null;
    const matchups = selectedDetail.matchups || [];
    return matchups.find(
      (m) => m.enemy.toLowerCase() === vsEnemyId.toLowerCase() ||
             m.note.toLowerCase().includes(vsEnemyId.toLowerCase())
    );
  }, [selectedDetail, vsEnemyId]);

  return {
    selectedDetail, vsEnemyDetail, availableRoles, currentRole, setCurrentRole, currentLaneMeta,
    archetype, currentBuild, measuredBuild, vsEnemyArchetype, spikeValues, measuredSpikes, laneTempo, stageTactics, dynamicPickGuide, matchedVsNote,
  };
}
