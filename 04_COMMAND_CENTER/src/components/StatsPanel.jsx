import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { getChampIcon } from '../lib/ddragon'
import { TrendingUp, Trophy, Target, Flame, Skull } from 'lucide-react'

/**
 * 戦績ダッシュボード: Riot APIから取り込んだ試合データを分析表示
 * - チャンプ別勝率 & KDA (支配力インデックス)
 * - 勝率ヒートマップ (自分 × 対面)
 * - 直近の連勝/連敗ストリーク
 */
const StatsPanel = () => {
  const [matchups, setMatchups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('matchup_sentinel').select('*').order('created_at', { ascending: false })
      if (data) setMatchups(data)
      setLoading(false)
    }
    fetch()
  }, [])

  // Riot API ソースのマッチアップのみ使用 (Kazurin#4036 に限定)
  const riotMatches = useMemo(() => 
    matchups.filter(m => m.raw_data?.source === 'riot_api' && m.raw_data?.riot_id === 'Kazurin#4036'), 
  [matchups])

  // チャンプ別統計
  const champStats = useMemo(() => {
    const map = {}
    riotMatches.forEach(m => {
      const c = m.champion
      if (!map[c]) map[c] = { wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0, games: 0 }
      const s = map[c]
      s.games++
      if (m.raw_data?.result === 'Win') s.wins++; else s.losses++
      const kda = m.raw_data?.my_kda?.split('/') || []
      s.kills += parseInt(kda[0]) || 0
      s.deaths += parseInt(kda[1]) || 0
      s.assists += parseInt(kda[2]) || 0
    })
    return Object.entries(map)
      .map(([name, s]) => ({ name, ...s, winRate: s.games ? Math.round((s.wins / s.games) * 100) : 0, avgKDA: s.deaths ? ((s.kills + s.assists) / s.deaths).toFixed(1) : 'Perfect' }))
      .sort((a, b) => b.games - a.games)
  }, [riotMatches])

  // 対面別ヒートマップ
  const heatmap = useMemo(() => {
    const map = {}
    riotMatches.forEach(m => {
      const key = `${m.champion}|${m.enemy}`
      if (!map[key]) map[key] = { champion: m.champion, enemy: m.enemy, wins: 0, losses: 0 }
      if (m.raw_data?.result === 'Win') map[key].wins++; else map[key].losses++
    })
    return Object.values(map).sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
  }, [riotMatches])

  // 直近ストリーク
  const streak = useMemo(() => {
    if (!riotMatches.length) return { type: 'none', count: 0 }
    const first = riotMatches[0]?.raw_data?.result
    let count = 0
    for (const m of riotMatches) {
      if (m.raw_data?.result === first) count++; else break
    }
    return { type: first, count }
  }, [riotMatches])

  if (loading) return <div style={{ opacity: 0.3 }}>読み込み中...</div>
  if (!riotMatches.length) return null

  const totalWins = riotMatches.filter(m => m.raw_data?.result === 'Win').length
  const totalGames = riotMatches.length
  const overallWR = Math.round((totalWins / totalGames) * 100)

  return (
    <div style={{ marginBottom: '32px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 700, fontFamily: "'Space Grotesk', monospace", marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <TrendingUp size={18} style={{ color: '#00cfef' }} /> 戦績サマリー
      </h3>

      {/* 概要カード */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <MiniStat label="総試合" value={totalGames} sub="直近取り込み分" />
        <MiniStat label="勝率" value={`${overallWR}%`} sub={`${totalWins}W ${totalGames - totalWins}L`} color={overallWR >= 50 ? '#22c55e' : '#ef4444'} />
        <MiniStat label="ストリーク" value={streak.type !== 'none' ? `${streak.count}${streak.type === 'Win' ? '連勝' : '連敗'}` : '-'} icon={streak.type === 'Win' ? <Flame size={16} style={{ color: '#f59e0b' }} /> : <Skull size={16} style={{ color: '#ef4444' }} />} color={streak.type === 'Win' ? '#f59e0b' : '#ef4444'} />
        <MiniStat label="使用チャンプ" value={champStats.length} sub="種類" />
      </div>

      {/* 支配力インデックス */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#c89b3c', marginBottom: '14px', fontFamily: "'Space Grotesk', monospace", letterSpacing: '0.1em' }}>
          <Trophy size={14} style={{ display: 'inline', marginRight: '6px' }} /> 支配力インデックス（勝率順）
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {champStats.slice(0, 8).map(c => (
            <ChampRow key={c.name} champ={c} />
          ))}
        </div>
      </div>

      {/* 対面ヒートマップ */}
      {heatmap.length > 0 && (
        <div className="glass-card" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#00cfef', marginBottom: '14px', fontFamily: "'Space Grotesk', monospace", letterSpacing: '0.1em' }}>
            <Target size={14} style={{ display: 'inline', marginRight: '6px' }} /> マッチアップ勝率
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {heatmap.slice(0, 12).map(h => {
              const total = h.wins + h.losses
              const wr = Math.round((h.wins / total) * 100)
              return (
                <div key={`${h.champion}-${h.enemy}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${wr >= 50 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                  <ChampImgSmall name={h.champion} />
                  <span style={{ fontSize: '10px', color: '#a0a5b0' }}>vs</span>
                  <ChampImgSmall name={h.enemy} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: wr >= 50 ? '#22c55e' : '#ef4444', marginLeft: 'auto' }}>{wr}%</span>
                  <span style={{ fontSize: '10px', color: '#a0a5b0' }}>{h.wins}W{h.losses}L</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== 小パーツ =====
const MiniStat = ({ label, value, sub, color, icon }) => (
  <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
    {icon && <div style={{ marginBottom: '4px' }}>{icon}</div>}
    <div style={{ fontSize: '24px', fontWeight: 900, color: color || '#f0f5f5', fontFamily: "'Space Grotesk', monospace" }}>{value}</div>
    <div style={{ fontSize: '11px', fontWeight: 700, color: '#a0a5b0', marginTop: '2px' }}>{label}</div>
    {sub && <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{sub}</div>}
  </div>
)

const ChampImgSmall = ({ name }) => {
  const [err, setErr] = useState(false)
  const src = getChampIcon(name)
  if (!src || err) return <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#333' }} />
  return <img src={src} alt={name} width={20} height={20} style={{ borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)' }} onError={() => setErr(true)} />
}

const ChampRow = ({ champ }) => {
  const [err, setErr] = useState(false)
  const src = getChampIcon(champ.name)
  const wrColor = champ.winRate >= 60 ? '#22c55e' : champ.winRate >= 50 ? '#c89b3c' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
      {!err && src ? (
        <img src={src} alt={champ.name} width={28} height={28} style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)' }} onError={() => setErr(true)} />
      ) : (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#222' }} />
      )}
      <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '80px' }}>{champ.name}</span>
      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{ width: `${champ.winRate}%`, height: '100%', borderRadius: '3px', background: wrColor, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: '13px', fontWeight: 800, color: wrColor, minWidth: '36px', textAlign: 'right' }}>{champ.winRate}%</span>
      <span style={{ fontSize: '10px', color: '#a0a5b0', minWidth: '48px', textAlign: 'right' }}>{champ.wins}W{champ.losses}L</span>
      <span style={{ fontSize: '10px', color: '#a0a5b0', minWidth: '48px', textAlign: 'right' }}>KDA {champ.avgKDA}</span>
    </div>
  )
}

export default StatsPanel
