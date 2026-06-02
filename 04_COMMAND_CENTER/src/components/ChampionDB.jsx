import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { getChampIcon, getChampSplash } from '../lib/ddragon'
import { motion } from 'framer-motion'
import { ChevronLeft, Search, Save, BookOpen, RefreshCw, Zap, ShieldAlert, Swords, Shield, Copy, Check, FileText, Edit2, Eye } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
    counterChampions: '',
    mustBanChampions: '',
    pickRecommendation: '',
    strategy: '',
    note_draft: ''
  })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [noteDraftMode, setNoteDraftMode] = useState('preview') // 'preview' | 'edit'
  
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
      counterChampions: rd.counterChampions || '',
      mustBanChampions: rd.mustBanChampions || '',
      pickRecommendation: rd.pickRecommendation || '',
      strategy: noteData?.strategy || '',
      note_draft: rd.note_draft || ''
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
        fullClearTime: dataFields.fullClearTime,
        counterChampions: dataFields.counterChampions,
        mustBanChampions: dataFields.mustBanChampions,
        pickRecommendation: dataFields.pickRecommendation,
        note_draft: dataFields.note_draft
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
            <textarea value={dataFields.buildRunes} onChange={e => setField('buildRunes', e.target.value)} placeholder="例: メイン: 征服者 / コア: リッチベイン（理由: 序盤のトレードを強化し、スノーボールするため）..." style={{ width: '100%', height: '100px', padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '8px', color: '#f0f5f5', fontSize: '13px', outline: 'none', resize: 'vertical' }} />
          </div>

          <div className="glass-card" style={{ padding: '24px', borderTop: '3px solid #f59e0b' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#f59e0b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={18} /> フルクリア時間 (JGのみ)</h3>
            <textarea value={dataFields.fullClearTime} onChange={e => setField('fullClearTime', e.target.value)} placeholder="例: 3:15 (リーシュあり), 3:28 (ソロ)..." style={{ width: '100%', height: '100px', padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', color: '#f0f5f5', fontSize: '13px', outline: 'none', resize: 'vertical' }} />
          </div>

          <div className="glass-card" style={{ padding: '24px', borderTop: '3px solid #06b6d4' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#06b6d4', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Swords size={18} /> 対面の有利・不利チャンプ</h3>
            <textarea value={dataFields.counterChampions} onChange={e => setField('counterChampions', e.target.value)} placeholder="例: カウンター: サイラス（理由: ウルトを奪われると被害甚大）..." style={{ width: '100%', height: '100px', padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: '8px', color: '#f0f5f5', fontSize: '13px', outline: 'none', resize: 'vertical' }} />
          </div>

          <div className="glass-card" style={{ padding: '24px', borderTop: '3px solid #dc2626' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#dc2626', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={18} /> BAN必須チャンプ</h3>
            <textarea value={dataFields.mustBanChampions} onChange={e => setField('mustBanChampions', e.target.value)} placeholder="例: アーリ、ゼド（機動力が高いアサシン系）..." style={{ width: '100%', height: '100px', padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', color: '#f0f5f5', fontSize: '13px', outline: 'none', resize: 'vertical' }} />
          </div>

          <div className="glass-card" style={{ padding: '24px', borderTop: '3px solid #10b981' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={18} /> ピック推奨 (先出し/後出し)</h3>
            <textarea value={dataFields.pickRecommendation} onChange={e => setField('pickRecommendation', e.target.value)} placeholder="例: 先出し非推奨。相手の構成が見えてから出す後出しカウンターピック向け..." style={{ width: '100%', height: '100px', padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: '#f0f5f5', fontSize: '13px', outline: 'none', resize: 'vertical' }} />
          </div>
        </div>

        {/* noteドラフト記事（AI自動生成＆ブラッシュアップ用） */}
        <div className="glass-card" style={{ padding: '24px', borderTop: '3px solid #e11d48', marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, fontFamily: "'Space Grotesk', monospace", display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: '#e11d48' }} /> noteドラフト記事 (自動ブラッシュアップ)
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <button onClick={() => setNoteDraftMode('preview')}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all 0.2s', background: noteDraftMode === 'preview' ? '#e11d48' : 'transparent', color: noteDraftMode === 'preview' ? '#fff' : '#a0a5b0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Eye size={14} /> プレビュー
                </button>
                <button onClick={() => setNoteDraftMode('edit')}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all 0.2s', background: noteDraftMode === 'edit' ? '#e11d48' : 'transparent', color: noteDraftMode === 'edit' ? '#fff' : '#a0a5b0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Edit2 size={14} /> 編集
                </button>
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(dataFields.note_draft);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', color: copied ? '#22c55e' : '#f0f5f5', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {copied ? <><Check size={16} /> コピー完了</> : <><Copy size={16} /> Markdownをコピー</>}
              </button>
            </div>
          </div>
          <p style={{ color: '#a0a5b0', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
            このフィールドは、最新パッチ情報やあなたの反省メモをベースにAIが自動でブラッシュアップします。<br/>
            直接追記・編集することも可能で、保存すると次回の自動生成のベースとして引き継がれます。
          </p>
          
          {noteDraftMode === 'edit' ? (
            <textarea 
              value={dataFields.note_draft} onChange={e => setField('note_draft', e.target.value)}
              placeholder="# 究極の攻略バイブル..."
              style={{ width: '100%', height: '400px', padding: '16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(225,29,72,0.3)', borderRadius: '12px', color: '#f0f5f5', fontSize: '14px', lineHeight: 1.6, outline: 'none', resize: 'vertical', fontFamily: 'monospace' }}
            />
          ) : (
            <div className="markdown-preview" style={{ width: '100%', minHeight: '400px', padding: '24px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: '#e0e5ea', fontSize: '14px', lineHeight: 1.8 }}>
              {dataFields.note_draft ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {dataFields.note_draft}
                </ReactMarkdown>
              ) : (
                <p style={{ color: '#a0a5b0', fontStyle: 'italic' }}>まだドラフト記事がありません。情報が蓄積されるとAIが自動生成します。</p>
              )}
            </div>
          )}
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

      <div style={{ position: 'sticky', top: '70px', zIndex: 10, display: 'flex', gap: '12px', marginBottom: '32px', maxWidth: '800px', background: 'rgba(10,11,16,0.85)', backdropFilter: 'blur(12px)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#00cfef' }} size={22} />
          <input type="text" autoFocus placeholder="チャンピオン名で検索..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '16px 16px 16px 54px', background: 'rgba(0,207,239,0.05)', border: '2px solid rgba(0,207,239,0.2)', borderRadius: '14px', color: '#f0f5f5', fontSize: '16px', fontWeight: 700, outline: 'none' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '5px 12px', color: '#a0a5b0', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>クリア</button>}
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
            <div key={c.id} onClick={() => setSelected(c)} className={champDates[c.id] ? "glass-card" : "glass-card"}
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', background: champDates[c.id] ? 'rgba(0,207,239,0.05)' : 'rgba(255,255,255,0.02)', border: champDates[c.id] ? '1px solid rgba(0,207,239,0.3)' : '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
              <img src={getChampIcon(c.id)} alt={c.name} style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '13px', fontWeight: 800, textAlign: 'center', lineHeight: 1.2, color: champDates[c.id] ? '#00cfef' : '#f0f5f5' }}>{c.name}</span>
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
