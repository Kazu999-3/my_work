import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { motion } from 'framer-motion'
import { Swords, Zap } from 'lucide-react'
import { getChampIcon } from '../lib/ddragon'

const DraftingHub = () => {
  const [liveMatch, setLiveMatch] = useState(null)

  const fetchLiveMatch = async () => {
    const { data } = await supabase.from('matchup_sentinel').select('*').eq('matchup_id', 'LIVE_MATCH').single()
    if (data) setLiveMatch(data)
  }

  useEffect(() => {
    fetchLiveMatch()
    const channel = supabase
      .channel('live-draft')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matchup_sentinel', filter: 'matchup_id=eq.LIVE_MATCH' }, fetchLiveMatch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (!liveMatch || !liveMatch.raw_data?.enemy_team || liveMatch.raw_data.enemy_team.length === 0) {
    return null // 試合中でなければ何も表示しない
  }

  const { enemy_team } = liveMatch.raw_data
  const advice = liveMatch.strategy || "AIアナリストが構成を分析中..."

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }} 
      animate={{ height: 'auto', opacity: 1 }}
      className="glass-card" 
      style={{ borderLeft: '4px solid #ef4444', marginBottom: '24px', overflow: 'hidden', position: 'relative' }}
    >
      <div style={{ position: 'absolute', top: 0, right: 0, padding: '8px 16px', background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 900, borderBottomLeftRadius: '12px', letterSpacing: '0.1em' }}>
        LIVE TACTICAL BRIEFING
      </div>
      
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Swords style={{ color: '#ef4444' }} size={24} />
          <h2 style={{ fontSize: '18px', fontWeight: 900, fontFamily: "'Space Grotesk', monospace" }}>敵チーム構成検知</h2>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {enemy_team.map((name, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ width: '54px', height: '54px', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(239,68,68,0.3)', marginBottom: '6px' }}>
                <img src={getChampIcon(name)} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#a0a5b0' }}>{name}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '14px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '12px', fontWeight: 900, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <Zap size={14} /> AI 勝利への指針
          </div>
          <div style={{ fontSize: '14px', color: '#e0e5ea', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
            {advice}
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
           <div style={{ fontSize: '11px', color: '#666' }}>※ 敵5人を検知すると自動的に分析が開始されます</div>
        </div>
      </div>
    </motion.div>
  )
}

export default DraftingHub
