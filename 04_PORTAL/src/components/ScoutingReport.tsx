"use client";

import { AlertTriangle, Crosshair, Target, ShieldAlert, Activity } from "lucide-react";
import { getChampIcon } from "../lib/ddragonClient";

interface ScoutingReportProps {
  stats: any;
  mmr: number;
}

export default function ScoutingReport({ stats, mmr }: ScoutingReportProps) {
  if (!stats || Object.keys(stats).length === 0 || !Object.values(stats).some(s => s !== null)) {
    return (
      <div className="w-full h-full bg-gray-900/50 rounded-lg p-6 flex flex-col items-center justify-center border border-gray-800 text-gray-500 text-sm">
        試合データが不足しているため、スカウティングレポートを生成できません。
      </div>
    );
  }

  // 1. 各種分析用データの収集
  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  let totalGames = 0;
  let totalWins = 0;
  
  let mostPlayedRole = { role: '', games: 0, winRate: 0 };
  let bestRole = { role: '', games: 0, winRate: 0 };
  let worstRole = { role: '', games: 0, winRate: 100 };
  
  const allChamps: any[] = [];

  roles.forEach(role => {
    const s = stats[role];
    if (s && s.totalGames > 0) {
      totalGames += s.totalGames;
      totalWins += s.totalWins;
      
      if (s.totalGames > mostPlayedRole.games) {
        mostPlayedRole = { role, games: s.totalGames, winRate: s.winRate };
      }
      
      // 3戦以上しているロールの中で勝率を比較
      if (s.totalGames >= 2) {
        if (s.winRate >= bestRole.winRate) {
          bestRole = { role, games: s.totalGames, winRate: s.winRate };
        }
        if (s.winRate <= worstRole.winRate) {
          worstRole = { role, games: s.totalGames, winRate: s.winRate };
        }
      }

      if (s.topChampions) {
        s.topChampions.forEach((c: any) => {
          allChamps.push({ ...c, role });
        });
      }
    }
  });

  const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  // 要注意チャンピオンの選定 (試合数と勝率でスコア化)
  allChamps.sort((a, b) => {
    const scoreA = a.games * (a.winRate / 100);
    const scoreB = b.games * (b.winRate / 100);
    return scoreB - scoreA;
  });
  
  const warningChamp = allChamps.length > 0 && allChamps[0].games >= 2 ? allChamps[0] : null;

  // 2. レポートの構築
  return (
    <div className="w-full bg-gray-900/50 rounded-lg p-5 border border-gray-800 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-4 text-emerald-400 font-bold tracking-widest text-sm border-b border-gray-800 pb-2">
        <Activity className="w-4 h-4" />
        SCOUTING REPORT
      </div>

      <div className="space-y-4">
        {/* メインロールの傾向 */}
        {mostPlayedRole.games > 0 && (
          <div className="flex gap-3 items-start">
            <div className="mt-0.5"><Target className="w-5 h-5 text-blue-400" /></div>
            <div>
              <div className="text-xs font-bold text-gray-500 mb-1">MAIN ROLE & WINRATE</div>
              <p className="text-sm text-gray-300">
                主に <span className="font-bold text-blue-300">{mostPlayedRole.role}</span> をプレイ ({mostPlayedRole.games}戦)。
                勝率は <span className={`font-bold ${overallWinRate >= 55 ? 'text-emerald-400' : overallWinRate <= 45 ? 'text-red-400' : 'text-gray-300'}`}>{overallWinRate}%</span>。
                {overallWinRate >= 60 ? " チームの核となるキャリープレイヤーのため徹底マークが必要。" : 
                 overallWinRate >= 50 ? " 安定したパフォーマンスを発揮する。" : " 現在苦戦傾向にある。"}
              </p>
            </div>
          </div>
        )}

        {/* 警戒すべきチャンピオン */}
        {warningChamp && warningChamp.name !== 'Unknown' && (
          <div className="flex gap-3 items-start">
            <div className="mt-0.5"><AlertTriangle className="w-5 h-5 text-amber-500" /></div>
            <div className="flex-1">
              <div className="text-xs font-bold text-gray-500 mb-1">TARGET BAN</div>
              <div className="flex items-center gap-2 bg-gray-950 p-2 rounded border border-gray-800/50 mb-2">
                <img 
                  src={getChampIcon(warningChamp.name)} 
                  className="w-8 h-8 rounded-full shadow-sm border border-amber-900/50"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div>
                  <div className="text-sm font-bold text-amber-400">{warningChamp.name}</div>
                  <div className="text-xs text-gray-500">{warningChamp.games}戦 勝率{warningChamp.winRate}%</div>
                </div>
              </div>
              <p className="text-sm text-gray-300">
                使用頻度・勝率ともに高く、最も警戒すべきピック。可能であればBANを強く推奨。
              </p>
            </div>
          </div>
        )}

        {/* 弱点 */}
        {worstRole.games >= 2 && worstRole.winRate <= 40 && worstRole.role !== mostPlayedRole.role && (
          <div className="flex gap-3 items-start">
            <div className="mt-0.5"><Crosshair className="w-5 h-5 text-red-500" /></div>
            <div>
              <div className="text-xs font-bold text-gray-500 mb-1">WEAKNESS</div>
              <p className="text-sm text-gray-300">
                <span className="font-bold text-red-400">{worstRole.role}</span> に回された際の勝率が非常に低い ({worstRole.winRate}%)。
                オートフィル時は明確な穴になりやすいため、序盤から積極的に狙うべき。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
