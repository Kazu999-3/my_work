import { useEffect, useState } from "react";
import { X, RefreshCw, Swords, Shield, Star, Crosshair, Zap, Activity, Info } from "lucide-react";
import Image from "next/image";
import { getChampIcon, getChampNameById } from "../../lib/ddragonClient";
import { getPlayerTier } from "../../lib/playerTier";
import ScoutingReport from "../../components/ScoutingReport";

interface ProfileModalProps {
  player: any;
  onClose: () => void;
}

const roleIcons: Record<string, any> = {
  TOP: <Shield className="w-5 h-5 text-primary-700" />,
  JG: <Zap className="w-5 h-5 text-success-700" />,
  MID: <Star className="w-5 h-5 text-danger-400" />,
  ADC: <Crosshair className="w-5 h-5 text-primary-700" />,
  SUP: <Star className="w-5 h-5 text-primary-700" />
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
      let mainChamps = player.main_champions;
      if (typeof mainChamps === 'string') {
        try { mainChamps = JSON.parse(mainChamps); } catch (e) {}
      }
      
      if (mainChamps && Array.isArray(mainChamps)) {
        const resolved = await Promise.all(
          mainChamps.map(async (m: any) => {
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
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden relative flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border bg-black/5 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center text-2xl font-bold border-2 border-primary-edge-strong overflow-hidden">
              {player.ign ? player.ign.charAt(0).toUpperCase() : player.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-foreground">{player.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-faint text-sm font-medium">{player.ign || "IGN未登録"}</span>
                <span className="bg-primary-100 text-primary-700 border border-primary-edge-soft px-2 py-0.5 rounded text-xs font-bold">
                  {player.highest_rank || "UNRANKED"}
                </span>
                <span className="bg-primary-100 text-primary-700 border border-primary-edge-soft px-2 py-0.5 rounded text-xs font-bold">
                  MMR: {player.mmr || 1200}
                </span>
                {(() => {
                  const totalG = player.total_games ?? player.games ?? player.metadata?.games ?? stats?.totalMatches ?? 0;
                  const daysAgo = player.days_since_last_match;
                  const tierInfo = getPlayerTier({
                    ...player,
                    total_games: totalG,
                    days_since_last_match: daysAgo,
                  });

                  return (
                    <span 
                      title={tierInfo.tip}
                      className={`px-2 py-0.5 rounded text-xs font-black border ${tierInfo.colorClass}`}
                    >
                      {tierInfo.label} (通算{totalG}戦{daysAgo !== null && daysAgo !== undefined && daysAgo > 30 ? ` / ${daysAgo}日前` : ''})
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-faint hover:text-foreground bg-black/5 hover:bg-black/8 p-2 rounded-full transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Riot API Mastery */}
          <section>
            <h3 className="text-xl font-bold text-foreground-soft mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-primary-500" />
              得意チャンピオン (Riotマスタリー)
            </h3>
            {riotMasteries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {riotMasteries.map((m, idx) => (
                  <div key={idx} className="bg-surface/60 border border-border rounded-lg p-4 flex items-center gap-4">
                    <Image
                      src={m.iconUrl}
                      alt={m.name}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-full border-2 border-primary-edge object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = getChampIcon('Unknown'); }}
                    />
                    <div>
                      <div className="text-lg font-bold text-foreground">{m.name === 'Unknown' ? `ID:${m.championId}` : m.name}</div>
                      <div className="text-sm text-faint">Lv {m.championLevel} • {m.championPoints.toLocaleString()} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-strong italic bg-black/5 p-4 rounded-lg border border-border">
                Riot APIの同期データがありません。ダッシュボードから一括同期を行ってください。
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xl font-bold text-foreground-soft mb-4 flex items-center gap-2">
              <Swords className="w-5 h-5 text-success-500" />
              KTM 戦績 ＆ プレイスタイル分析
            </h3>
            
            {loading ? (
              <div className="flex justify-center p-8">
                <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
              </div>
            ) : stats && Object.keys(stats).some(k => stats[k] !== null) ? (
              <div className="space-y-6">
                
                {/* プレイスタイル・AI分析 */}
                <div className="bg-surface/60 border border-border rounded-lg p-4 flex flex-col md:flex-row gap-6 items-center">
                  <div className="w-full md:w-1/3">
                    <ScoutingReport stats={stats} mmr={player.mmr || 1200} />
                  </div>
                  <div className="w-full md:w-2/3 space-y-3">
                    <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary-700" />
                      AI プレイスタイル分析
                    </h4>
                    <p className="text-faint text-sm">
                      過去のKTM内戦の勝率、プレイ回数、選択レーン、そして現在のMMRから算出されたプレイスタイル指標です。
                    </p>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="bg-surface p-3 rounded border border-border">
                        <div className="text-xs text-muted-strong font-bold mb-1">総合勝率</div>
                        <div className="text-2xl font-black text-success-700">
                          {Math.round(
                            Object.values(stats as Record<string, any>).reduce((acc:any, s:any) => acc + (s ? s.totalWins : 0), 0) /
                            Math.max(1, Object.values(stats as Record<string, any>).reduce((acc:any, s:any) => acc + (s ? s.totalGames : 0), 0)) * 100
                          )}%
                        </div>
                      </div>
                      <div className="bg-surface p-3 rounded border border-border">
                        <div className="text-xs text-muted-strong font-bold mb-1">総試合数</div>
                        <div className="text-2xl font-black text-primary-700">
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
                    <div key={role} className="bg-black/5 border border-border rounded-lg p-4 flex flex-col h-full">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          {roleIcons[role]}
                          <span className="font-bold text-lg text-foreground-soft">{role}</span>
                        </div>
                        <span className="text-xs text-faint font-medium bg-surface px-2 py-1 rounded">
                          MMR: {player[`mmr_${role.toLowerCase()}`] || 1200}
                        </span>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-faint">勝率 ({s.totalWins}W {s.totalGames - s.totalWins}L)</span>
                          <span className={`font-bold ${s.winRate >= 50 ? 'text-success-700' : 'text-danger-700'}`}>
                            {s.winRate}%
                          </span>
                        </div>
                        <div className="w-full bg-surface rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${s.winRate >= 50 ? 'bg-success-500' : 'bg-danger-500'}`} 
                            style={{ width: `${s.winRate}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="mt-auto space-y-2">
                        <div className="text-xs text-muted-strong font-bold uppercase mb-2">よく使うチャンピオン</div>
                        {s.topChampions.map((champ: any, cIdx: number) => {
                          if (champ.name === 'Unknown') {
                            return (
                              <div key={cIdx} className="flex items-center gap-2 bg-black/3 p-1.5 rounded">
                                <div className="w-6 h-6 rounded-full bg-black/5 flex items-center justify-center text-muted-strong text-[10px]">?</div>
                                <div className="flex-1 text-sm font-medium text-muted-strong italic">記録なし</div>
                                <div className="text-xs text-muted-strong">{champ.games}戦</div>
                              </div>
                            );
                          }
                          return (
                            <div key={cIdx} className="flex items-center gap-2 bg-black/3 p-1.5 rounded">
                              <Image
                                src={getChampIcon(champ.name)}
                                alt={champ.name}
                                width={24}
                                height={24}
                                className="w-6 h-6 rounded-full bg-black/5"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                              <div className="flex-1 text-sm font-medium text-foreground-subtle truncate">{champ.name}</div>
                              <div className="text-xs text-muted-strong">{champ.games}戦</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            ) : (
               <div className="text-muted-strong italic bg-black/5 p-4 rounded-lg border border-border">
                KTMでの試合記録がまだありません。
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
