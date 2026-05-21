import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { getChampIcon, getChampSplash } from '../lib/ddragon'
import { motion } from 'framer-motion'
import { ChevronLeft, Search, Save, BookOpen, RefreshCw, Zap, ShieldAlert, Swords, Shield } from 'lucide-react'

const ChampionDB = ({ onBack }) => {
  const [champions, setChampions] = useState([])
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('updated_desc') // 'updated_desc', 'name_asc'
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [champDates, setChampDates] = useState({})
  
  // 各チャンピオンの細分化メモ
  const [dataFields, setDataFields] = useState({
    strengths: '',
    weaknesses: '',
    powerSpikes: '',
    buildRunes: '',
    fullClearTime: '',
    strategy: ''
  })
  const [saving, setSaving] = useState(false)
  
  // 戦績データ
  const [stats, setStats] = useState({ matches: 0, wins: 0, kda: '0.00' })

  const loadChampionData = async (champId) => {
    // 1. 戦績データ (matchup_sentinel)
    const { data: mData } = await supabase
      .from('matchup_sentinel')
      .select('raw_data')
      .eq('champion', champId)
      .neq('enemy', 'GLOBAL')

    if (mData && mData.length > 0) {
      let wins = 0; let k = 0; let d = 0; let a = 0;
      mData.forEach(row => {
        const rd = row.raw_data || {}
        if (rd.result === 'Win') wins++
        if (rd.my_kda) {
          const parts = rd.my_kda.split('/')
          if (parts.length === 3) {
            k += parseInt(parts[0]||0)
            d += parseInt(parts[1]||0)
            a += parseInt(parts[2]||0)
          }
        }
      })
      const kdaRatio = d === 0 ? (k+a).toFixed(2) : ((k+a)/d).toFixed(2)
      setStats({ matches: mData.length, wins, kda: kdaRatio })
    } else {
      setStats({ matches: 0, wins: 0, kda: '0.00' })
    }

    // 2. 個別メモ (enemy = GLOBAL で保存しておく)
    const { data: noteData } = await supabase
      .from('matchup_sentinel')
      .select('strategy, raw_data')
      .eq('champion', champId)
      .eq('enemy', 'GLOBAL')
      .single()

    const rd = noteData?.raw_data || {}
    setDataFields({
      strengths: rd.strengths || '',
      weaknesses: rd.weaknesses || '',
      powerSpikes: rd.powerSpikes || '',
      buildRunes: rd.buildRunes || '',
      fullClearTime: rd.fullClearTime || '',
      strategy: noteData?.strategy || ''
    })
  }

  useEffect(() => {
    // 常に最新の DDragon バージョンを取得してからチャンピオン一覧を取得
    let fetchedChampions = []
    fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      .then(r => r.json())
      .then(versions => {
        const latest = versions[0];
        return fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/ja_JP/champion.json`);
      })
      .then(r => r.json())
      .then(d => {
        fetchedChampions = Object.values(d.data).map(c => ({
          id: c.id,
          key: c.key,
          name: c.name,
          title: c.title,
          tags: c.tags,
          searchKey: `${c.id.toLowerCase()} ${c.name}`
        }))
        // 同時に各チャンピオンの GLOBAL メモの最終更新日時を取得
        return supabase.from('matchup_sentinel').select('champion, created_at').eq('enemy', 'GLOBAL')
      })
      .then(({ data, error }) => {
        const dates = {}
        if (data) {
          data.forEach(row => {
            dates[row.champion] = row.created_at
          })
        }
        setChampDates(dates)
        setChampions(fetchedChampions)
        setLoading(false)
      })
      .catch(console.error)
  }, [])
      .then(r => r.json())
      .then(d => {
        const list = Object.values(d.data).map(c => ({
          id: c.id,
          key: c.key,
          name: c.name,
          title: c.title,
          tags: c.tags,
          searchKey: `${c.id.toLowerCase()} ${c.name}`
        }))
        setChampions(list)
        setLoading(false)
      })
      .catch(console.error)
  }, [])

  // チャンピオン詳細が選択されたらデータ取得
  useEffect(() => {
    if (!selected) return
    loadChampionData(selected.id)
  }, [selected])

  const setField = (key, val) => setDataFields(p => ({ ...p, [key]: val }))

  const saveMemo = async () => {
    setSaving(true)
    const data = {
      matchup_id: `champ_${selected.id}_global`,
      champion: selected.id,
      enemy: 'GLOBAL',
      title: `${selected.name} 基本戦略・トレンド`,
      strategy: dataFields.strategy,
      created_at: new Date().toISOString(), // 強制的に更新日時を最新にする
      raw_data: { 
        source: 'champ_db', role: 'GLOBAL',
        strengths: dataFields.strengths,
        weaknesses: dataFields.weaknesses,
        powerSpikes: dataFields.powerSpikes,
        buildRunes: dataFields.buildRunes,
        fullClearTime: dataFields.fullClearTime
      }
    }
    const { error } = await supabase.from('matchup_sentinel').upsert(data, { onConflict: 'matchup_id' })
    if (error) alert('保存失敗: ' + error.message)
    else {
      // 成功したらローカルの更新日時も更新する
      setChampDates(prev => ({ ...prev, [selected.id]: data.created_at }))
    }
    setSaving(false)
  }

  const filtered = useMemo(() => {
    let result = champions
    if (search.trim()) {
      const q = search.toLowerCase()
      const hiraToKata = q.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60))
      result = result.filter(c => c.searchKey.includes(q) || c.searchKey.includes(hiraToKata))
    }
    
    // ソート処理
    result = [...result].sort((a, b) => {
      if (sortOrder === 'updated_desc') {
        const dateA = champDates[a.id] ? new Date(champDates[a.id]).getTime() : 0
        const dateB = champDates[b.id] ? new Date(champDates[b.id]).getTime() : 0
        if (dateA !== dateB) return dateB - dateA
      }
      return a.name.localeCompare(b.name)
    })
    
    return result
  }, [champions, search, sortOrder, champDates])

  const linkBtn = { display: 'flex', alignItems: 'center', gap: '8px', color: '#00cfef', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '14px', marginBottom: '20px' }

  if (selected) {
    const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <button onClick={() => setSelected(null)} style={linkBtn}><ChevronLeft size={18} /> 辞典トップに戻る</button>
        
        {/* ヘッダー領域 */}
        <div style={{ 
          position: 'relative', height: '240px', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', padding: '32px'
        }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${getChampSplash(selected.id)})`, backgroundSize: 'cover', backgroundPosition: 'center 20%', zIndex: 0 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,11,16,1) 0%, rgba(10,11,16,0.2) 100%)', zIndex: 1 }} />
          
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '24px', width: '100%' }}>
            <img src={getChampIcon(selected.id)} alt={selected.name} style={{ width: '80px', height: '80px', borderRadius: '50%', border: '3px solid #c89b3c', boxShadow: '0 0 20px rgba(200,155,60,0.5)' }} />
            <div>
              <p style={{ color: '#c89b3c', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{selected.title}</p>
              <h1 style={{ fontSize: '36px', fontWeight: 900, fontFamily: "'Space Grotesk', monospace", margin: 0 }}>{selected.name}</h1>
            </div>
            
            {/* 戦績バッジ */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px' }}>
              <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#a0a5b0', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>Win Rate</p>
                <p style={{ fontSize: '20px', fontWeight: 900, color: winRate >= 50 ? '#22c55e' : '#ef4444' }}>{stats.matches > 0 ? `${winRate}%` : '-'}</p>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#a0a5b0', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>Matches / KDA</p>
                <p style={{ fontSize: '16px', fontWeight: 900, color: '#f0f5f5' }}>{stats.matches}戦 <span style={{ color: '#00cfef', fontSize: '14px', marginLeft: '4px' }}>{stats.kda}</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* コンテンツ領域 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '24px', borderTop: '3px solid #22c55e' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#22c55e', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Swords size={18} /> 強み (Strengths)</h3>
            <textarea value={dataFields.strengths} onChange={e => setField('strengths', e.target.value)} placeholder="例: 序盤のジャングル周回が早い、Lv6からのガンクが強力..." style={{ width: '100%', height: '100px', padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', color: '#f0f5f5', fontSize: '13px', outline: 'none', resize: 'vertical' }} />
          </div>

          <div className="glass-card" style={{ padding: '24px', borderTop: '3px solid #ef4444' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ef4444', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={18} /> 弱み (Weaknesses)</h3>
            <textarea value={dataFields.weaknesses} onChange={e => setField('weaknesses', e.target.value)} placeholder="例: CCに極端に弱い、インベードされると復帰が難しい..." style={{ width: '100%', height: '100px', padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f0f5f5', fontSize: '13px', outline: 'none', resize: 'vertical' }} />
          </div>

          <div className="glass-card" style={{ padding: '24px', borderTop: '3px solid #c89b3c' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#c89b3c', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={18} /> パワースパイク</h3>
            <textarea value={dataFields.powerSpikes} onChange={e => setField('powerSpikes', e.target.value)} placeholder="例: コアアイテム1個完成時、Lv11のウルト強化時..." style={{ width: '100%', height: '100px', padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(200,155,60,0.3)', borderRadius: '8px', color: '#f0f5f5', fontSize: '13px', outline: 'none', resize: 'vertical' }} />
          </div>

          <div className="glass-card" style={{ padding: '24px', borderTop: '3px solid #a78bfa' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#a78bfa', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={18} /> コアビルド / ルーン</h3>
            <textarea value={dataFields.buildRunes} onChange={e => setField('buildRunes', e.target.value)} placeholder="例: メイン: 征服者 / コア: リッチベイン..." style={{ width: '100%', height: '100px', padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '8px', color: '#f0f5f5', fontSize: '13px', outline: 'none', resize: 'vertical' }} />
          </div>

          <div className="glass-card" style={{ padding: '24px', borderTop: '3px solid #f59e0b' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#f59e0b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={18} /> フルクリア時間 (JGのみ)</h3>
            <textarea value={dataFields.fullClearTime} onChange={e => setField('fullClearTime', e.target.value)} placeholder="例: 3:15 (リーシュあり), 3:28 (ソロ)..." style={{ width: '100%', height: '100px', padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', color: '#f0f5f5', fontSize: '13px', outline: 'none', resize: 'vertical' }} />
          </div>
        </div>

        {/* 全体メモ（トレンド・動画）エディタ */}
        <div className="glass-card" style={{ padding: '24px', borderTop: '3px solid #00cfef', marginTop: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, fontFamily: "'Space Grotesk', monospace", marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} style={{ color: '#00cfef' }} /> 全体的な立ち回り・トレンドメモ
          </h3>
          <textarea 
            value={dataFields.strategy} onChange={e => setField('strategy', e.target.value)}
            placeholder="動画で見たコンボ、メタの立ち回り、BANすべきチャンピオンなどを記録..."
            style={{ width: '100%', height: '160px', padding: '16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,207,239,0.3)', borderRadius: '12px', color: '#f0f5f5', fontSize: '14px', lineHeight: 1.6, outline: 'none', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button onClick={saveMemo} disabled={saving} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #00cfef 0%, #0096e6 100%)', color: '#000', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(0,207,239,0.3)' }}>
              {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
              情報を保存する
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, fontFamily: "'Space Grotesk', monospace", marginBottom: '8px' }}>チャンピオン辞典</h1>
          <p style={{ color: '#a0a5b0', fontSize: '14px' }}>動画の知識や基本戦略をチャンピオンごとに蓄積するデータベース。</p>
        </div>
        <button onClick={onBack} style={{ padding: '8px 16px', border: 'none', cursor: 'pointer', color: '#c89b3c', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(20,22,30,0.7)', borderRadius: '10px' }}>
          <ChevronLeft size={16} /> 戻る
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', maxWidth: '800px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#00cfef' }} size={22} />
          <input type="text" autoFocus placeholder="チャンピオン名で検索..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '16px 16px 16px 54px', background: 'rgba(0,207,239,0.05)', border: '2px solid rgba(0,207,239,0.2)', borderRadius: '14px', color: '#f0f5f5', fontSize: '16px', fontWeight: 700, outline: 'none' }} />
        </div>
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ padding: '0 16px', background: 'rgba(20,22,30,0.8)', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: '#f0f5f5', fontSize: '14px', fontWeight: 700, outline: 'none', cursor: 'pointer' }}>
          <option value="updated_desc">更新日が新しい順</option>
          <option value="name_asc">名前順</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '16px' }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="glass-card" style={{ height: '100px', opacity: 0.2 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '16px' }}>
          {filtered.map(c => (
            <div key={c.id} onClick={() => setSelected(c)} className="glass-card"
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', background: champDates[c.id] ? 'rgba(0,207,239,0.05)' : 'rgba(255,255,255,0.02)', border: champDates[c.id] ? '1px solid rgba(0,207,239,0.2)' : '1px solid rgba(255,255,255,0.05)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.background = 'rgba(0,207,239,0.1)'; e.currentTarget.style.borderColor = 'rgba(0,207,239,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = champDates[c.id] ? 'rgba(0,207,239,0.05)' : 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = champDates[c.id] ? '1px solid rgba(0,207,239,0.2)' : '1px solid rgba(255,255,255,0.05)' }}>
              <img src={getChampIcon(c.id)} alt={c.name} style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '13px', fontWeight: 800, textAlign: 'center', lineHeight: 1.2 }}>{c.name}</span>
              {champDates[c.id] && (
                <span style={{ fontSize: '10px', color: '#00cfef', fontWeight: 700 }}>
                  {new Date(champDates[c.id]).toLocaleDateString('ja-JP')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export default ChampionDB
