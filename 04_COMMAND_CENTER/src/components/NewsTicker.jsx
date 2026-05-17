import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { motion } from 'framer-motion'
import { Zap, Globe, AlertTriangle } from 'lucide-react'

const NewsTicker = () => {
  const [news, setNews] = useState("Sovereign OS Intelligence Network Initializing...")

  useEffect(() => {
    fetchNews()
    const channel = supabase
      .channel('news-ticker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matchup_sentinel', filter: 'matchup_id=eq.NEWS_TICKER' }, fetchNews)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchNews = async () => {
    const { data } = await supabase.from('matchup_sentinel').select('strategy').eq('matchup_id', 'NEWS_TICKER').single()
    if (data && data.strategy) {
      setNews(data.strategy)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      width: '100%',
      height: '32px',
      background: 'rgba(0, 207, 239, 0.1)',
      backdropFilter: 'blur(10px)',
      borderTop: '1px solid rgba(0, 207, 239, 0.3)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      pointerEvents: 'none'
    }}>
      <div style={{
        padding: '0 16px',
        background: '#00cfef',
        color: '#000',
        fontSize: '11px',
        fontWeight: 900,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        zIndex: 2001,
        fontFamily: "'Space Grotesk', monospace"
      }}>
        <Globe size={14} /> NEWS
      </div>

      <motion.div
        animate={{ x: ['100%', '-100%'] }}
        transition={{ 
          duration: 30, 
          repeat: Infinity, 
          ease: "linear" 
        }}
        style={{
          whiteSpace: 'nowrap',
          fontSize: '12px',
          fontWeight: 700,
          color: '#00cfef',
          paddingLeft: '20px',
          letterSpacing: '0.05em',
          fontFamily: "'Space Grotesk', monospace"
        }}
      >
        {news}
      </motion.div>
      
      {/* 2つ目のコピーを流すことで途切れないようにする */}
      <motion.div
        animate={{ x: ['200%', '0%'] }}
        transition={{ 
          duration: 30, 
          repeat: Infinity, 
          ease: "linear" 
        }}
        style={{
          position: 'absolute',
          whiteSpace: 'nowrap',
          fontSize: '12px',
          fontWeight: 700,
          color: '#00cfef',
          paddingLeft: '20px',
          letterSpacing: '0.05em',
          fontFamily: "'Space Grotesk', monospace"
        }}
      >
        {news}
      </motion.div>
    </div>
  )
}

export default NewsTicker
