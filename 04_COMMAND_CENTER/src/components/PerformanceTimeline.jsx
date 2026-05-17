import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { TrendingUp, Award, Target, Activity, Zap } from 'lucide-react'
import { format } from 'date-fns'

const PerformanceTimeline = ({ matchups }) => {
  // 過去の試合データを時系列に整理
  const chartData = useMemo(() => {
    return matchups
      .filter(m => m.raw_data?.my_kda)
      .slice(0, 10) // 直近10試合
      .reverse()
      .map((m, i) => {
        const [k, d, a] = m.raw_data.my_kda.split('/').map(Number)
        const kda = d === 0 ? (k + a) : Number(((k + a) / d).toFixed(2))
        const cs = m.raw_data.my_cs || 0
        const date = m.created_at ? format(new Date(m.created_at), 'MM/dd') : `Game ${i+1}`
        
        return {
          name: date,
          kda: kda,
          cs: cs,
          champion: m.champion,
          result: m.raw_data.result === 'Win' ? 1 : 0
        }
      })
  }, [matchups])

  const stats = useMemo(() => {
    if (chartData.length === 0) return null
    const avgKda = (chartData.reduce((acc, d) => acc + d.kda, 0) / chartData.length).toFixed(2)
    const winRate = Math.round((chartData.reduce((acc, d) => acc + d.result, 0) / chartData.length) * 100)
    return { avgKda, winRate }
  }, [chartData])

  if (chartData.length === 0) return null

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TrendingUp style={{ color: '#c89b3c' }} size={24} />
          <h2 style={{ fontSize: '18px', fontWeight: 900, fontFamily: "'Space Grotesk', monospace" }}>パフォーマンス推移</h2>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <StatBox label="平均KDA" val={stats.avgKda} color="#c89b3c" />
          <StatBox label="直近勝率" val={`${stats.winRate}%`} color="#00cfef" />
        </div>
      </div>

      <div style={{ height: '240px', width: '100%', marginBottom: '24px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorKda" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c89b3c" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#c89b3c" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="#666" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
            />
            <YAxis 
              stroke="#666" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              domain={[0, 'auto']}
            />
            <Tooltip 
              contentStyle={{ background: '#14161e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ color: '#c89b3c' }}
            />
            <Area 
              type="monotone" 
              dataKey="kda" 
              stroke="#c89b3c" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorKda)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: 'rgba(200,155,60,0.05)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(200,155,60,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c89b3c', fontSize: '11px', fontWeight: 900, marginBottom: '8px', textTransform: 'uppercase' }}>
          <Zap size={14} /> AI 成長レポート
        </div>
        <p style={{ fontSize: '13px', color: '#a0a5b0', lineHeight: 1.6 }}>
          王、直近10試合のデータから、あなたの立ち回りは安定期に入っております。特にKDAが{stats.avgKda}を維持している点は賞賛に値します。
          次の課題は、高いパフォーマンスを維持しつつ、オブジェクト関与をさらに15%引き上げること。
          そうすれば、帝国の版図はさらに広がるでしょう。
        </p>
      </div>
    </div>
  )
}

const StatBox = ({ label, val, color }) => (
  <div style={{ textAlign: 'right' }}>
    <div style={{ fontSize: '10px', color: '#666', fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: '18px', fontWeight: 900, color, fontFamily: "'Space Grotesk', monospace" }}>{val}</div>
  </div>
)

export default PerformanceTimeline
