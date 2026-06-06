import { useEffect, useState } from "react";
import { X, RefreshCw, Swords, Shield, Star, Crosshair, Zap, Activity } from "lucide-react";
import { getChampIcon, getChampNameById } from "../../lib/ddragonClient";
import RadarChart from "../../components/RadarChart";

interface ProfileModalProps {
  player: any;
  onClose: () => void;
}

const roleIcons: Record<string, any> = {
  TOP: <Shield className="w-5 h-5 text-purple-400" />,
  JG: <Zap className="w-5 h-5 text-green-400" />,
  MID: <Star className="w-5 h-5 text-red-400" />,
  ADC: <Crosshair className="w-5 h-5 text-blue-400" />,
  SUP: <Star className="w-5 h-5 text-yellow-400" />
};

export default function ProfileModal({ player, onClose }: ProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [riotMasteries, setRiotMasteries] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      
      // 1. KTMの内部履歴(勝率・ピック率)の取得
      try {
        const res = await fetch(`/api/player/profile?name=${encodeURIComponent(player.name)}`);
        const data = await res.json();
        if (data.stats) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Failed to fetch KTM stats", err);
      }

      // 2. Riotマスタリーのチャンピオン名解決
      if (player.main_champions && Array.isArray(player.main_champions)) {
        const resolved = await Promise.all(
          player.main_champions.map(async (m: any) => {
            const name = await getChampNameById(m.championId);
            return {
              ...m,
              name,
              iconUrl: getChampIcon(name)
            };
          })
        );
        setRiotMasteries(resolved);
      }
      
      setLoading(false);
    }

    loadData();
  }, [player]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden relative flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-gray-950/50 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center text-2xl font-bold border-2 border-blue-500 overflow-hidden">
              {player.ign ? player.ign.charAt(0).toUpperCase() : player.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-white">{player.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400 text-sm font-medium">{player.ign || "IGN未登録"}</span>
                <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-xs font-bold">
                  {player.highest_rank || "UNRANKED"}
                </span>
                <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded text-xs font-bold">
                  MMR: {player.mmr || 1000}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-full transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Riot API Mastery */}
          <section>
            <h3 className="text-xl font-bold text-gray-200 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              得意チャンピオン (Riotマスタリー)
            </h3>
            {riotMasteries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {riotMasteries.map((m, idx) => (
                  <div key={idx} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 flex items-center gap-4">
                    <img 
                      src={m.iconUrl} 
                      alt={m.name} 
                      className="w-14 h-14 rounded-full border-2 border-yellow-500/50 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/29.png' }}
                    />
                    <div>
                      <div className="text-lg font-bold text-white">{m.name === 'Unknown' ? `ID:${m.championId}` : m.name}</div>
                      <div className="text-sm text-gray-400">Lv {m.championLevel} • {m.championPoints.toLocaleString()} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 italic bg-gray-800/30 p-4 rounded-lg border border-gray-800">
                Riot APIの同期データがありません。ダッシュボードから一括同期を行ってください。
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xl font-bold text-gray-200 mb-4 flex items-center gap-2">
              <Swords className="w-5 h-5 text-emerald-500" />
              KTM 戦績 ＆ プレイスタイル分析
            </h3>
            
            {loading ? (
              <div className="flex justify-center p-8">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : stats && Object.keys(stats).some(k => stats[k] !== null) ? (
              <div className="space-y-6">
                
                {/* プレイスタイル・レーダーチャート */}
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 flex flex-col md:flex-row gap-6 items-center">
                  <div className="w-full md:w-1/3">
                    <RadarChart stats={stats} mmr={player.mmr || 1000} />
                  </div>
                  <div className="w-full md:w-2/3 space-y-3">
                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                      <Activity className="w-5 h-5 text-blue-400" />
                      AI プレイスタイル分析
                    </h4>
                    <p className="text-gray-400 text-sm">
                      過去のKTM内戦の勝率、プレイ回数、選択レーン、そして現在のMMRから算出されたプレイスタイル指標です。
                    </p>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="bg-gray-900 p-3 rounded border border-gray-800">
                        <div className="text-xs text-gray-500 font-bold mb-1">総合勝率</div>
                        <div className="text-2xl font-black text-emerald-400">
                          {Math.round(
                            Object.values(stats as Record<string, any>).reduce((acc:any, s:any) => acc + (s ? s.totalWins : 0), 0) /
                            Math.max(1, Object.values(stats as Record<string, any>).reduce((acc:any, s:any) => acc + (s ? s.totalGames : 0), 0)) * 100
                          )}%
                        </div>
                      </div>
                      <div className="bg-gray-900 p-3 rounded border border-gray-800">
                        <div className="text-xs text-gray-500 font-bold mb-1">総試合数</div>
                        <div className="text-2xl font-black text-blue-400">
                          {Object.values(stats as Record<string, any>).reduce((acc:any, s:any) => acc + (s ? s.totalGames : 0), 0)}戦
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* レーン別スタッツ */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {['TOP', 'JG', 'MID', 'ADC', 'SUP'].map(role => {
                  const s = stats[role];
                  if (!s) return null;
                  
                  return (
                    <div key={role} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col h-full">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          {roleIcons[role]}
                          <span className="font-bold text-lg text-gray-200">{role}</span>
                        </div>
                        <span className="text-xs text-gray-400 font-medium bg-gray-900 px-2 py-1 rounded">
                          MMR: {player[`mmr_${role.toLowerCase()}`] || 1200}
                        </span>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">勝率 ({s.totalWins}W {s.totalGames - s.totalWins}L)</span>
                          <span className={`font-bold ${s.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {s.winRate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-900 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${s.winRate >= 50 ? 'bg-emerald-500' : 'bg-red-500'}`} 
                            style={{ width: `${s.winRate}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="mt-auto space-y-2">
                        <div className="text-xs text-gray-500 font-bold uppercase mb-2">よく使うチャンピオン</div>
                        {s.topChampions.map((champ: any, cIdx: number) => (
                          <div key={cIdx} className="flex items-center gap-2 bg-gray-900/50 p-1.5 rounded">
                            <img 
                              src={getChampIcon(champ.name)} 
                              alt={champ.name} 
                              className="w-6 h-6 rounded-full bg-gray-800"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                            <div className="flex-1 text-sm font-medium text-gray-300 truncate">{champ.name}</div>
                            <div className="text-xs text-gray-500">{champ.games}戦</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            ) : (
               <div className="text-gray-500 italic bg-gray-800/30 p-4 rounded-lg border border-gray-800">
                KTMでの試合記録がまだありません。
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
