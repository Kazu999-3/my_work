"use client";

import { CheckCircle2, ShoppingBag } from 'lucide-react';
import { SHOP_ITEM_LIST } from '../../../lib/shopItems';

// タブ5: KTMショップ
// 2026-10-07: app/casino/page.tsx（1,635行）から分割。表示内容・動作は分割前と同じ。
export default function ShopTab({ shopMessage, handleBuyItem }: {
  shopMessage: string | null;
  handleBuyItem: (itemId: string, itemName: string, price: number, quantity?: number) => void;
}) {
  return (
    <>
          <div className="bg-surface rounded-3xl p-6 md:p-8 border border-black/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">KTMショップ ＆ 特権アイテム交換所</h2>
                  <p className="text-xs text-muted-strong">貯めたコインでカスタム特権チケットやバラエティ権をGET！</p>
                </div>
              </div>
            </div>

            {shopMessage && (
              <div className="p-4 rounded-2xl bg-primary-50 border border-primary-edge-soft text-primary-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-primary-600" />
                {shopMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SHOP_ITEM_LIST.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-3xl bg-background border-2 border-border/80 hover:border-primary-edge transition-all flex flex-col justify-between space-y-4 group shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl">{item.icon}</span>
                      <span className="px-2.5 py-1 rounded-full bg-primary-100 text-primary-900 text-[10px] font-black">
                        {item.badge}
                      </span>
                    </div>
                    <h3 className="font-black text-foreground text-sm group-hover:text-primary-700 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-muted-strong leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-border">
                    <span className="text-sm font-black text-primary-600 font-mono">
                      🪙 {item.price.toLocaleString()} {item.id === 'lottery_ticket' ? '/ 1口' : ''}
                    </span>
                    {item.id === 'lottery_ticket' ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleBuyItem(item.id, item.name, item.price, 1)}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-primary-600 text-white text-[11px] font-black transition-colors cursor-pointer shadow-xs"
                          title="1口購入"
                        >
                          1口
                        </button>
                        <button
                          onClick={() => handleBuyItem(item.id, item.name, item.price, 5)}
                          className="px-2.5 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-stone-950 text-[11px] font-black transition-colors cursor-pointer shadow-xs"
                          title="5口まとめ買い (500コイン)"
                        >
                          5口
                        </button>
                        <button
                          onClick={() => handleBuyItem(item.id, item.name, item.price, 10)}
                          className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-primary-600 to-primary-600 hover:from-primary-500 hover:to-primary-500 text-white text-[11px] font-black transition-colors cursor-pointer shadow-xs"
                          title="10口まとめ買い (1,000コイン)"
                        >
                          10口
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleBuyItem(item.id, item.name, item.price, 1)}
                        className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-primary-600 text-white text-xs font-black transition-colors cursor-pointer shadow-sm"
                      >
                        交換する
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
    </>
  );
}
