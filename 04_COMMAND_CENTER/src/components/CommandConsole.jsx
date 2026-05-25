import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Send, Cpu, X, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function CommandConsole() {
  const [isOpen, setIsOpen] = useState(false)
  const [request, setRequest] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState(null)

  const handleSubmit = async () => {
    if (!request.trim()) return
    setSubmitting(true)
    setStatus(null)

    try {
      const queueData = {
        matchup_id: `SKILL_SYNTH_${Date.now()}`,
        champion: "SYSTEM",
        enemy: "SKILL_SYNTHESIZER",
        title: "新機能（スキル）開発要求",
        strategy: request,
        raw_data: {
          request_text: request,
          status: "pending"
        }
      }
      
      const { error } = await supabase.from('matchup_sentinel').insert(queueData)
      if (error) throw error

      setStatus('success')
      setRequest('')
      setTimeout(() => {
        setIsOpen(false)
        setStatus(null)
      }, 2000)
    } catch (e) {
      console.error(e)
      setStatus('error')
    }
    setSubmitting(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          border: 'none',
          borderRadius: '50%',
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.4)',
          zIndex: 90,
          color: 'white',
          transition: 'all 0.3s'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Terminal size={28} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
              zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#0a0b10',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '24px',
                width: '90%',
                maxWidth: '600px',
                padding: '32px',
                boxShadow: '0 24px 48px rgba(168, 85, 247, 0.2)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* 装飾背景 */}
              <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.1) 0%, transparent 50%)', pointerEvents: 'none' }} />

              <button
                onClick={() => setIsOpen(false)}
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', color: '#a855f7' }}>
                <Cpu size={32} />
                <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>Skill Synthesizer</h2>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px', fontSize: '15px' }}>
                AIに新機能（スキル）の開発を直接依頼します。要求を送信すると、システムが自動でPythonモジュールを設計し、システムに組み込みます。
              </p>

              {status === 'success' ? (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '24px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <Sparkles size={48} style={{ margin: '0 auto 16px auto' }} />
                  <h3 style={{ margin: '0 0 8px 0' }}>リクエストを受理しました！</h3>
                  <p style={{ margin: 0, opacity: 0.8 }}>バックエンドで開発を開始します。</p>
                </div>
              ) : (
                <>
                  <textarea
                    value={request}
                    onChange={e => setRequest(e.target.value)}
                    placeholder="例: 「最新のパッチノートを公式サイトから取得して要約する機能を作って」「Discordに今日の収益を通知するモジュールが欲しい」"
                    style={{
                      width: '100%',
                      height: '160px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      padding: '16px',
                      color: '#fff',
                      fontSize: '15px',
                      resize: 'none',
                      marginBottom: '24px',
                      fontFamily: 'inherit'
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !request.trim()}
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        border: 'none',
                        color: '#fff',
                        padding: '12px 28px',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: (submitting || !request.trim()) ? 0.5 : 1,
                        transition: 'all 0.2s'
                      }}
                    >
                      {submitting ? '設計中...' : 'システム開発を開始'} <Send size={18} />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
