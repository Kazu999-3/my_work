"use client";

import { ResponsiveContainer, RadarChart as RechartsRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from "recharts";

interface RadarChartProps {
  stats: any; // KTM内部の試合データ (api/player/profile から取得した値)
  mmr: number;
}

export default function RadarChart({ stats, mmr }: RadarChartProps) {
  // statsから擬似的に5つのパラメーターを算出する
  let totalGames = 0;
  let totalWins = 0;
  
  if (stats) {
    Object.values(stats).forEach((s: any) => {
      if (s) {
        totalGames += s.totalGames;
        totalWins += s.totalWins;
      }
    });
  }

  // デフォルト値 (試合がない場合)
  let aggro = 50;
  let survive = 50;
  let farm = 50;
  let vision = 50;
  let carry = 50;

  if (totalGames > 0) {
    const winRate = (totalWins / totalGames) * 100;
    
    // MMRと勝率をベースに少しステータスをバラけさせる（KDAがAPIから取れない場合の擬似生成ロジック）
    // TODO: 今後APIにKDAや視界スコアを追加した場合は、ここの計算式を本物のデータに置き換える
    
    // 攻撃力 (勝率とプレイ回数が高いほど高くなる)
    aggro = Math.min(100, Math.max(30, winRate + (totalGames * 0.5) + (mmr / 50)));
    
    // 生存力 (ベース50に、MMRボーナス)
    survive = Math.min(100, Math.max(30, 40 + (mmr / 30) - (totalGames * 0.2)));
    
    // ファーム力 (MMRに大きく依存)
    farm = Math.min(100, Math.max(30, 30 + (mmr / 20)));
    
    // 視界管理 (サポートなどをプレイしていると高くなる擬似調整)
    const supGames = stats['SUP']?.totalGames || 0;
    const jgGames = stats['JG']?.totalGames || 0;
    vision = Math.min(100, Math.max(30, 40 + (supGames * 2) + (jgGames * 1) + (mmr / 40)));
    
    // キャリー力 (Mid/ADCのプレイ回数と勝率に依存)
    const adcGames = stats['ADC']?.totalGames || 0;
    const midGames = stats['MID']?.totalGames || 0;
    carry = Math.min(100, Math.max(30, winRate - 10 + (adcGames + midGames)));
  }

  const data = [
    { subject: "攻撃力", value: Math.round(aggro), fullMark: 100 },
    { subject: "生存力", value: Math.round(survive), fullMark: 100 },
    { subject: "視界管理", value: Math.round(vision), fullMark: 100 },
    { subject: "ファーム", value: Math.round(farm), fullMark: 100 },
    { subject: "影響力", value: Math.round(carry), fullMark: 100 },
  ];

  return (
    <div className="w-full h-64 bg-gray-900/50 rounded-lg p-2 flex items-center justify-center border border-gray-800">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#4B5563" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: "#9CA3AF", fontSize: 12, fontWeight: "bold" }} 
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={false} 
            axisLine={false} 
          />
          <Radar
            name="Playstyle"
            dataKey="value"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.5}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: "#1F2937", border: "none", borderRadius: "8px", color: "#fff" }}
            itemStyle={{ color: "#60A5FA", fontWeight: "bold" }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
