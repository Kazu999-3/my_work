"use client";

import { Gift, Send, MessageSquare } from 'lucide-react';

// チップ送金モーダル
// 2026-10-07: app/casino/page.tsx（1,635行）から分割。表示内容・動作は分割前と同じ。
export default function TipModal({ user, setTipToPlayer, setIsTipModalOpen, activePlayerName, tipToPlayer, tipAmount, setTipAmount, tipMessage, setTipMessage, isTipSubmitting, allPlayersList, handleSendTip }: {
  user: any;
  setTipToPlayer: (v: string) => void;
  setIsTipModalOpen: (v: boolean) => void;
  activePlayerName: string;
  tipToPlayer: string;
  tipAmount: number;
  setTipAmount: (n: number) => void;
  tipMessage: string;
  setTipMessage: (v: string) => void;
  isTipSubmitting: boolean;
  allPlayersList: Array<{ name: string; rank: string }>;
  handleSendTip: (e: React.FormEvent) => void;
}) {
  return (
    <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-border space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-primary-50 text-primary-600 border border-primary-edge-soft flex items-center justify-center font-bold">
                  <Gift size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">コインをチップとして贈る</h3>
                  <p className="text-[11px] text-muted-strong">ナイスプレイや日頃の感謝を込めてコインをプレゼント！</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTipModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-subtle hover:bg-surface-hover text-muted-strong flex items-center justify-center text-sm font-black transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendTip} className="space-y-4">
              {/* 相手選択 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-foreground-subtle">
                  🎁 送信先プレイヤー
                </label>
                <div className="flex gap-2">
                  <select
                    value={tipToPlayer}
                    onChange={(e) => setTipToPlayer(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground-soft focus:outline-none focus:border-primary-edge-strong"
                  >
                    <option value="">-- プレイヤー一覧から選択 --</option>
                    {allPlayersList
                      .filter((p) => p.name !== activePlayerName)
                      .map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} ({p.rank})
                        </option>
                      ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="または直接名前を入力..."
                  value={tipToPlayer}
                  onChange={(e) => setTipToPlayer(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground-soft focus:outline-none focus:border-primary-edge-strong"
                />
              </div>

              {/* 金額選択 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-foreground-subtle">
                    🪙 チップ金額 (コイン)
                  </label>
                  <span className="text-[10px] text-muted-strong font-bold">
                    所持: {(user?.coins ?? 1000).toLocaleString()}pt
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[50, 100, 300, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTipAmount(amt)}
                      className={`py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                        tipAmount === amt
                          ? 'bg-primary-600 text-white border-primary-edge-strong shadow-xs'
                          : 'bg-background hover:bg-primary-50 text-foreground-subtle border-border'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max={user?.coins ?? 1000}
                  value={tipAmount}
                  onChange={(e) => setTipAmount(Number(e.target.value))}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm font-black text-foreground focus:outline-none focus:border-primary-edge-strong font-mono"
                />
              </div>

              {/* メッセージ */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-foreground-subtle flex items-center gap-1">
                  <MessageSquare size={13} />
                  <span>応援メッセージ（任意 / Discordに公開通知）</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="ナイスキャリーでした！ / いつもカスタムありがとう！"
                  value={tipMessage}
                  onChange={(e) => setTipMessage(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground-soft focus:outline-none focus:border-primary-edge-strong"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsTipModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-surface-subtle hover:bg-surface-hover text-foreground-subtle font-black text-xs transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isTipSubmitting || !tipToPlayer.trim() || tipAmount <= 0}
                  className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>{isTipSubmitting ? '送信中...' : `🪙 ${tipAmount}コインを贈る`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
    </>
  );
}
