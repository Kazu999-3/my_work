import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { motion } from 'framer-motion'
import { Send, ExternalLink, RefreshCw, Clock, MessageSquare, FileText } from 'lucide-react'

const PublishTracker = ({ onBack }) => {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('published_posts')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error && data) setPosts(data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  const getPlatformStyle = (platform) => {
    if (platform === 'X' || platform.toLowerCase() === 'twitter') {
      return { color: '#000', bg: '#fff', icon: <MessageSquare size={14} />, label: 'X (Twitter)' }
    }
    if (platform === 'note') {
      return { color: '#fff', bg: '#41C9B4', icon: <FileText size={14} />, label: 'note' }
    }
    return { color: '#fff', bg: '#555', icon: <Send size={14} />, label: platform }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 900, fontFamily: "'Space Grotesk', monospace", display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <Send style={{ color: '#00cfef' }} size={26} /> 投稿管理
          </h2>
          <p style={{ color: '#a0a5b0', fontSize: '13px' }}>AIによるX(Twitter)やnoteへの自動投稿履歴（{posts.length}件）</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchPosts} style={btnStyle('#00cfef', 'rgba(0,207,239,0.1)')}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 更新
          </button>
        </div>
      </div>

      {/* List */}
      <div className="glass-card" style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#a0a5b0' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
            読み込み中...
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#a0a5b0' }}>
            <Send size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            まだ投稿履歴がありません。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {posts.map(post => {
              const style = getPlatformStyle(post.platform)
              return (
                <div key={post.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', flexWrap: 'wrap', gap: '12px', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: style.bg, color: style.color }}>
                      {style.icon}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px', color: '#f0f5f5' }}>
                        {post.title}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#a0a5b0', fontFamily: "'Space Grotesk', monospace" }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {new Date(post.created_at).toLocaleString('ja-JP')}</span>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{style.label}</span>
                      </div>
                    </div>
                  </div>

                  <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#c89b3c', textDecoration: 'none', padding: '8px 16px', background: 'rgba(200,155,60,0.1)', borderRadius: '8px', border: '1px solid rgba(200,155,60,0.2)', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,155,60,0.2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,155,60,0.1)' }}>
                    表示する <ExternalLink size={14} />
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}

const btnStyle = (color, bg) => ({
  padding: '8px 18px', border: 'none', cursor: 'pointer', color, fontWeight: 700, fontSize: '13px',
  display: 'flex', alignItems: 'center', gap: '6px', background: bg, borderRadius: '10px', transition: 'all 0.2s',
})

export default PublishTracker
