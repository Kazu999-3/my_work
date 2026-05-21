import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { motion } from 'framer-motion'
import { Book, ChevronLeft, ChevronDown, ChevronUp, Clock, User, Sparkles, Pencil, Save, X, Trash2, Search } from 'lucide-react'

const BibleReader = ({ onBack }) => {
  const [articles, setArticles] = useState([])
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [groupMode, setGroupMode] = useState('champion') // 'champion' or 'keyword'
  const [sortOrder, setSortOrder] = useState('updated_desc') // 'updated_desc', 'updated_asc', 'name_asc'

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('bible_articles').select('*').order('created_at', { ascending: false })
      if (!error && data) setArticles(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchArticles() }, [])

  // グループ化ロジック
  const grouped = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = articles.filter(a =>
      a.title.toLowerCase().includes(q) || 
      a.champion?.toLowerCase().includes(q) ||
      (a.keywords && a.keywords.some(k => k.toLowerCase().includes(q)))
    )

    const groups = {}
    
    if (groupMode === 'champion') {
      filtered.forEach(a => {
        const key = a.champion || 'その他'
        if (!groups[key]) groups[key] = []
        groups[key].push(a)
      })
      // キーワードでグループ化
      filtered.forEach(a => {
        const keys = (a.keywords && a.keywords.length > 0) ? a.keywords : ['未分類']
        keys.forEach(k => {
          if (!groups[k]) groups[k] = []
          groups[k].push(a)
        })
      })
    }
    
    // 各グループ内の記事をソート
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        if (sortOrder === 'updated_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        if (sortOrder === 'updated_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        return a.title.localeCompare(b.title)
      })
    })

    // グループ自体をソート
    return Object.entries(groups).sort((a, b) => {
      if (sortOrder === 'updated_desc') {
        const maxA = Math.max(...a[1].map(x => new Date(x.created_at).getTime()))
        const maxB = Math.max(...b[1].map(x => new Date(x.created_at).getTime()))
        return maxB - maxA
      }
      if (sortOrder === 'updated_asc') {
        const minA = Math.min(...a[1].map(x => new Date(x.created_at).getTime()))
        const minB = Math.min(...b[1].map(x => new Date(x.created_at).getTime()))
        return minA - minB
      }
      return a[0].localeCompare(b[0])
    })
  }, [articles, search, groupMode, sortOrder])

  const toggleGroup = (key) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const startEditing = () => { setEditContent(selectedArticle.content); setEditing(true) }
  const cancelEditing = () => { setEditing(false); setEditContent('') }

  const saveArticle = async () => {
    setSaving(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from('bible_articles').update({ content: editContent, created_at: now }).eq('id', selectedArticle.id)
    if (!error) {
      setSelectedArticle({ ...selectedArticle, content: editContent, created_at: now })
      setArticles(prev => prev.map(a => a.id === selectedArticle.id ? { ...a, content: editContent, created_at: now } : a))
      setEditing(false)
    } else { alert('保存失敗: ' + error.message) }
    setSaving(false)
  }

  const deleteArticle = async (id, e) => {
    e.stopPropagation()
    if (!confirm('この記事を削除しますか？')) return
    const { error } = await supabase.from('bible_articles').delete().eq('id', id)
    if (!error) {
      setArticles(prev => prev.filter(a => a.id !== id))
      if (selectedArticle?.id === id) setSelectedArticle(null)
    } else { alert('削除失敗: ' + error.message) }
  }

  // ===== 記事閲覧/編集画面 =====
  if (selectedArticle) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <button onClick={() => { setSelectedArticle(null); setEditing(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c89b3c', fontWeight: 700, fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <ChevronLeft size={18} /> 一覧へ戻る
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!editing ? (
              <button onClick={startEditing} style={btnStyle('#00cfef', 'rgba(0,207,239,0.1)')}>
                <Pencil size={14} /> 編集する
              </button>
            ) : (
              <>
                <button onClick={cancelEditing} style={btnStyle('#a0a5b0', 'rgba(255,255,255,0.05)')}>
                  <X size={14} /> キャンセル
                </button>
                <button onClick={saveArticle} disabled={saving}
                  style={{ ...btnStyle('#000', saving ? '#888' : '#c89b3c'), fontWeight: 800 }}>
                  <Save size={14} /> {saving ? '保存中...' : '保存する'}
                </button>
              </>
            )}
            <button onClick={(e) => deleteArticle(selectedArticle.id, e)} style={btnStyle('#ef4444', 'rgba(239,68,68,0.1)')}>
              <Trash2 size={14} /> 削除
            </button>
          </div>
        </div>

        {/* 記事本体 */}
        <div className="glass-card" style={{ overflow: 'hidden', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ height: '3px', background: '#c89b3c' }} />
          <div style={{ padding: '40px' }}>
            <header style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c89b3c', fontFamily: "'Space Grotesk', monospace", fontSize: '11px', marginBottom: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 900 }}>
                <Sparkles size={14} /> Sovereign Intelligence Report
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1.3, fontFamily: "'Space Grotesk', monospace" }}>
                {selectedArticle.title.replace(/_/g, ' ')}
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px', fontSize: '11px', color: '#a0a5b0' }}>
                <Tag icon={<User size={12} />} text="AI AGENT" />
                <Tag icon={<Clock size={12} />} text={new Date(selectedArticle.created_at).toLocaleString('ja-JP')} />
              </div>
            </header>

            {editing ? (
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                style={{ width: '100%', minHeight: '500px', padding: '20px', background: 'rgba(0,0,0,0.3)', border: '2px solid rgba(0,207,239,0.2)', borderRadius: '12px', color: '#f0f5f5', fontSize: '14px', lineHeight: 1.8, fontFamily: "'Outfit', sans-serif", outline: 'none', resize: 'vertical' }} />
            ) : (
              <div style={{ fontSize: '15px', lineHeight: 2, color: '#e0e5ea', whiteSpace: 'pre-wrap' }}>
                {selectedArticle.content}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // ===== 一覧画面 =====
  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 900, fontFamily: "'Space Grotesk', monospace", display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <Book style={{ color: '#c89b3c' }} size={26} /> 攻略ライブラリ
          </h2>
          <p style={{ color: '#a0a5b0', fontSize: '13px' }}>AIが錬成した究極のチャンピオン・バイブル（{articles.length}件）</p>
        </div>
        <button onClick={onBack} style={btnStyle('#c89b3c', 'rgba(20,22,30,0.7)')}>
          <ChevronLeft size={16} /> 戻る
        </button>
      </div>

      {/* 検索・フィルターエリア */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#a0a5b0' }} size={18} />
          <input type="text" placeholder="キーワード、チャンピオン、アイテム名で検索..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '14px 14px 14px 44px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#f0f5f5', fontSize: '14px', fontFamily: "'Outfit', sans-serif", outline: 'none' }} />
        </div>
        
        {/* カテゴリー＆ソート */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', height: '48px', alignItems: 'center' }}>
            <button onClick={() => setGroupMode('champion')} 
              style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all 0.2s', background: groupMode === 'champion' ? '#c89b3c' : 'transparent', color: groupMode === 'champion' ? '#000' : '#a0a5b0' }}>
              チャンピオン別
            </button>
            <button onClick={() => setGroupMode('keyword')} 
              style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all 0.2s', background: groupMode === 'keyword' ? '#c89b3c' : 'transparent', color: groupMode === 'keyword' ? '#000' : '#a0a5b0' }}>
              キーワード別
            </button>
          </div>
          
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ padding: '0 16px', background: 'rgba(20,22,30,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f0f5f5', fontSize: '14px', fontWeight: 700, outline: 'none', cursor: 'pointer', height: '48px' }}>
            <option value="updated_desc">更新日が新しい順</option>
            <option value="updated_asc">更新日が古い順</option>
            <option value="name_asc">名前順</option>
          </select>
        </div>
      </div>

      {/* グループ化された記事一覧 */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {[1,2,3,4].map(i => <div key={i} className="glass-card" style={{ height: '140px', opacity: 0.2 }} />)}
        </div>
      ) : grouped.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {grouped.map(([champName, items]) => (
            <div key={champName}>
              {/* グループヘッダー */}
              <button onClick={() => toggleGroup(champName)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#c89b3c', fontWeight: 800, fontSize: '14px', fontFamily: "'Space Grotesk', monospace", letterSpacing: '0.05em' }}>
                {collapsedGroups[champName] ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                <span style={{ background: 'rgba(200,155,60,0.15)', padding: '4px 12px', borderRadius: '8px', border: '1px solid rgba(200,155,60,0.3)' }}>
                  {champName}
                </span>
                <span style={{ color: '#a0a5b0', fontSize: '12px', fontWeight: 500 }}>({items.length})</span>
              </button>

              {/* グループ内の記事カード */}
              {!collapsedGroups[champName] && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                  {items.map(article => (
                    <div key={article.id} className="glass-card"
                      onClick={() => setSelectedArticle(article)}
                      style={{ padding: '20px', cursor: 'pointer', borderLeft: '3px solid #c89b3c', position: 'relative' }}>
                      {/* 削除ボタン */}
                      <button onClick={(e) => deleteArticle(article.id, e)}
                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#a0a5b0', opacity: 0.4, transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.target.style.opacity = 1; e.target.style.color = '#ef4444' }}
                        onMouseLeave={e => { e.target.style.opacity = 0.4; e.target.style.color = '#a0a5b0' }}>
                        <Trash2 size={14} />
                      </button>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', lineHeight: 1.4, paddingRight: '32px' }}>
                        {article.title.replace(/_/g, ' ')}
                      </h3>
                      
                      {/* キーワードタグ */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                        {article.keywords && article.keywords.map((kw, kidx) => (
                          <span key={kidx} style={{ fontSize: '9px', background: 'rgba(200,155,60,0.1)', color: '#c89b3c', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(200,155,60,0.2)' }}>
                            {kw}
                          </span>
                        ))}
                      </div>

                      <div style={{ fontSize: '10px', color: '#a0a5b0', fontFamily: "'Space Grotesk', monospace", display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={10} /> {new Date(article.created_at).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Book size={40} style={{ color: '#a0a5b0', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>
            {search ? `「${search}」に一致する記事なし` : 'まだ記事がありません'}
          </h3>
        </div>
      )}
    </div>
  )
}

// ヘルパー
const btnStyle = (color, bg) => ({
  padding: '8px 18px', border: 'none', cursor: 'pointer', color, fontWeight: 700, fontSize: '13px',
  display: 'flex', alignItems: 'center', gap: '6px', background: bg, borderRadius: '10px', transition: 'all 0.2s',
})

const Tag = ({ icon, text }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '5px 12px', borderRadius: '999px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
    {React.cloneElement(icon, { style: { color: '#c89b3c' } })} {text}
  </span>
)

export default BibleReader
