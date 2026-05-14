import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { getChampIcon } from '../lib/ddragon'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Target, Zap, Search, AlertTriangle, ChevronLeft, Swords, Plus, X, Save, ChevronDown, Star, RefreshCw } from 'lucide-react'

const EMPTY_MEMO = {
  champion: '', enemy: '', role: 'Jungle', title: '',
  difficulty: 3, winCondition: '', earlyGame: '', powerSpikes: '',
  buildRunes: '', firstClear: '', counterJg: '', result: '',
  strategy: '',
}

const MatchupExplorer = ({ onBack }) => {
  const [matchups, setMatchups] = useState([])
  const [articles, setArticles] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [memo, setMemo] = useState({ ...EMPTY_MEMO })
  const [saving, setSaving] = useState(false)

  const [champMap, setChampMap] = useState({})

  useEffect(() => {
    fetchData()
    // カタカナ・ひらがな検索用の日本語名辞書を取得
    fetch('https://ddragon.leagueoflegends.com/cdn/14.10.1/data/ja_JP/champion.json')
      .then(r => r.json())
      .then(d => {
        const m = {}
        Object.values(d.data).forEach(c => m[c.id.toLowerCase()] = c.name)
        setChampMap(m)
      }).catch(console.error)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [mRes, aRes] = await Promise.all([
      supabase.from('matchup_sentinel').select('*').order('created_at', { ascending: false }),
      supabase.from('bible_articles').select('id,title,champion').order('created_at', { ascending: false }),
    ])
    if (mRes.data) setMatchups(mRes.data)
    if (aRes.data) setArticles(aRes.data)
    setLoading(false)
  }

  const results = useMemo(() => {
    if (!search.trim()) return { matchups, articles: [] }
    const q = search.toLowerCase()
    
    // ひらがな・カタカナ・英語対応の検索ヘルパー
    const champMatch = (name) => {
      if (!name) return false
      if (name.toLowerCase().includes(q)) return true
      
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, '')
      const jpName = champMap[key] || ''
      if (jpName && jpName.includes(q)) return true
      
      // ひらがなで入力された場合をカタカナに変換して比較
      const hiraToKata = q.replace(/[\u3041-\u3096]/g, match => String.fromCharCode(match.charCodeAt(0) + 0x60))
      if (jpName && jpName.includes(hiraToKata)) return true
      
      return false
    }

    return {
      matchups: matchups.filter(m => 
        champMatch(m.champion) || 
        champMatch(m.enemy) || 
        [m.title, m.strategy].some(f => f?.toLowerCase().includes(q))
      ),
      articles: articles.filter(a => 
        a.title?.toLowerCase().includes(q) || 
        champMatch(a.champion)
      ).slice(0, 4),
    }
  }, [search, matchups, articles, champMap])

  const groupedMatchups = useMemo(() => {
    const groups = {}
    results.matchups.forEach(m => {
      const rd = m.raw_data || {}
      let role = rd.role || m.role || 'UNKNOWN'
      let displayRole = role.toUpperCase()
      if (displayRole === 'UTILITY') displayRole = 'SUPPORT'
      if (displayRole === 'BOTTOM') displayRole = 'BOT'
      
      if (!groups[displayRole]) groups[displayRole] = []
      groups[displayRole].push(m)
    })
    return groups
  }, [results.matchups])

  const set = (k, v) => setMemo(p => ({ ...p, [k]: v }))

  const handleEdit = (m) => {
    const rd = m.raw_data || {}
    let rl = (rd.role || m.role || 'Jungle').toUpperCase()
    if (rl === 'UTILITY') rl = 'Support'
    else if (rl === 'BOTTOM') rl = 'Bot'
    else rl = rl.charAt(0) + rl.slice(1).toLowerCase()

    setMemo({
      id: m.id, matchup_id: m.matchup_id, original_raw_data: rd,
      champion: m.champion, enemy: m.enemy, role: rl,
      title: m.title, difficulty: rd.difficulty || 3,
      winCondition: rd.winCondition || '', earlyGame: rd.earlyGame || '',
      firstClear: rd.firstClear || '', counterJg: rd.counterJg || '',
      powerSpikes: rd.powerSpikes || '', buildRunes: rd.buildRunes || '',
      result: rd.result || '', strategy: m.strategy || ''
    })
    setShowForm(true)
    setSelected(null)
  }

  const saveMemo = async () => {
    if (!memo.champion || !memo.enemy) return alert('チャンピオン名を入力してください')
    setSaving(true)
    
    // APIデータ等、元のraw_dataがある場合はマージして構造を維持する
    const mergedRawData = memo.original_raw_data 
      ? { ...memo.original_raw_data, ...memo }
      : { source: 'manual', ...memo }
    delete mergedRawData.original_raw_data // クリーンアップ

    const data = {
      champion: memo.champion, enemy: memo.enemy,
      title: memo.title || `${memo.champion} vs ${memo.enemy} (${memo.role})`,
      strategy: memo.strategy,
      raw_data: mergedRawData,
    }
    
    if (memo.id) data.id = memo.id;
    data.matchup_id = memo.matchup_id || `manual_${Date.now()}`;

    const { error } = await supabase.from('matchup_sentinel').upsert(data)
    if (!error) {
      if (memo.id) {
        setMatchups(prev => prev.map(p => p.id === memo.id ? { ...p, ...data } : p))
      } else {
        setMatchups(prev => [{ ...data, id: Date.now(), created_at: new Date().toISOString() }, ...prev])
      }
      setMemo({ ...EMPTY_MEMO }); setShowForm(false)
    } else alert('保存失敗: ' + error.message)
    setSaving(false)
  }

  // ===== 詳細ビュー =====
  if (selected) {
    const m = selected; const rd = m.raw_data || {}
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <button onClick={() => setSelected(null)} style={linkBtn}><ChevronLeft size={18} /> 検索に戻る</button>
        <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto', overflow: 'hidden' }}>
          <div style={{ height: '3px', background: '#00cfef' }} />
          <div style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <Badge name={m.champion} color="#c89b3c" lg />
              <span style={{ color: '#00cfef', fontWeight: 900, fontSize: '16px', fontStyle: 'italic' }}>VS</span>
              <Badge name={m.enemy} color="#00cfef" lg />
              {rd.difficulty > 0 && <DiffStars val={rd.difficulty} />}
              {rd.result && <span style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 800, background: rd.result === 'Win' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: rd.result === 'Win' ? '#22c55e' : '#ef4444' }}>{rd.result}</span>}
            </div>
            {(() => {
              const clean = n => (n||'').toLowerCase().replace(/[^a-z0-9]/g, '');
              const myChamp = clean(m.champion);
              const enemyChamp = clean(m.enemy);
              let rl = (rd.role || m.role || 'jungle').toLowerCase();
              if (rl === 'utility') rl = 'support';
              if (rl === 'bottom') rl = 'adc';
              const lolUrl = `https://lolalytics.com/lol/${myChamp}/vs/${enemyChamp}/build/?vslane=${rl}`;
              const opUrl = `https://www.op.gg/champions/${myChamp}/build/${rl}?region=global&tier=emerald_plus&target_champion=${enemyChamp}`;
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                  <h1 style={{ fontSize: '24px', fontWeight: 900, fontFamily: "'Space Grotesk', monospace", margin: 0 }}>{m.title}</h1>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleEdit(m)} style={{ padding: '6px 12px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRadius: '6px', fontSize: '11px', fontWeight: 800, border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📝 メモを編集／追記
                    </button>
                    <a href={lolUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', background: 'rgba(212,175,55,0.15)', color: '#d4af37', borderRadius: '6px', fontSize: '11px', fontWeight: 800, textDecoration: 'none', border: '1px solid rgba(212,175,55,0.3)' }}>
                      📊 Lolalytics ↗
                    </a>
                    <a href={opUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', background: 'rgba(83,131,232,0.15)', color: '#5383e8', borderRadius: '6px', fontSize: '11px', fontWeight: 800, textDecoration: 'none', border: '1px solid rgba(83,131,232,0.3)' }}>
                      🔵 OP.GG ↗
                    </a>
                  </div>
                </div>
              )
            })()}
            {rd.winCondition && <InfoBlock title="勝ち筋" icon="🎯" text={rd.winCondition} color="#c89b3c" />}
            {rd.earlyGame && <InfoBlock title="序盤の動き (Lv1-6)" icon="⚔️" text={rd.earlyGame} color="#00cfef" />}
            
            {/* 序盤の主導権 (Riot API自動取得) */}
            {rd.challenges && Object.keys(rd.challenges).length > 0 && (
              <div style={{ background: 'rgba(34,197,94,0.05)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(34,197,94,0.2)', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontFamily: "'Space Grotesk', monospace" }}>
                  👑 序盤の主導権 (API Data)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  <StatPill label="最大CSリード" val={rd.challenges.maxCsAdvantage > 0 ? `+${Math.round(rd.challenges.maxCsAdvantage)}` : Math.round(rd.challenges.maxCsAdvantage)} good={rd.challenges.maxCsAdvantage >= 10} />
                  <StatPill label="最大Lvリード" val={rd.challenges.maxLevelLead > 0 ? `+${rd.challenges.maxLevelLead}` : rd.challenges.maxLevelLead} good={rd.challenges.maxLevelLead >= 1} />
                  <StatPill label="カウンターJG" val={`${rd.challenges.enemyJgKills} CS`} good={rd.challenges.enemyJgKills >= 12} />
                  <StatPill label="カニ獲得" val={`${rd.challenges.scuttleCrabs} 匹`} good={rd.challenges.scuttleCrabs >= 2} />
                  <StatPill label="キル関与率" val={`${rd.challenges.killParticipation}%`} good={rd.challenges.killParticipation >= 50} />
                  <StatPill label="タワープレート" val={`${rd.challenges.plates} 枚`} good={rd.challenges.plates >= 2} />
                </div>
              </div>
            )}

            {rd.firstClear && <InfoBlock title={(rd.role || m.role || '').toUpperCase() === 'JUNGLE' ? "ファーストクリアルート" : "警戒すべきスキル・CD"} icon={(rd.role || m.role || '').toUpperCase() === 'JUNGLE' ? "🗺️" : "🚨"} text={rd.firstClear} color="#a78bfa" />}
            {rd.counterJg && <InfoBlock title={(rd.role || m.role || '').toUpperCase() === 'JUNGLE' ? "カウンターJGタイミング" : "ガンク警戒・ダイブタイミング"} icon={(rd.role || m.role || '').toUpperCase() === 'JUNGLE' ? "🔥" : "⚠️"} text={rd.counterJg} color="#f59e0b" />}
            {rd.powerSpikes && <InfoBlock title="注意すべきパワースパイク" icon="⚡" text={rd.powerSpikes} color="#ef4444" />}
            {rd.buildRunes && <InfoBlock title="推奨ビルド / ルーン" icon="🛡️" text={rd.buildRunes} color="#22d3ee" />}
            {m.strategy && <InfoBlock title="反省メモ" icon="📝" text={m.strategy} color="#a0a5b0" />}

            <div style={{ marginTop: '16px', fontSize: '11px', color: '#a0a5b0', fontFamily: "'Space Grotesk', monospace" }}>
              更新: {new Date(m.created_at).toLocaleString('ja-JP')} | ソース: {rd.source || 'unknown'}
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ===== メイン =====
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 900, fontFamily: "'Space Grotesk', monospace", display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Swords style={{ color: '#00cfef' }} size={26} /> バトルサーチ
          </h2>
          <p style={{ color: '#a0a5b0', fontSize: '13px' }}>対面チャンプ名を入力 → 即座に対策を表示</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowForm(!showForm)} style={btn(showForm ? '#ef4444' : '#00cfef', showForm ? 'rgba(239,68,68,0.1)' : 'rgba(0,207,239,0.1)')}>
            {showForm ? <><X size={14} /> 閉じる</> : <><Plus size={14} /> メモ追加</>}
          </button>
          <button onClick={onBack} style={btn('#c89b3c', 'rgba(20,22,30,0.7)')}><ChevronLeft size={14} /> 戻る</button>
        </div>
      </div>

      {/* メモ追加フォーム */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="glass-card" style={{ padding: '24px', marginBottom: '20px', overflow: 'hidden', borderLeft: '4px solid #00cfef' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '16px', color: '#00cfef', fontFamily: "'Space Grotesk', monospace" }}>
              <Plus size={16} style={{ display: 'inline', marginRight: '6px' }} /> {memo.role === 'Jungle' ? 'JG' : 'レーン'}マッチアップメモ
            </h3>

            {/* 基本情報 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <Inp label="自分のチャンプ *" ph="例: Lillia" val={memo.champion} set={v => set('champion', v)} />
              <Inp label="相手のチャンプ *" ph="例: Lee Sin" val={memo.enemy} set={v => set('enemy', v)} />
              <div>
                <Lbl>ロール</Lbl>
                <select value={memo.role} onChange={e => set('role', e.target.value)} style={selStyle}>
                  <option>Jungle</option><option>Top</option><option>Mid</option><option>Bot</option><option>Support</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <Inp label="タイトル（任意）" ph="例: リリア vs リーシン" val={memo.title} set={v => set('title', v)} />
              <div>
                <Lbl>難易度</Lbl>
                <div style={{ display: 'flex', gap: '4px', paddingTop: '6px' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => set('difficulty', n)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', opacity: n <= memo.difficulty ? 1 : 0.2 }}>⭐</button>
                  ))}
                </div>
              </div>
              <div>
                <Lbl>戦績</Lbl>
                <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                  {['Win', 'Lose'].map(r => (
                    <button key={r} onClick={() => set('result', r)}
                      style={{ padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, background: memo.result === r ? (r === 'Win' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.05)', color: memo.result === r ? (r === 'Win' ? '#22c55e' : '#ef4444') : '#a0a5b0' }}>
                      {r === 'Win' ? '勝ち' : '負け'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ロール専用項目 */}
            {memo.role === 'Jungle' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <Inp label="🎯 勝ち筋" ph="この対面の勝ち方を一言で" val={memo.winCondition} set={v => set('winCondition', v)} />
                  <Inp label="⚔️ 序盤の動き (Lv1-6)" ph="ガンク先、ファーム優先度など" val={memo.earlyGame} set={v => set('earlyGame', v)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <Inp label="🗺️ ファーストクリアルート" ph="赤→クルーグ→... or 青→グロンプ→..." val={memo.firstClear} set={v => set('firstClear', v)} />
                  <Inp label="🔥 カウンターJGタイミング" ph="相手の2周目開始時に赤側侵入" val={memo.counterJg} set={v => set('counterJg', v)} />
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <Inp label="🎯 勝ち筋" ph="どうすればこのレーン勝てるか" val={memo.winCondition} set={v => set('winCondition', v)} />
                  <Inp label="⚔️ レーン戦の基本方針 (Lv1-6)" ph="プッシュか、プルか、ハラスか" val={memo.earlyGame} set={v => set('earlyGame', v)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <Inp label="🚨 警戒すべきスキル・CD" ph="相手のE抜けたらトレード勝てる等" val={memo.firstClear} set={v => set('firstClear', v)} />
                  <Inp label="⚠️ ガンク警戒・ダイブタイミング" ph="Lv3ガンク注意、ウェーブ押し付け時等" val={memo.counterJg} set={v => set('counterJg', v)} />
                </div>
              </>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <Inp label="⚡ パワースパイク注意" ph="相手Lv6で即キル圏内に入る" val={memo.powerSpikes} set={v => set('powerSpikes', v)} />
              <Inp label="🛡️ 推奨ビルド / ルーン" ph="電撃→即ゾーニャ" val={memo.buildRunes} set={v => set('buildRunes', v)} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <Lbl>📝 反省メモ / 自由記述</Lbl>
              <textarea placeholder="次回はこうする、今回の敗因、気づいたこと..."
                value={memo.strategy} onChange={e => set('strategy', e.target.value)}
                style={{ ...inpStyle, minHeight: '80px', resize: 'vertical' }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <button onClick={saveMemo} disabled={saving}
                style={{ padding: '10px 24px', background: saving ? '#666' : '#00cfef', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Save size={14} /> {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 検索バー */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#00cfef' }} size={22} />
        <input type="text" autoFocus placeholder="例: Yone, Lee Sin, Lillia..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '18px 18px 18px 54px', background: 'rgba(0,207,239,0.05)', border: '2px solid rgba(0,207,239,0.2)', borderRadius: '14px', color: '#f0f5f5', fontSize: '17px', fontWeight: 700, fontFamily: "'Outfit', sans-serif", outline: 'none' }} />
        {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '5px 12px', color: '#a0a5b0', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>クリア</button>}
      </div>

      {/* 結果表示 */}
      {loading ? (
        <div style={{ display: 'grid', gap: '12px' }}>{[1,2,3].map(i => <div key={i} className="glass-card" style={{ height: '120px', opacity: 0.2 }} />)}</div>
      ) : (
        <>
          {results.matchups.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              {search && <SectLabel label={`マッチアップ (${results.matchups.length}件)`} color="#00cfef" />}
              
              {Object.entries(groupedMatchups).map(([role, items]) => (
                <div key={role} style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                    <div style={{ width: '4px', height: '14px', borderRadius: '2px', background: '#c89b3c' }} />
                    <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#f0f5f5', letterSpacing: '0.1em', fontFamily: "'Space Grotesk', monospace" }}>
                      {role} <span style={{ color: '#666', fontSize: '12px', fontWeight: 700 }}>({items.length})</span>
                    </h3>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
                    {items.map(m => {
                      const rd = m.raw_data || {}
                      return (
                        <div key={m.id} className="glass-card" onClick={() => setSelected(m)}
                          style={{ padding: '20px', borderLeft: '4px solid #00cfef', cursor: 'pointer', position: 'relative', transition: 'all 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                            <Badge name={m.champion} color="#c89b3c" />
                            <span style={{ color: '#00cfef', fontWeight: 900, fontSize: '10px', fontStyle: 'italic' }}>VS</span>
                            <Badge name={m.enemy} color="#00cfef" />
                            {rd.difficulty > 0 && <DiffStars val={rd.difficulty} small />}
                            {rd.result && <span style={{ fontSize: '10px', fontWeight: 800, color: rd.result === 'Win' ? '#22c55e' : '#ef4444', marginLeft: 'auto' }}>{rd.result === 'Win' ? '勝ち' : '負け'}</span>}
                          </div>
                          <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '8px', lineHeight: 1.3 }}>{m.title}</h3>
                          {(rd.winCondition || m.strategy) && (
                            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', fontSize: '12px', color: '#c0c5ca', fontStyle: 'italic', lineHeight: 1.5 }}>
                              「{(rd.winCondition || m.strategy || '').slice(0, 100)}...」
                            </div>
                          )}
                          <div style={{ marginTop: '10px', fontSize: '11px', color: '#00cfef', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <ChevronDown size={14} /> 詳細を見る
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {search && results.articles.length > 0 && (
            <div>
              <SectLabel label={`関連記事 (${results.articles.length}件)`} color="#c89b3c" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                {results.articles.map(a => (
                  <div key={a.id} className="glass-card" style={{ padding: '14px', borderLeft: '3px solid #c89b3c' }}>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#c89b3c', background: 'rgba(200,155,60,0.15)', padding: '2px 8px', borderRadius: '999px' }}>{a.champion}</span>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, marginTop: '6px' }}>{a.title.replace(/_/g, ' ')}</h4>
                  </div>
                ))}
              </div>
            </div>
          )}
          {results.matchups.length === 0 && (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
              <Shield size={40} style={{ color: '#00cfef', marginBottom: '12px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>{search ? `「${search}」一致なし` : 'マッチアップ未登録'}</h3>
              <p style={{ color: '#a0a5b0', fontSize: '13px' }}>「メモ追加」から記録を始めましょう</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ===== 小パーツ =====
const ChampImg = ({ name, size = 24 }) => {
  const [err, setErr] = useState(false)
  const src = getChampIcon(name)
  if (!src || err) return <Target size={size * 0.6} style={{ color: '#a0a5b0' }} />
  return <img src={src} alt={name} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.15)' }} onError={() => setErr(true)} />
}
const Badge = ({ name, color, lg }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: lg ? '6px 14px' : '4px 10px', borderRadius: '999px', background: `${color}15`, border: `1px solid ${color}30` }}>
    <ChampImg name={name} size={lg ? 32 : 22} />
    <span style={{ fontSize: lg ? '15px' : '12px', fontWeight: 800, color }}>{name}</span>
  </div>
)
const DiffStars = ({ val, small }) => (
  <span style={{ fontSize: small ? '10px' : '14px' }}>{'⭐'.repeat(val)}</span>
)
const InfoBlock = ({ title, icon, text, color }) => (
  <div style={{ background: `${color}08`, borderRadius: '12px', padding: '16px', border: `1px solid ${color}20`, marginBottom: '12px' }}>
    <h3 style={{ fontSize: '12px', fontWeight: 900, color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontFamily: "'Space Grotesk', monospace" }}>{icon} {title}</h3>
    <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#e0e5ea' }}>{text}</p>
  </div>
)
const SectLabel = ({ label, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
    <div style={{ width: '3px', height: '18px', borderRadius: '2px', background: color }} />
    <span style={{ fontSize: '12px', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Space Grotesk', monospace" }}>{label}</span>
  </div>
)
const StatPill = ({ label, val, good }) => (
  <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${good ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.05)'}` }}>
    <span style={{ fontSize: '10px', color: '#a0a5b0', marginBottom: '2px' }}>{label}</span>
    <span style={{ fontSize: '14px', fontWeight: 800, color: good ? '#22c55e' : '#f0f5f5' }}>{val}</span>
  </div>
)
const Lbl = ({ children }) => <label style={{ fontSize: '11px', fontWeight: 700, color: '#a0a5b0', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{children}</label>
const inpStyle = { width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#f0f5f5', fontSize: '14px', fontFamily: "'Outfit', sans-serif", outline: 'none' }
const selStyle = { ...inpStyle, appearance: 'none', cursor: 'pointer' }
const Inp = ({ label, ph, val, set }) => (<div><Lbl>{label}</Lbl><input type="text" placeholder={ph} value={val} onChange={e => set(e.target.value)} style={inpStyle} /></div>)
const btn = (color, bg) => ({ padding: '8px 16px', border: 'none', cursor: 'pointer', color, fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', background: bg, borderRadius: '10px' })
const linkBtn = { display: 'flex', alignItems: 'center', gap: '6px', color: '#00cfef', fontWeight: 700, fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px' }

export default MatchupExplorer
