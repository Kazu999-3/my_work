"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Search, User, Trophy, Activity, Shield, Trees, Zap, Target, Heart } from "lucide-react";

const ROLE_ICONS: Record<string, any> = {
  TOP: Shield,
  JG: Trees,
  MID: Zap,
  ADC: Target,
  SUP: Heart,
};

export default function PlayerIndexPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE");

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
    return players.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.ign && p.ign.toLowerCase().includes(search.toLowerCase()));

      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && p.is_active) ||
        (statusFilter === "INACTIVE" && !p.is_active);

      const prefs = p.role_preferences || {};
      const primary = (prefs.primary || p.preferred_lane || p.main_role || "").toUpperCase();
      const secondary = (prefs.secondary || "").toUpperCase();
      
      const matchRole =
        roleFilter === "ALL" ||
        primary === roleFilter.toUpperCase() ||
        secondary === roleFilter.toUpperCase() ||
        (roleFilter === "ALL" && !primary);

      return matchSearch && matchStatus && matchRole;
    });
  }, [players, search, roleFilter, statusFilter]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-stone-200/80 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
            <User className="text-indigo-600 h-7 w-7" />
            プレイヤー名簿 ＆ カルテ検索
          </h1>
          <p className="text-xs text-stone-500 font-bold mt-1">
            メンバーの戦績・得意チャンプ・MMRを即チェック🔥
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="名前 / サモナーネームで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-stone-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-stone-900 focus:outline-none focus:border-indigo-500 transition-all shadow-xs"
          />
          <Search className="absolute left-3.5 top-3 text-stone-400 w-4 h-4" />
        </div>
      </div>

      {/* フィルターバー */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 border border-stone-200/90 p-3 rounded-2xl shadow-xs">
        {/* ロール別ピル */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {["ALL", "TOP", "JG", "MID", "ADC", "SUP"].map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                roleFilter === role
                  ? "bg-indigo-600 text-white shadow-xs scale-105"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {role === "ALL" ? "全ロール" : role}
            </button>
          ))}
        </div>

        {/* アクティブ状態切り替え */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-[11px] font-bold">
          <button
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
              statusFilter === "ACTIVE"
                ? "bg-white text-stone-900 shadow-xs font-black"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            アクティブ ({players.filter((p) => p.is_active).length})
          </button>
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-white text-stone-900 shadow-xs font-black"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            全員 ({players.length})
          </button>
        </div>
      </div>

      {/* プレイヤーグリッド */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.map((player) => {
            const prefs = player.role_preferences || {};
            const mainRole = (prefs.primary || player.preferred_lane || player.main_role || "").toUpperCase();
            const subRole = (prefs.secondary || "").toUpperCase();
            const RoleIconComp = ROLE_ICONS[mainRole] || (roleFilter !== "ALL" ? ROLE_ICONS[roleFilter] : null);

            const roleKey = roleFilter !== "ALL" ? `mmr_${roleFilter.toLowerCase()}` : null;
            const specificMmr = roleKey ? player[roleKey] : null;
            const avgMmr = Math.round(
              ((player.mmr_top || 1200) +
                (player.mmr_jg || 1200) +
                (player.mmr_mid || 1200) +
                (player.mmr_adc || 1200) +
                (player.mmr_sup || 1200)) /
                5
            );
            const displayMmr = specificMmr || player.mmr || avgMmr;

            return (
              <Link href={`/player/${player.name}`} key={player.id}>
                <div className="bg-white border border-stone-200/90 hover:border-indigo-400 rounded-2xl p-5 transition-all hover:shadow-lg group cursor-pointer h-full flex flex-col relative overflow-hidden">
                  {!player.is_active && (
                    <div className="absolute top-0 right-0 bg-stone-100 text-stone-500 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg border-b border-l border-stone-200">
                      INACTIVE
                    </div>
                  )}

                  <div className="flex items-center gap-3.5 mb-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base border shadow-xs transition-transform group-hover:scale-105 shrink-0 ${
                        player.is_active
                          ? "bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700"
                          : "bg-stone-100 border-stone-200 text-stone-500"
                      }`}
                    >
                      {player.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-extrabold text-base text-stone-900 group-hover:text-indigo-600 transition-colors truncate">
                          {player.name}
                        </h3>
                        {RoleIconComp && (
                          <span title={mainRole ? `希望: ${mainRole}${subRole ? ` / ${subRole}` : ''}` : 'ロール未設定'}>
                            <RoleIconComp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 truncate font-mono">{player.ign || "No IGN"}</p>
                    </div>
                  </div>

                  <div className="mt-auto pt-3 border-t border-stone-100 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1 font-bold text-stone-600">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span className="font-mono">{player.highest_rank || "UNRANKED"}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      <Activity className="w-3.5 h-3.5" />
                      <span>{displayMmr} MMR{roleFilter !== "ALL" && specificMmr ? ` (${roleFilter})` : ''}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {filteredPlayers.length === 0 && (
            <div className="col-span-full py-16 text-center text-stone-400 bg-white rounded-2xl border border-stone-200 border-dashed space-y-2">
              <p className="text-sm font-bold text-stone-600">該当するプレイヤーが見つかりませんでした</p>
              <p className="text-xs">検索キーワードやロールフィルターを変更してお試しください。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
