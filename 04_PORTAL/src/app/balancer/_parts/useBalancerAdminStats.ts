"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";

// 管理者向けの集計（MMR整合性・予測勝率の的中率・サイド偏り・バランス満足度）。
// 2026-10-07 app/balancer/page.tsx から分離（処理は分離前と同じ）。
export function useBalancerAdminStats(isAdmin: boolean) {
  const [integrityData, setIntegrityData] = useState<any>(null);
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);

  const checkIntegrity = async () => {
    setCheckingIntegrity(true);
    try {
      const res = await fetch("/api/mmr/check-integrity", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIntegrityData(data);
    } catch (err: any) {
      console.error("Integrity check failed:", err);
    } finally {
      setCheckingIntegrity(false);
    }
  };

  // バランサー予測勝率の的中率（課題: 予測勝率の検証）
  const [predStats, setPredStats] = useState<{ total: number; correct: number; accuracy: number; avgConfidence: number; avgCloseness: number; recentCloseness: number[] } | null>(null);
  const fetchPredStats = async () => {
    try {
      const { data } = await supabase
        .from('balancer_predictions')
        .select('predicted_blue_winprob, correct')
        .not('correct', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      const rows = data || [];
      if (rows.length === 0) { setPredStats({ total: 0, correct: 0, accuracy: 0, avgConfidence: 0, avgCloseness: 0, recentCloseness: [] }); return; }
      const correct = rows.filter((r: any) => r.correct).length;
      // 予測の自信度 = 50%からどれだけ離れているか（0=完全拮抗, 50=一方的予測）。低いほどバランサーが拮抗を作れている
      const avgConfidence = rows.reduce((s: number, r: any) => s + Math.abs(Number(r.predicted_blue_winprob) - 0.5) * 100, 0) / rows.length;
      // 接戦度(#82): 100=完全拮抗(予測50%)、0=一方的(予測0/100%)。毎試合の「良いチーム分けだったか」採点
      const closenessOf = (p: number) => Math.round(100 - Math.abs(p - 0.5) * 200);
      const avgCloseness = rows.reduce((s: number, r: any) => s + closenessOf(Number(r.predicted_blue_winprob)), 0) / rows.length;
      const recentCloseness = rows.slice(0, 10).map((r: any) => closenessOf(Number(r.predicted_blue_winprob)));
      setPredStats({ total: rows.length, correct, accuracy: Math.round((correct / rows.length) * 100), avgConfidence: +avgConfidence.toFixed(1), avgCloseness: Math.round(avgCloseness), recentCloseness });
    } catch (e) {
      console.error('pred stats fetch failed', e);
    }
  };

  // サイド偏り検証(#81): Blue/Redの勝率差を集計（headカウントでエグレス最小）
  const [sideStats, setSideStats] = useState<{ total: number; blueWins: number; blueRate: number } | null>(null);
  const fetchSideStats = async () => {
    try {
      const [{ count: total }, { count: blueWins }] = await Promise.all([
        supabase.from('ktm_matches').select('id', { count: 'exact', head: true }),
        supabase.from('ktm_matches').select('id', { count: 'exact', head: true }).eq('winning_team', 'BLUE'),
      ]);
      const t = total || 0;
      const b = blueWins || 0;
      setSideStats({ total: t, blueWins: b, blueRate: t > 0 ? Math.round((b / t) * 1000) / 10 : 0 });
    } catch (e) {
      console.error('side stats fetch failed', e);
    }
  };

  // バランス満足度(👍/👎)の集計（課題#42）
  const [satStats, setSatStats] = useState<{ tallied: number; totalUp: number; totalDown: number; totalNeutral?: number; recent?: { up: number; down: number; neutral: number }[]; satisfactionRate: number | null } | null>(null);
  const [tallyingSat, setTallyingSat] = useState(false);
  // 満足度は成績入力時に記録される方式になったため、Discordを叩かずDBから直接集計する。
  const fetchSatStats = async () => {
    setTallyingSat(true);
    try {
      const { data } = await supabase
        .from('balancer_predictions')
        .select('satisfaction_up, satisfaction_down')
        .not('satisfaction_updated_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);
      const rows = data || [];
      const totalUp = rows.filter((r: any) => r.satisfaction_up > 0).length;
      const totalDown = rows.filter((r: any) => r.satisfaction_down > 0).length;
      const totalNeutral = rows.filter((r: any) => !r.satisfaction_up && !r.satisfaction_down).length;
      const votes = totalUp + totalDown;
      setSatStats({
        tallied: rows.length,
        totalUp,
        totalDown,
        totalNeutral,
        recent: rows.slice(0, 10).map((r: any) => ({ up: r.satisfaction_up || 0, down: r.satisfaction_down || 0, neutral: (!r.satisfaction_up && !r.satisfaction_down) ? 1 : 0 })),
        satisfactionRate: votes > 0 ? Math.round((totalUp / votes) * 100) : null,
      });
    } catch (e) {
      console.error('satisfaction tally failed', e);
    } finally {
      setTallyingSat(false);
    }
  };

  useEffect(() => {
    if (isAdmin) { checkIntegrity(); fetchPredStats(); fetchSideStats(); }
  }, [isAdmin]);

  return {
    integrityData, checkingIntegrity, checkIntegrity,
    predStats, fetchPredStats,
    sideStats, fetchSideStats,
    satStats, tallyingSat, fetchSatStats,
  };
}
