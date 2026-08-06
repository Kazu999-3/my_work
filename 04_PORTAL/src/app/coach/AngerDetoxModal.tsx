'use client';

import { useState } from 'react';

interface AngerDetoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (focusText: string) => void;
}

export default function AngerDetoxModal({ isOpen, onClose, onComplete }: AngerDetoxModalProps) {
  const [step, setStep] = useState<'vent' | 'shredding' | 'reframe'>('vent');
  const [ventText, setVentText] = useState('');
  const [focusText, setFocusText] = useState('');

  if (!isOpen) return null;

  const handleShred = () => {
    if (!ventText.trim()) return;
    setStep('shredding');
    // シュレッダーアニメーション（1.2秒後に消去してステップ移行）
    setTimeout(() => {
      setVentText('');
      setStep('reframe');
    }, 1200);
  };

  const handleFinish = () => {
    onComplete(focusText);
    // 状態リセット
    setStep('vent');
    setFocusText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-stone-50 border border-orange-200 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden my-6">
        {/* ヘッダー */}
        <div className="bg-orange-950 text-orange-100 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <h2 className="text-base font-bold">アンガーデトックス（味方へのイライラ吐き出し）</h2>
          </div>
          <button
            onClick={onClose}
            className="text-orange-300 hover:text-white text-xl font-bold px-2 py-0.5 rounded hover:bg-orange-900 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm text-stone-800">
          {step === 'vent' && (
            <>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-900">
                💡 <strong>味方への怒り・不満をすべて吐き出してください</strong>
                <p className="mt-1 text-stone-600">
                  入力した文章はサーバー等へ一切送信・保存されず、次のステップで即座にシュレッダー破棄されます。頭の中のモヤモヤを文字に書き出しましょう。
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  味方のどんなプレイ・言動にイライラしましたか？
                </label>
                <textarea
                  className="w-full h-32 p-3 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-stone-800 placeholder-stone-400"
                  placeholder="例: jgが全く寄ってくれずレーンが崩壊した / 味方が暴言を吐いてきて集中が切れた..."
                  value={ventText}
                  onChange={(e) => setVentText(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-stone-300 rounded-md text-stone-600 hover:bg-stone-100 text-xs font-medium"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleShred}
                  disabled={!ventText.trim()}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-md text-xs font-bold shadow transition-all flex items-center gap-1.5"
                >
                  <span>🗑️</span>
                  <span>不満をシュレッダーにかけて消去する</span>
                </button>
              </div>
            </>
          )}

          {step === 'shredding' && (
            <div className="py-12 text-center space-y-3">
              <div className="text-4xl animate-bounce">📄 ➔ ✂️ ➔ 🗑️</div>
              <p className="text-base font-bold text-orange-700 animate-pulse">
                味方への不満を完全に破棄・クリア中...
              </p>
              <p className="text-xs text-stone-500">脳内の感情を文字とともに手放しています</p>
            </div>
          )}

          {step === 'reframe' && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900">
                ✨ <strong>すっきりしましたか？自分のコントロール範囲に集中しましょう</strong>
                <p className="mt-1 text-stone-600">
                  他人のプレイやマッチングの当たり運は自分では操作できません。次の試合で<strong>「自分だけが意識・改善できること」</strong>を1つだけ決定します。
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  次の試合で自分が意識する1つのフォーカス（自責改善目標）
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-800 placeholder-stone-400"
                  placeholder="例: 相手のコールに応じず自分のCSとウエーブ管理だけに集中する / ミニマップを5秒おきに見る"
                  value={focusText}
                  onChange={(e) => setFocusText(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleFinish}
                  disabled={!focusText.trim()}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-md text-xs font-bold shadow transition-all flex items-center gap-1.5"
                >
                  <span>🛡️</span>
                  <span>冷静に次の目標を設定して完了</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
