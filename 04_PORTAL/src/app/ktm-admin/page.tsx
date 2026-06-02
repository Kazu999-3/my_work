"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Save, Plus, Users, Swords, AlertCircle, RefreshCw } from "lucide-react";

export default function KtmAdminPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ktm_players")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setPlayers(data || []);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (index: number, field: string, value: any) => {
    const updated = [...players];
    
    // role_preferences の入れ子に対応
    if (field === "primary_role") {
      updated[index].role_preferences = {
        ...updated[index].role_preferences,
        primary: value
      };
    } else if (field === "secondary_role") {
      updated[index].role_preferences = {
        ...updated[index].role_preferences,
        secondary: value
      };
    } else {
      updated[index][field] = value;
    }
    
    setPlayers(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const { error } = await supabase.from("ktm_players").upsert(
        players.map((p) => ({
          id: p.id,
          discord_id: p.discord_id,
          name: p.name,
          ign: p.ign,
          mmr: parseInt(p.mmr) || 1000,
          role_preferences: p.role_preferences,
          is_active: p.is_active
        }))
      );
      if (error) throw error;
      setMessage({ type: "success", text: "✅ プレイヤー情報をすべて保存しました。" });
      fetchPlayers();
    } catch (err: any) {
      setMessage({ type: "error", text: "❌ 保存エラー: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const addNewPlayer = () => {
    const newPlayer = {
      discord_id: `new-${Date.now()}`,
      name: "新規プレイヤー",
      ign: "",
      mmr: 1000,
      role_preferences: { primary: "FILL", secondary: "FILL" },
      is_active: true
    };
    setPlayers([newPlayer, ...players]);
  };

  if (loading && players.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-3">データを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              KTM 管理ダッシュボード
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              プレイヤー名簿の管理とMMRの手動調整（旧スプレッドシート機能）
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={addNewPlayer}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition"
            >
              <Plus className="h-4 w-4" /> 行を追加
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition ${
                saving ? "bg-blue-800 text-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "保存中..." : "変更を保存"}
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message.text && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'error' ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-green-900/30 text-green-400 border border-green-800'}`}>
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {/* Player Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-800/50 text-gray-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Discord ID</th>
                  <th className="px-6 py-4 font-medium">名前 (表示名)</th>
                  <th className="px-6 py-4 font-medium">Riot IGN</th>
                  <th className="px-6 py-4 font-medium text-center">MMR</th>
                  <th className="px-6 py-4 font-medium">Main Lane</th>
                  <th className="px-6 py-4 font-medium">Sub Lane</th>
                  <th className="px-6 py-4 font-medium text-center">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {players.map((p, i) => (
                  <tr key={p.id || p.discord_id} className="hover:bg-gray-800/30 transition">
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={p.discord_id}
                        onChange={(e) => handleInputChange(i, "discord_id", e.target.value)}
                        className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-2 py-1 outline-none w-32"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => handleInputChange(i, "name", e.target.value)}
                        className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-2 py-1 outline-none w-32 font-medium text-white"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={p.ign || ""}
                        onChange={(e) => handleInputChange(i, "ign", e.target.value)}
                        placeholder="Name#TAG"
                        className="bg-transparent border border-transparent focus:border-gray-700 hover:border-gray-700 focus:bg-gray-800 rounded px-2 py-1 outline-none w-40 text-blue-400"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        value={p.mmr}
                        onChange={(e) => handleInputChange(i, "mmr", e.target.value)}
                        className="bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 outline-none w-20 text-center text-white font-mono"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <select
                        value={p.role_preferences?.primary || "FILL"}
                        onChange={(e) => handleInputChange(i, "primary_role", e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none focus:border-blue-500 w-24"
                      >
                        <option value="TOP">TOP</option>
                        <option value="JUNGLE">JUNGLE</option>
                        <option value="MID">MID</option>
                        <option value="ADC">ADC</option>
                        <option value="SUPPORT">SUPPORT</option>
                        <option value="FILL">FILL</option>
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <select
                        value={p.role_preferences?.secondary || "FILL"}
                        onChange={(e) => handleInputChange(i, "secondary_role", e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 outline-none focus:border-blue-500 w-24"
                      >
                        <option value="TOP">TOP</option>
                        <option value="JUNGLE">JUNGLE</option>
                        <option value="MID">MID</option>
                        <option value="ADC">ADC</option>
                        <option value="SUPPORT">SUPPORT</option>
                        <option value="FILL">FILL</option>
                      </select>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={p.is_active}
                        onChange={(e) => handleInputChange(i, "is_active", e.target.checked)}
                        className="h-4 w-4 rounded border-gray-700 text-blue-600 focus:ring-blue-500 bg-gray-800 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
                
                {players.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      プレイヤーが登録されていません。「行を追加」から新規作成するか、Discord Botで登録を行ってください。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
