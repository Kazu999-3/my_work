"use client";


// コインの貯め方ガイド
// 2026-10-07: app/casino/page.tsx（1,635行）から分割。表示内容・動作は分割前と同じ。
export default function CoinGuide() {
  return (
    <>
        <div className="bg-surface/95 text-foreground-soft rounded-3xl p-6 md:p-8 border border-border shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-surface-subtle pb-4">
            <div className="w-10 h-10 rounded-2xl bg-primary-100 text-primary-700 border border-primary-edge flex items-center justify-center text-xl font-bold">
              🪙
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-foreground">コインを自動で貯める 5つの方法</h3>
              <p className="text-xs text-muted-strong">試合に出る人も、観戦する人も全員がコインを獲得できます！</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-background border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-primary-700">① 初回ログイン</span>
                <span className="text-xs font-mono font-black text-success-600">+1,000 pt</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Discordで初めてログインすると、全員に初期所持金として自動付与！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-background border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-primary-700">② 試合に参加</span>
                <span className="text-xs font-mono font-black text-success-600">+100 pt</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                カスタム試合に参加するだけで、勝敗に関係なく全員に参加賞を付与！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-background border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-primary-700">③ 試合に勝利</span>
                <span className="text-xs font-mono font-black text-success-600">+150 pt (計250)</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                試合に勝利したチームのメンバー全員に勝利ボーナスを追加付与！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-background border border-border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-primary-700">④ 募集を主催</span>
                <span className="text-xs font-mono font-black text-success-600">+200 pt</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Discordで `/recruit` を打って募集を立てた主催者に感謝ボーナス！
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-background border border-border space-y-1.5 sm:col-span-2 lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-primary-700">⑤ 勝敗予想が的中</span>
                <span className="text-xs font-mono font-black text-primary-600">賭け金 × 2倍 配当</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                カスタムの勝利チームを予想して的中すると、賭けたコインがザクザク倍増して戻ってきます！
              </p>
            </div>
          </div>
        </div>
    </>
  );
}
