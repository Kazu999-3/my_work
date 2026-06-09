"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { User, RefreshCw, LogIn } from "lucide-react";

export default function MyPageRedirect() {
  const router = useRouter();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. ローカルストレージに保存されているか確認
    const savedId = localStorage.getItem("ktm_my_discord_id");
    if (savedId) {
      router.replace(`/player/${savedId}`);
      return;
    }

    // 2. 保存されていなければプレイヤー一覧を取得して選択させる
    async function fetchPlayers() {
      try {
        const { data, error } = await supabase
          .from("ktm_players")
          .select("discord_id, name")
          .order("name", { ascending: true });
        
        if (!error && data) {
          setPlayers(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, [router]);

  const handleSelect = (discordId: string) => {
    localStorage.setItem("ktm_my_discord_id", discordId);
    router.push(`/player/${discordId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans">
      <div className="max-w-2xl mx-auto mt-12 bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
        
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-blue-500/50">
            <LogIn className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-black mb-2">マイページのセットアップ</h1>
          <p className="text-gray-400">
            あなたのプレイヤー名を選択してください。<br/>
            次回からは自動的にあなたのマイページが開きます。
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
          {players.map(p => (
            <button
              key={p.discord_id}
              onClick={() => handleSelect(p.discord_id)}
              className="flex items-center gap-2 p-3 bg-gray-800/50 hover:bg-blue-600/20 border border-gray-700 hover:border-blue-500/50 rounded-xl transition-all text-left"
            >
              <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                <User size={12} />
              </div>
              <span className="font-bold truncate text-sm">{p.name}</span>
            </button>
          ))}
        </div>
        
        {players.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            プレイヤーデータが見つかりません。
          </div>
        )}
      </div>
    </div>
  );
}
