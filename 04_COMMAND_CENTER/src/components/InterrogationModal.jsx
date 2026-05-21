import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'

const InterrogationModal = () => {
  const [interrogation, setInterrogation] = useState(null)
  const [feedback, setFeedback] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchPending = async () => {
      const { data } = await supabase
        .from('matchup_sentinel')
        .select('*')
        .eq('matchup_id', 'INTERROGATION_PENDING')
        .maybeSingle()
      
      if (data) {
        setInterrogation(data)
      }
    }
    fetchPending()
  }, [])

  const handleSubmit = async () => {
    if (!feedback.trim()) return
    setSubmitting(true)
    
    try {
      // 1. ユーザーの入力を既存のチャンピオン辞典にマージ（本来はバックエンドのAPIを叩くのが理想だが、ここではSupabaseの別のキューに入れてバックエンドに処理させるか、直接UIからchamp_db_updaterを呼び出すことはできないため、バックエンドが拾えるようにフラグを立てる）
      const queueData = {
        matchup_id: `PROCESS_INTERROGATION_${Date.now()}`,
        champion: interrogation.champion,
        enemy: "PROCESS_INTERROGATION",
        title: "反省会フィードバック処理待ち",
        strategy: feedback,
        raw_data: {
          target_enemy: interrogation.raw_data.enemy_champ,
          feedback: feedback
        }
      }
      await supabase.from('matchup_sentinel').insert(queueData)

      // 2. 尋問の終了（PENDINGを削除）
      await supabase.from('matchup_sentinel').delete().eq('matchup_id', 'INTERROGATION_PENDING')
      
      setInterrogation(null)
    } catch (e) {
      console.error(e)
    }
    setSubmitting(false)
  }

  if (!interrogation) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          style={{
            background: '#0f111a', border: '1px solid #ef4444',
            borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(239, 68, 68, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', marginBottom: '16px' }}>
            <ShieldAlert size={32} />
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>AI鬼コーチの反省会</h2>
          </div>
          
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Match Record</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#f0f5f5' }}>
              {interrogation.champion} vs {interrogation.raw_data.enemy_champ}
            </div>
            <div style={{ fontSize: '14px', color: '#ef4444', marginTop: '4px' }}>
              Result: {interrogation.raw_data.result} | KDA: {interrogation.raw_data.kda}
            </div>
          </div>
          
          <p style={{ color: '#f0f5f5', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
            {interrogation.strategy}
          </p>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="例: 「青バフで出待ちされた」「ガンクのタイミングが悪かった」など、敗因や反省点を書いてください。自動で辞典に学習されます。"
            style={{
              width: '100%', height: '120px', background: 'rgba(0,0,0,0.5)',
              border: '1px solid #333', borderRadius: '8px', padding: '16px',
              color: '#f0f5f5', fontSize: '14px', resize: 'none', marginBottom: '24px'
            }}
          />

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                supabase.from('matchup_sentinel').delete().eq('matchup_id', 'INTERROGATION_PENDING')
                setInterrogation(null)
              }}
              style={{
                background: 'transparent', color: '#888', border: 'none',
                padding: '12px 24px', cursor: 'pointer', fontWeight: 600
              }}
            >
              スキップ
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !feedback.trim()}
              style={{
                background: '#ef4444', color: '#fff', border: 'none',
                padding: '12px 24px', borderRadius: '8px', fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                opacity: (submitting || !feedback.trim()) ? 0.5 : 1
              }}
            >
              {submitting ? '学習中...' : '反省を保存して学習'} <Send size={16} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default InterrogationModal
