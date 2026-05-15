import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, Zap, BookOpen, Activity, 
  LayoutDashboard, Users, ChevronRight,
  Menu, X, BookHeart
} from 'lucide-react'
import BibleReader from './BibleReader'
import MatchupExplorer from './MatchupExplorer'
import StatsPanel from './StatsPanel'
import ChampionDB from './ChampionDB'
import LiveBriefing from './LiveBriefing'
import { supabase } from '../lib/supabase'

const MENU_ITEMS = [
  { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { id: 'bible',     label: '攻略ライブラリ', icon: BookOpen },
  { id: 'matchups',  label: 'マッチアップ',   icon: Shield },
  { id: 'champdb',   label: 'チャンピオン辞典', icon: BookHeart },
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

  const [liveEnemies, setLiveEnemies] = useState([])

  const [activities, setActivities] = useState([])
  const [statsSummary, setStatsSummary] = useState({ research: 0, bibles: 0 })

  useEffect(() => {
    const checkLiveMatch = async () => {
      try {
        const { data } = await supabase
          .from('matchup_sentinel')
          .select('raw_data')
          .eq('matchup_id', 'LIVE_MATCH')
          .maybeSingle()
        
        if (data && data.raw_data && data.raw_data.enemy_team) {
          setLiveEnemies(data.raw_data.enemy_team)
        } else {
          setLiveEnemies([])
        }
      } catch (e) {
        // ignore
      }
    }

    const fetchRecentActivity = async () => {
      try {
        // 最近のマッチアップとバイブルを並列で取得
        const [mRes, aRes] = await Promise.all([
          supabase.from('matchup_sentinel').select('id, title, created_at, champion, enemy').order('created_at', { ascending: false }).limit(5),
          supabase.from('bible_articles').select('id, title, created_at, champion').order('created_at', { ascending: false }).limit(5)
        ])

        const combined = [
          ...(mRes.data || []).map(m => ({
            id: `m-${m.id}`,
            text: m.enemy === 'GLOBAL' ? `${m.champion} の辞典データを更新` : `${m.champion} vs ${m.enemy} の対策を記録`,
            time: m.created_at,
            raw_time: new Date(m.created_at).getTime()
          })),
          ...(aRes.data || []).map(a => ({
            id: `a-${a.id}`,
            text: `${a.champion} の攻略バイブルを錬成`,
            time: a.created_at,
            raw_time: new Date(a.created_at).getTime()
          }))
        ]

        // 時間順に並び替え
        combined.sort((a, b) => b.raw_time - a.raw_time)
        setActivities(combined.slice(0, 5))
        
        // 統計の更新
        setStatsSummary({
          research: (mRes.data || []).length + 40, // 累計+40(モック)
          bibles: (aRes.data || []).length + 10  // 累計+10(モック)
        })
      } catch (e) {
        console.error('Activity Fetch Error:', e)
      }
    }

    checkLiveMatch()
    fetchRecentActivity()
    
    const interval = setInterval(() => {
      checkLiveMatch()
      fetchRecentActivity()
    }, 10000)
    
    return () => clearInterval(interval)
  }, [])

  // 時間の相対表記ヘルパー
  const formatTime = (isoString) => {
    const diff = Date.now() - new Date(isoString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'たった今'
    if (mins < 60) return `${mins}分前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}時間前`
    return new Date(isoString).toLocaleDateString('ja-JP')
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

              {/* ステータスカード */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                <StatusCard title="リサーチエンジン" status="稼働中" metric={`${statsSummary.research}件の分析完了`} icon={<Zap style={{ color: '#00cfef' }} />} statusColor="#00cfef" />
                <StatusCard title="KTMボット" status="接続中" metric="Riot API 正常" icon={<Users style={{ color: '#c89b3c' }} />} statusColor="#c89b3c" />
                <StatusCard title="バイブル生成" status="待機中" metric={`累計 ${statsSummary.bibles} 件の錬成`} icon={<BookOpen style={{ color: '#a78bfa' }} />} statusColor="#a78bfa" />
              </div>

              {/* Live Briefing */}
              <LiveBriefing enemies={liveEnemies} />

              {/* 戦績サマリー (Riot API データ) */}
              <StatsPanel />

              {/* クイックアクション */}
              <div className="glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, fontFamily: "'Space Grotesk', monospace", marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={18} style={{ color: '#c89b3c' }} /> クイック・アクション
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                  <QuickAction label="攻略ライブラリ" desc="AIが錬成した記事" icon={<BookOpen size={22} />} onClick={() => navigate('bible')} />
                  <QuickAction label="マッチアップ" desc="対面の対策メモ" icon={<Shield size={22} />} onClick={() => navigate('matchups')} />
                  <QuickAction label="チャンピオン辞典" desc="チャンプ固有の知識" icon={<BookHeart size={22} />} onClick={() => navigate('champdb')} />
                </div>
              </div>

              {/* 最近の活動 */}
              <div className="glass-card" style={{ padding: '32px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, fontFamily: "'Space Grotesk', monospace", marginBottom: '24px' }}>最近の活動</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {activities.length > 0 ? (
                    activities.map(a => (
                      <ActivityItem key={a.id} text={a.text} time={formatTime(a.time)} />
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
      className="glass-card"
      style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer', border: '1px solid ' + (hovered ? 'rgba(200,155,60,0.5)' : 'rgba(255,255,255,0.08)'), textAlign: 'center', background: 'rgba(20,22,30,0.7)', borderRadius: '16px', color: '#f0f5f5', transition: 'all 0.2s' }}>
      <div style={{ padding: '10px', borderRadius: '12px', background: hovered ? 'rgba(200,155,60,0.1)' : 'rgba(255,255,255,0.05)', color: hovered ? '#c89b3c' : '#f0f5f5', transition: 'all 0.2s' }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '13px', fontWeight: 700, color: hovered ? '#c89b3c' : '#f0f5f5', transition: 'color 0.2s' }}>{label}</p>
        <p style={{ fontSize: '10px', color: '#a0a5b0', marginTop: '4px' }}>{desc}</p>
      </div>
    </button>
  )
}

const ActivityItem = ({ text, time }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: '12px', background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent', transition: 'background 0.2s' }}>
      <span style={{ fontSize: '14px', fontWeight: 500 }}>{text}</span>
      <span style={{ fontSize: '10px', color: '#a0a5b0', fontFamily: "'Space Grotesk', monospace", background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '8px', whiteSpace: 'nowrap' }}>{time}</span>
    </div>
  )
}

export default Dashboard
