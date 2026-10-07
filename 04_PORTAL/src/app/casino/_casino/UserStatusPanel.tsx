"use client";

import { Flame, Gift, LogIn } from 'lucide-react';

// ログイン状態（残高・おみくじ・破産救済・チップ・連勝・所持チケット）／未ログイン時の案内
// 2026-10-07: app/casino/page.tsx（1,635行）から分割。表示内容・動作は分割前と同じ。
export default function UserStatusPanel({ user, lastRescueMonth, userStreak, userMaxStreak, inventory, handleClaimBonus, setTipToPlayer, setIsTipModalOpen, logout, handleAnnounceTicket, loginWithDiscord }: {
  user: any;
  lastRescueMonth: string | null;
  userStreak: number;
  userMaxStreak: number;
  inventory: Array<{ id: string; name: string; icon: string; boughtAt: string }>;
  handleClaimBonus: (type: 'daily' | 'rescue') => void;
  setTipToPlayer: (v: string) => void;
  setIsTipModalOpen: (v: boolean) => void;
  logout: () => void;
  handleAnnounceTicket: (item: any) => void;
  loginWithDiscord: (redirect?: string) => void;
}) {
  return (
    <>
        {user ? (
          <div className="p-5 rounded-3xl bg-primary-500/10 border-2 border-primary-edge-strong/30 space-y-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={user.avatar}
                  alt={user.displayName}
                  className="w-12 h-12 rounded-2xl border-2 border-primary-edge-strong shadow-sm"
                />
                <div>
                  <div className="text-sm font-black text-foreground flex items-center gap-2">
                    {user.displayName}
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary-200 text-primary-900 font-bold border border-primary-edge">
                      {user.rank}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-primary-800 flex items-center gap-1.5 mt-0.5">
                    <span>🪙 あなたの残高:</span>
                    <strong className="font-mono text-base text-primary-600">{user.coins != null ? user.coins.toLocaleString() : '—'}</strong>
                    <span>コイン</span>
                  </div>
                </div>
              </div>

              {/* ボーナス獲得アクション群 */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleClaimBonus('daily')}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-500 hover:from-primary-600 hover:to-primary-600 text-stone-950 font-black text-xs shadow transition flex items-center gap-1.5 cursor-pointer transform active:scale-95"
                  title="1日1回おみくじを引いてボーナスを獲得します（最大+300pt）"
                >
                  <span className="text-sm">🎰</span>
                  <span>デイリーおみくじ (最大+300pt)</span>
                </button>

                {/* 残高が取れていない時は出さない */}
                {user.coins != null && user.coins < 100 && (
                  (() => {
                    const currentMonthStr = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit' }).format(new Date()).replace(/\//g, '-');
                    const isRescueClaimedThisMonth = lastRescueMonth === currentMonthStr;
                    return isRescueClaimedThisMonth ? (
                      <div className="px-3 py-1.5 rounded-xl bg-surface-hover text-muted-strong font-bold text-xs flex items-center gap-1.5 cursor-not-allowed" title="破産救済保険は月1回までです（今月分は受取済み）">
                        <span className="text-sm">🔒</span>
                        <span>破産救済 (今月受取済)</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleClaimBonus('rescue')}
                        className="px-3 py-1.5 rounded-xl bg-danger-500 hover:bg-danger-600 text-white font-black text-xs shadow transition flex items-center gap-1.5 cursor-pointer animate-bounce"
                        title="所持コインが100枚未満のときの救済措置（※月1回限定）"
                      >
                        <span className="text-sm">💸</span>
                        <span>破産救済保険 (+300pt / 月1回)</span>
                      </button>
                    );
                  })()
                )}

                <button
                  type="button"
                  onClick={() => {
                    setTipToPlayer('');
                    setIsTipModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-black text-xs shadow transition flex items-center gap-1.5 cursor-pointer"
                  title="フレンドや活躍したプレイヤーにコインをチップとして贈ります"
                >
                  <Gift size={14} />
                  <span>チップを贈る</span>
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-foreground-subtle hover:text-stone-950 font-black px-3 py-1.5 rounded-xl bg-surface/90 hover:bg-surface border border-primary-edge shadow-2xs transition"
                >
                  ログアウト
                </button>
              </div>
            </div>

            {/* 🔥 勝敗予想 連勝ストリークバナー */}
            <div className="pt-3 border-t border-primary-edge-strong/20 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-black ${
                  userStreak >= 5
                    ? 'bg-gradient-to-r from-danger-500 to-primary-500 text-white animate-pulse shadow-md'
                    : userStreak >= 3
                      ? 'bg-danger-500/20 text-danger-600 dark:text-danger-400 border border-danger-edge-strong/40'
                      : userStreak >= 1
                        ? 'bg-primary-500/20 text-primary-700 dark:text-primary-300 border border-primary-edge-strong/40'
                        : 'bg-surface-hover/60 dark:bg-background text-muted-strong'
                }`}>
                  <Flame size={14} className={userStreak > 0 ? 'text-primary-400 animate-bounce' : ''} />
                  <span>{userStreak > 0 ? `🔥 予想 ${userStreak} 連勝中！` : '連勝ストリーク: 0戦'}</span>
                </div>

                {userStreak > 0 && (
                  <span className="text-[11px] font-bold text-primary-800 dark:text-primary-300">
                    次回的中: <strong>{userStreak >= 4 ? '+20%' : userStreak >= 2 ? '+10%' : '+5%'}</strong> 配当ボーナス！
                  </span>
                )}
              </div>

              <div className="text-[11px] font-bold text-muted-strong flex items-center gap-1.5">
                <span>👑 自己ベスト:</span>
                <strong className="text-primary-600 dark:text-primary-400">{userMaxStreak}連勝</strong>
                <span className="text-[10px] text-faint font-normal">（2連勝:+5% / 3連勝:+10% / 5連勝:+20%）</span>
              </div>
            </div>

            {/* 🎒 所持特権チケット（インベントリ） ＆ 発動宣言ボタン */}
            <div className="pt-3 border-t border-primary-edge-strong/20">
              <div className="flex items-center gap-2 text-xs font-bold text-primary-950 mb-2">
                <span>🎒 あなたの所持特権チケット:</span>
                <span className="text-[11px] font-normal text-muted">({inventory.length}枚保有中)</span>
              </div>
              {inventory.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {inventory.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-surface border border-primary-edge text-foreground text-xs font-bold flex flex-col justify-between gap-2 shadow-sm"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{item.icon}</span>
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.id === 'lottery_ticket' ? (
                        <div className="w-full py-1.5 px-2 rounded-xl bg-primary-500/10 border border-primary-edge-strong/30 text-primary-900 font-bold text-[11px] flex items-center justify-center gap-1">
                          <span>⏳</span>
                          <span>日曜22:00 自動抽選エントリー中</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAnnounceTicket(item)}
                          className="w-full py-1.5 px-2 rounded-xl bg-danger-500 hover:bg-danger-600 text-white font-black text-[11px] transition shadow flex items-center justify-center gap-1 cursor-pointer"
                          title="次回のカスタム試合でこの特権を発動することをDiscordに宣言します"
                        >
                          <span>📣</span>
                          <span>Discordで発動宣言する</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-strong italic">
                  現在保有している特権チケットはありません。「🛒 KTMショップ」からお好みの特権を交換できます！
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-3xl bg-gradient-to-br from-primary-950 via-stone-900 to-primary-950 border border-primary-edge-strong/30 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl text-center md:text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/40 flex items-center justify-center text-2xl shrink-0">
                🎮
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  Discordアカウントで1秒ログイン
                </h3>
                <p className="text-xs text-faint mt-0.5">
                  ログインすると、毎日のボーナス受取やワンタップ勝敗ベット、特権アイテム発動が楽しめます！
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loginWithDiscord('/casino')}
              className="w-full md:w-auto py-2.5 px-6 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <LogIn size={16} />
              Discordでログイン
            </button>
          </div>
        )}
    </>
  );
}
