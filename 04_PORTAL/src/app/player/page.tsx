"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, User, Trophy, Activity } from "lucide-react";

export default function PlayerIndexPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.ign && p.ign.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight flex items-center gap-3">
            <User className="text-indigo-600" size={32} />
            プレイヤー検索
          </h1>
          <p className="text-stone-500 mt-2">
            プレイヤーを選択して詳細な戦績や相性を確認できます。
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="プレイヤー名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-black/10 rounded-lg pl-10 pr-4 py-2 text-stone-900 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <Search className="absolute left-3 top-2.5 text-gray-500 w-5 h-5" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPlayers.map((player) => (
            <Link href={`/player/${player.name}`} key={player.id}>
              <div className="bg-white/60 border border-black/10 hover:border-indigo-300 rounded-xl p-5 transition-all hover:bg-white group cursor-pointer h-full flex flex-col relative overflow-hidden">
                {!player.is_active && (
                  <div className="absolute top-0 right-0 bg-black/5 text-stone-500 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                    INACTIVE
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${player.is_active ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-black/5 border-black/10 text-stone-500'}`}>
                    {player.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-stone-900 group-hover:text-indigo-600 transition-colors">
                      {player.name}
                    </h3>
                    <p className="text-xs text-stone-500">{player.ign || "No IGN"}</p>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-black/10 flex justify-between items-center">
                  <div className="flex items-center gap-1.5 text-sm text-stone-500">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="font-mono">{player.highest_rank || "UNRANKED"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-stone-500">
                    <Activity className="w-4 h-4 text-rose-400" />
                    <span className="font-mono">
                      {Math.round(
                        ((player.mmr_top || 1200) +
                          (player.mmr_jg || 1200) +
                          (player.mmr_mid || 1200) +
                          (player.mmr_adc || 1200) +
                          (player.mmr_sup || 1200)) /
                          5
                      )} MMR
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          
          {filteredPlayers.length === 0 && (
            <div className="col-span-full py-12 text-center text-stone-500 bg-black/5 rounded-xl border border-black/10 border-dashed">
              プレイヤーが見つかりませんでした。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
