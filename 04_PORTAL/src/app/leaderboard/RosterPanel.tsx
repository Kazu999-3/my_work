"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Search, User, Trophy, Activity, Shield, Trees, Zap, Target, Heart, Sparkles, SlidersHorizontal } from "lucide-react";
import { useCurrentUser } from "../../hooks/useCurrentUser";

const ROLE_ICONS: Record<string, any> = {
  TOP: Shield,
  JG: Trees,
  MID: Zap,
  ADC: Target,
  SUP: Heart,
};

export default function RosterPanel() {
  const { user: currentUser } = useCurrentUser();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const res = await fetch('/api/players/list');
        const data = await res.json();
        if (res.ok && data.players) {
          setPlayers(data.players);
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    fetchPlayers();
  }, []);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      const matchSearch =
        !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.ign && p.ign.toLowerCase().includes(q)) ||
        (p.highest_rank && p.highest_rank.toLowerCase().includes(q));

      const isActive = p.is_active !== false;
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && isActive) ||
        (statusFilter === "INACTIVE" && !isActive);

      const prefs = p.role_preferences || {};
      const primary = (prefs.primary || "").toUpperCase();
      const secondary = (prefs.secondary || "").toUpperCase();
      
      const matchRole =
        roleFilter === "ALL" ||
        primary === roleFilter ||
        secondary === roleFilter;

      return matchSearch && matchStatus && matchRole;
    });
  }, [players, search, roleFilter, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-stone-500 font-bold text-xs animate-pulse flex items-center gap-2">
          <span>👥</span> 名簿データを読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 検索 ＆ フィルターバー */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 md:p-5 border border-stone-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* 検索窓 */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
          <input
            type="text"
            placeholder="プレイヤー名・Riot ID・ランクで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* ロール ＆ ステータスフィルター */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {["ALL", "TOP", "JG", "MID", "ADC", "SUP"].map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                roleFilter === role
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-stone-100 hover:bg-stone-200 text-stone-600"
              }`}
            >
              {role === "ALL" ? "全ロール" : role}
            </button>
          ))}

          <div className="h-4 w-px bg-stone-200 mx-1 shrink-0" />

          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="bg-stone-100 border border-stone-200 text-stone-700 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none shrink-0"
          >
            <option value="ALL">全ステータス</option>
            <option value="ACTIVE">アクティブのみ</option>
            <option value="INACTIVE">休止中のみ</option>
          </select>
        </div>
      </div>

      {/* プレイヤーグリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredPlayers.map((player) => {
          const prefs = player.role_preferences || {};
          const primaryRole = prefs.primary || "FILL";
          const secondaryRole = prefs.secondary || "FILL";
          const RoleIcon = ROLE_ICONS[primaryRole] || User;
          const isActive = player.is_active !== false;

          return (
            <Link
              key={player.id || player.name}
              href={`/player/${encodeURIComponent(player.name || player.discord_id)}`}
              className={`bg-white rounded-2xl p-5 border border-stone-200/90 hover:border-amber-400 transition-all shadow-xs hover:shadow-md flex flex-col justify-between group ${
                !isActive ? "opacity-60 bg-stone-50" : ""
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0 group-hover:scale-105 transition">
                      <RoleIcon size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-stone-900 truncate group-hover:text-amber-800 transition">
                        {player.name}
                      </h4>
                      <p className="text-[11px] font-mono text-stone-500 truncate">
                        {player.ign || "Riot ID未連携"}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-black text-amber-800 bg-amber-100/70 border border-amber-200/80 px-2 py-0.5 rounded-lg shrink-0">
                    {player.highest_rank || "UNRANKED"}
                  </span>
                </div>

                {/* レーン希望バッジ */}
                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  <span className="text-stone-500">希望:</span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 font-mono">
                    {primaryRole}
                  </span>
                  {secondaryRole !== "FILL" && (
                    <span className="px-2 py-0.5 rounded-md bg-stone-50 text-stone-600 font-mono">
                      / {secondaryRole}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500 font-medium">
                <span>カルテを見る</span>
                <span className="text-amber-600 font-black group-hover:translate-x-1 transition">→</span>
              </div>
            </Link>
          );
        })}
      </div>

      {filteredPlayers.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 text-stone-500 text-xs font-bold">
          該当するプレイヤーが見つかりませんでした。
        </div>
      )}
    </div>
  );
}
