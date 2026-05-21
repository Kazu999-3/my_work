import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Crosshair, Swords, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getChampIcon } from '../lib/ddragon'

const LiveBriefing = ({ enemies }) => {
  const [intel, setIntel] = useState({})

  useEffect(() => {
    const fetchIntel = async () => {
      // Get data for all enemies
      const { data } = await supabase
        .from('matchup_sentinel')
        .select('champion, raw_data')
        .eq('enemy', 'GLOBAL')
        .in('champion', enemies)
      
      const newIntel = {}
      if (data) {
        data.forEach(row => {
          newIntel[row.champion] = row.raw_data || {}
        })
      }
      setIntel(newIntel)
    }
    if (enemies && enemies.length > 0) {
      fetchIntel()
    }
  }, [enemies])

  if (!enemies || enemies.length === 0) return null

  return (
    <motion.div 
      initial={{ y: 50, opacity: 0 }} 
      animate={{ y: 0, opacity: 1 }}
      style={{ 
        background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(0, 0, 0, 0.8) 100%)',
        border: '1px solid rgba(220, 38, 38, 0.4)',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '48px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, transparent, #ef4444, transparent)' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 12px rgba(239, 68, 68, 0.8)', animation: 'pulse 1.5s infinite' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', fontFamily: "'Space Grotesk', monospace", letterSpacing: '0.1em', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Crosshair size={28} /> LIVE TACTICAL BRIEFING
        </h2>
        <span style={{ marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}>GAME IN PROGRESS</span>
      </div>

      <p style={{ color: '#f0f5f5', fontSize: '14px', marginBottom: '24px' }}>
        ローディング画面を検知しました。敵チームの脅威度とパワースパイクを自動解析しています。
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {enemies.map((champ, idx) => {
          const data = intel[champ] || {}
          return (
            <div key={idx} style={{ 
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px',
              display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '24px', alignItems: 'center'
            }}>
              <div style={{ textAlign: 'center' }}>
                <img src={getChampIcon(champ)} alt={champ} style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid rgba(239,68,68,0.5)' }} />
                <p style={{ fontSize: '11px', fontWeight: 800, marginTop: '8px', color: '#a0a5b0' }}>{champ}</p>
              </div>
              
              <div>
                <p style={{ fontSize: '12px', color: '#22c55e', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Swords size={12}/> 強み</p>
                <p style={{ fontSize: '13px', color: '#f0f5f5', margin: 0, lineHeight: 1.4 }}>{data.strengths || 'データなし'}</p>
              </div>

              <div>
                <p style={{ fontSize: '12px', color: '#c89b3c', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={12}/> 警戒スパイク</p>
                <p style={{ fontSize: '13px', color: '#f0f5f5', margin: 0, lineHeight: 1.4 }}>{data.powerSpikes || 'データなし'}</p>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

export default LiveBriefing
