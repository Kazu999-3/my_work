import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Check, X, Code, Terminal, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function HealerPanel() {
  const [patches, setPatches] = useState([])
  const [loadingId, setLoadingId] = useState(null)

  const fetchPatches = async () => {
    try {
      const { data, error } = await supabase
        .from('system_patches')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      
      if (!error && data) {
        setPatches(data)
      }
    } catch (e) {
      console.error('Failed to fetch patches:', e)
    }
  }

  useEffect(() => {
    fetchPatches()
    
    // リアルタイムサブスクリプション
    const sub = supabase
      .channel('system_patches_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_patches' }, fetchPatches)
      .subscribe()
      
    return () => supabase.removeChannel(sub)
  }, [])

  const handleApply = async (patch) => {
    setLoadingId(patch.id)
    try {
      // 実際には apply_patch.py などのPythonプロセスを叩く必要がありますが、
      // ここではSupabase上のステータスを 'approved' に変更し、バックエンドがそれを検知して適用する形にします。
      const { error } = await supabase
        .from('system_patches')
        .update({ status: 'approved' })
        .eq('id', patch.id)
        
      if (!error) {
        setPatches(patches.filter(p => p.id !== patch.id))
      }
    } catch (e) {
      console.error('Failed to approve patch', e)
    }
    setLoadingId(null)
  }

  const handleDiscard = async (id) => {
    try {
      await supabase
        .from('system_patches')
        .update({ status: 'rejected' })
        .eq('id', id)
        
      setPatches(patches.filter(p => p.id !== id))
    } catch (e) {
      console.error('Failed to reject patch', e)
    }
  }

  if (patches.length === 0) return null

  return (
    <div style={{ marginBottom: '24px' }}>
      <AnimatePresence>
        {patches.map(patch => (
          <motion.div
            key={patch.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, height: 0 }}
            style={{
              background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.02))',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '16px',
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.15)',
              backdropFilter: 'blur(10px)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* 装飾 */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ef4444' }} />
            
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.2)',
                padding: '12px',
                borderRadius: '12px',
                color: '#ef4444'
              }}>
                <AlertTriangle size={24} />
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Auto-Healer 修正パッチ提案
                      <span style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '2px 8px', borderRadius: '12px' }}>CRITICAL</span>
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Terminal size={14} /> {patch.target_file?.split('/').pop() || 'Unknown File'}
                      <span style={{ margin: '0 6px', color: 'rgba(255,255,255,0.3)' }}>|</span>
                      <Clock size={14} /> {new Date(patch.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleDiscard(patch.id)}
                      disabled={loadingId === patch.id}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'rgba(255,255,255,0.7)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '14px',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <X size={16} /> 破棄
                    </button>
                    <button
                      onClick={() => handleApply(patch)}
                      disabled={loadingId === patch.id}
                      style={{
                        background: '#ef4444',
                        border: 'none',
                        color: '#fff',
                        padding: '8px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)' }}
                      onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)' }}
                    >
                      {loadingId === patch.id ? (
                        <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Check size={16} />
                      )}
                      適用して修復
                    </button>
                  </div>
                </div>
                
                <p style={{ color: '#fff', fontSize: '15px', lineHeight: '1.5', margin: '0 0 12px 0' }}>
                  {patch.description}
                </p>
                
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontSize: '12px' }}>エラーログ:</div>
                  <div style={{ color: '#ef4444', marginBottom: '12px' }}>{patch.error_preview}</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontSize: '12px' }}>置換前:</div>
                      <pre style={{ margin: 0, color: 'rgba(255,255,255,0.7)', overflowX: 'auto', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                        {patch.search_content?.substring(0, 200)}{patch.search_content?.length > 200 ? '...' : ''}
                      </pre>
                    </div>
                    <div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontSize: '12px' }}>置換後:</div>
                      <pre style={{ margin: 0, color: '#10b981', overflowX: 'auto', padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px' }}>
                        {patch.replace_content?.substring(0, 200)}{patch.replace_content?.length > 200 ? '...' : ''}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes spin { 100% { transform: rotate(360deg); } }
            `}} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
