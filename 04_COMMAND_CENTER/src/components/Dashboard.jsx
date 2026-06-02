import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, Zap, BookOpen, 
  LayoutDashboard, Users,
  Menu, X, BookHeart, Send
} from 'lucide-react'
import BibleReader from './BibleReader'
import PerformanceTimeline from './PerformanceTimeline'
import MatchupExplorer from './MatchupExplorer'
import StatsPanel from './StatsPanel'
import ChampionDB from './ChampionDB'
import PublishTracker from './PublishTracker'
import { supabase } from '../lib/supabase'

const MENU_ITEMS = [
  { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { id: 'bible',     label: '攻略ライブラリ', icon: BookOpen },
  { id: 'matchups',  label: 'マッチアップ',   icon: Shield },
  { id: 'champdb',   label: 'チャンピオン辞典', icon: BookHeart },
  { id: 'posts',     label: '投稿管理',       icon: Send },
]

// ウィンドウ幅を追跡するフック
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768)
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isDesktop
}

const Dashboard = () => {
  const [view, setView] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const isDesktop = useIsDesktop()

  const navigate = (id) => {
    setView(id)
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }

  const { data: dashboardData = { liveEnemies: [], activities: [], statsSummary: { research: 0, bibles: 0 }, matchups: [] }, isLoading } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      let liveEnemies = []
      try {
        const { data } = await supabase
          .from('matchup_sentinel')
          .select('raw_data, updated_at')
          .eq('matchup_id', 'LIVE_MATCH')
          .maybeSingle()
        if (data && data.raw_data && data.raw_data.enemy_team) {
          const updatedAt = new Date(data.updated_at || Date.now()).getTime()
          if ((Date.now() - updatedAt) < 1000 * 60 * 120) {
            liveEnemies = data.raw_data.enemy_team
          }
        }
      } catch (e) { /* ignore */ }
      
      let coachAdvice = null
      try {
        const { data: cData } = await supabase
          .from('matchup_sentinel')
          .select('strategy, created_at, champion, raw_data')
          .like('matchup_id', 'COACH_%')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (cData) {
           coachAdvice = cData
        }
      } catch (e) { /* ignore */ }

      const [mRes, aRes, aCountRes] = await Promise.all([
        supabase.from('matchup_sentinel').select('*').order('created_at', { ascending: false }),
        supabase.from('bible_articles').select('id, title, created_at, champion').order('created_at', { ascending: false }).limit(5),
        supabase.from('bible_articles').select('*', { count: 'exact', head: true })
      ])

      const mData = mRes.data || []
      const combined = [
        ...mData.slice(0, 5).map(m => ({
          id: `m-${m.id}`,
          text: m.enemy === 'GLOBAL' ? `${m.champion} の辞典データを更新` : `${m.champion} vs ${m.enemy} の対策を記録`,
          time: m.created_at,
          raw_time: new Date(m.created_at).getTime(),
          type: m.enemy === 'GLOBAL' ? 'champdb' : 'matchups'
        })),
        ...(aRes.data || []).map(a => ({
          id: `a-${a.id}`,
          text: `${a.champion} 攻略バイブルを錬成`,
          time: a.created_at,
          raw_time: new Date(a.created_at).getTime(),
          type: 'bible'
        }))
      ].sort((a, b) => b.raw_time - a.raw_time).slice(0, 10)

      return {
        coachAdvice,
        liveEnemies,
        matchups: mData,
        activities: combined,
        statsSummary: {
          research: mData.length,
          bibles: aCountRes.count || 0
        }
      }
    }
  })

  // 時間の相対表記ヘルパー
  const formatTime = (isoString) => {
    if (!isoString) return '不明'
    try {
      const diff = new Date().getTime() - new Date(isoString).getTime()
      if (isNaN(diff)) return '不明'
      const mins = Math.floor(diff / 60000)
      if (mins < 1) return 'たった今'
      if (mins < 60) return `${mins}分前`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours}時間前`
      return new Date(isoString).toLocaleDateString('ja-JP')
    } catch (e) {
      return '不明'
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#06070a', color: '#f0f5f5' }}>

      {/* ===== サイドバー（PCのみ表示） ===== */}
      {isDesktop && (
        <aside style={{
          width: '240px', minWidth: '240px', height: '100vh', position: 'sticky', top: 0,
          background: '#0a0b10', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '32px',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
            <Shield style={{ color: '#c89b3c' }} size={28} />
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#c89b3c', fontFamily: "'Space Grotesk', monospace", letterSpacing: '-0.02em' }}>SOVEREIGN</span>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {MENU_ITEMS.map(m => (
              <SidebarBtn key={m.id} item={m} active={view === m.id} onClick={() => navigate(m.id)} />
            ))}
          </nav>
        </aside>
      )}

      {/* ===== モバイルヘッダー（モバイルのみ表示） ===== */}
      {!isDesktop && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 110, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
          background: 'rgba(10,11,16,0.95)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield style={{ color: '#c89b3c' }} size={22} />
            <span style={{ fontWeight: 700, color: '#c89b3c', fontFamily: "'Space Grotesk', monospace" }}>SOVEREIGN</span>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#f0f5f5', cursor: 'pointer' }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      )}

      {/* ===== モバイルドロワー ===== */}
      <AnimatePresence>
        {menuOpen && !isDesktop && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }}
              onClick={() => setMenuOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25 }}
              style={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: '280px', background: '#0a0b10', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '32px', zIndex: 105 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
                <Shield style={{ color: '#c89b3c' }} size={28} />
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#c89b3c', fontFamily: "'Space Grotesk', monospace" }}>SOVEREIGN</span>
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {MENU_ITEMS.map(m => (
                  <SidebarBtn key={m.id} item={m} active={view === m.id} onClick={() => navigate(m.id)} />
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ===== メインコンテンツ ===== */}
      <main style={{ flex: 1, padding: isDesktop ? '48px' : '16px', paddingTop: isDesktop ? '48px' : '72px', minHeight: '100vh' }}>
        <AnimatePresence mode="wait">
          {view === 'bible' && (
            <motion.div key="bible" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BibleReader onBack={() => navigate('dashboard')} />
            </motion.div>
          )}
          {view === 'matchups' && (
            <motion.div key="matchups" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MatchupExplorer onBack={() => navigate('dashboard')} />
            </motion.div>
          )}
          {view === 'champdb' && (
            <motion.div key="champdb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ChampionDB onBack={() => navigate('dashboard')} />
            </motion.div>
          )}
          {view === 'posts' && (
            <motion.div key="posts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PublishTracker onBack={() => navigate('dashboard')} />
            </motion.div>
          )}
          {view === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* ヘッダー */}
              <div style={{ marginBottom: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '24px' }}>
                <div>
                  <p style={{ color: '#a0a5b0', fontFamily: "'Space Grotesk', monospace", fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Antigravity Kingdom OS</p>
                  <h1 style={{ fontSize: isDesktop ? '42px' : '28px', fontWeight: 900, letterSpacing: '-0.02em', fontFamily: "'Space Grotesk', monospace" }}>コマンドセンター</h1>
                </div>
                <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 12px rgba(34,197,94,0.6)', animation: 'pulse 2s infinite' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: "'Space Grotesk', monospace" }}>SYSTEM ONLINE</span>
                </div>
              </div>

              {/* AIコーチの辛口フィードバック */}
              {dashboardData.coachAdvice && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    marginBottom: '24px', background: 'linear-gradient(135deg, rgba(200, 40, 40, 0.1), rgba(10, 11, 16, 0.9))',
                    border: '1px solid rgba(200, 40, 40, 0.3)', borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <Zap style={{ color: '#ff4444' }} size={24} />
                    <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#f0f5f5' }}>
                      AIコーチの辛口フィードバック ({dashboardData.coachAdvice.champion} 運用分析)
                    </h2>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{formatTime(dashboardData.coachAdvice.created_at)}</span>
                  </div>
                  <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {dashboardData.coachAdvice.strategy}
                  </p>
                </motion.div>
              )}

              {/* クイックアクション */}
              <div className="glass-card" style={{ padding: '32px', marginBottom: '32px', borderTop: '3px solid #c89b3c' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, fontFamily: "'Space Grotesk', monospace", marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={18} style={{ color: '#c89b3c' }} /> クイック・アクション
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                  <QuickAction label="攻略ライブラリ" desc="AIが錬成した記事" icon={<BookOpen size={22} />} onClick={() => navigate('bible')} />
                  <QuickAction label="マッチアップ" desc="対面の対策メモ" icon={<Shield size={22} />} onClick={() => navigate('matchups')} />
                  <QuickAction label="チャンピオン辞典" desc="チャンプ固有の知識" icon={<BookHeart size={22} />} onClick={() => navigate('champdb')} />
                  <QuickAction label="投稿管理" desc="X / note履歴" icon={<Send size={22} />} onClick={() => navigate('posts')} />
                </div>
              </div>

              {/* ステータスカード */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                <StatusCard title="リサーチエンジン" status="稼働中" metric={`${dashboardData.statsSummary.research}件の分析完了`} icon={<Zap style={{ color: '#00cfef' }} />} statusColor="#00cfef" />
                <StatusCard title="KTMボット" status="接続中" metric="Riot API 正常" icon={<Users style={{ color: '#c89b3c' }} />} statusColor="#c89b3c" />
                <StatusCard title="バイブル生成" status="待機中" metric={`累計 ${dashboardData.statsSummary.bibles} 件の錬成`} icon={<BookOpen style={{ color: '#a78bfa' }} />} statusColor="#a78bfa" />
              </div>

              <PerformanceTimeline matchups={dashboardData.matchups} />

              {/* 戦績サマリー (Riot API データ) */}
              <StatsPanel />

              {/* 最近の活動 */}
              <div className="glass-card" style={{ padding: '32px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, fontFamily: "'Space Grotesk', monospace", marginBottom: '24px' }}>最近の活動</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {dashboardData.activities.length > 0 ? (
                    dashboardData.activities.map(a => (
                      <ActivityItem key={a.id} text={a.text} time={formatTime(a.time)} onClick={() => navigate(a.type)} />
                    ))
                  ) : (
                    <p style={{ color: '#a0a5b0', fontSize: '13px', padding: '10px' }}>活動履歴はありません</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

    </div>
  )
}

/* ===== サブコンポーネント ===== */

const SidebarBtn = ({ item, active, onClick }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '12px', border: 'none',
        cursor: 'pointer', fontWeight: 700, fontSize: '14px', textAlign: 'left', transition: 'all 0.2s',
        fontFamily: "'Outfit', sans-serif",
        background: active ? 'rgba(200,155,60,0.15)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: active ? '#c89b3c' : hovered ? '#fff' : '#a0a5b0',
      }}>
      <item.icon size={20} />
      {item.label}
    </button>
  )
}

const StatusCard = ({ title, status, metric, icon, statusColor }) => (
  <div className="glass-card" style={{ padding: '24px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
      <div style={{ padding: '12px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)' }}>{icon}</div>
      <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', padding: '4px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: statusColor }}>{status}</span>
    </div>
    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{title}</h3>
    <p style={{ fontSize: '12px', color: '#a0a5b0' }}>{metric}</p>
  </div>
)

const QuickAction = ({ label, desc, icon, onClick }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="glass-card-gold"
      style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', textAlign: 'center', borderRadius: '16px', color: '#f0f5f5' }}>
      <div style={{ padding: '12px', borderRadius: '14px', background: hovered ? 'rgba(200,155,60,0.15)' : 'rgba(255,255,255,0.05)', color: hovered ? '#c89b3c' : '#f0f5f5', transition: 'all 0.2s', transform: hovered ? 'scale(1.1)' : 'scale(1)' }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 800, color: hovered ? '#c89b3c' : '#f0f5f5', transition: 'color 0.2s' }}>{label}</p>
        <p style={{ fontSize: '11px', color: '#a0a5b0', marginTop: '6px' }}>{desc}</p>
      </div>
    </button>
  )
}

const ActivityItem = ({ text, time, onClick }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: '12px', background: hovered ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'background 0.2s', cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ fontSize: '14px', fontWeight: 500, color: hovered ? '#c89b3c' : '#f0f5f5', transition: 'color 0.2s' }}>{text}</span>
      <span style={{ fontSize: '10px', color: '#a0a5b0', fontFamily: "'Space Grotesk', monospace", background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '8px', whiteSpace: 'nowrap' }}>{time}</span>
    </div>
  )
}

export default Dashboard
