"use client";

import React, { useState } from 'react';
import { 
  Bot, 
  Terminal, 
  Sliders, 
  Users, 
  Swords, 
  Coins, 
  FileText, 
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';

export default function GuideBotTab() {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>('recruit');

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const toggleSection = (id: string) => {
    setOpenSection(openSection === id ? '' : id);
  };

  return (
    <div className="space-y-8">
      {/* イントロバナー */}
      <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 border border-amber-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-800 text-xs font-black border border-amber-500/30">
            <Bot size={14} className="text-amber-600" />
            KTM Discord Bot マニュアル
          </div>
          <h2 className="text-xl md:text-2xl font-black text-foreground">
            Discord Bot コマンド ＆ パネル操作ガイド
          </h2>
          <p className="text-foreground-subtle text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
            募集作成からチーム分け、希望レーンの登録まで、Discord内で完結する便利なBotコマンドとボタン操作をすべて解説します。
          </p>
        </div>
      </div>

      {/* 🚀 クイックコマンド一覧 */}
      <div className="bg-surface rounded-3xl p-6 md:p-8 border border-border shadow-xs space-y-4">
        <h3 className="text-base font-black text-foreground flex items-center gap-2">
          <Terminal size={18} className="text-amber-600" />
          よく使うスラッシュコマンド一覧
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              cmd: '/recruit',
              desc: 'カスタムやノーマルの募集パネルをチャットに投下します',
              example: '/recruit mode:カスタム time:21:30 memo:初心者歓迎！',
              tag: '募集主',
            },
            {
              cmd: '/lane',
              desc: '希望レーン・NGレーン・こだわり度を設定します（初回必須）',
              example: '/lane main:JG sub:TOP ng1:SUP weight:1',
              tag: '参加者全員',
            },
            {
              cmd: '/balance',
              desc: 'ボイスチャンネルや募集参加者をもとに公平なチーム分けを生成します',
              example: '/balance',
              tag: '進行役',
            },
            {
              cmd: '/tip',
              desc: '活躍した味方や対戦相手に感謝のKTMコインをプレゼントします',
              example: '/tip user:@相手 amount:100 memo:ナイスキャリー！',
              tag: '全員',
            },
            {
              cmd: '/patch',
              desc: '最新LoLパッチのメタ激変ポイントや強いチャンプを即座に要約表示します',
              example: '/patch',
              tag: '全員',
            },
            {
              cmd: '/stats',
              desc: '自分または指定プレイヤーの直近戦績・勝率・MMRを表示します',
              example: '/stats user:@プレイヤー',
              tag: '全員',
            },
          ].map((item) => (
            <div
              key={item.cmd}
              className="p-4 rounded-2xl bg-background border border-border/90 hover:border-amber-300 transition flex flex-col justify-between gap-2"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-sm text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                    {item.cmd}
                  </span>
                  <span className="text-[10px] font-bold text-stone-500 bg-surface-hover/70 px-2 py-0.5 rounded-md">
                    {item.tag}
                  </span>
                </div>
                <p className="text-xs text-foreground-subtle font-medium">{item.desc}</p>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 text-[11px]">
                <code className="font-mono text-stone-500 truncate">{item.example}</code>
                <button
                  type="button"
                  onClick={() => copyCommand(item.cmd)}
                  className="px-2 py-1 rounded-lg bg-surface border border-border hover:bg-surface-subtle text-foreground-subtle text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                  title="コマンドをコピー"
                >
                  {copiedCmd === item.cmd ? (
                    <>
                      <Check size={11} className="text-emerald-600" /> コピー済
                    </>
                  ) : (
                    <>
                      <Copy size={11} /> コピー
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 📖 各機能の詳細アコーディオン */}
      <div className="space-y-4">
        {/* 1. /recruit 詳細 */}
        <div className="bg-surface rounded-3xl border border-border shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('recruit')}
            className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-background transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-xl">
                📢
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">
                  1. メンバー募集コマンド <code className="font-mono text-amber-700">/recruit</code> とボタン操作
                </h3>
                <p className="text-xs text-stone-500">募集パネルの作り方と、表示される各種ボタンの役割</p>
              </div>
            </div>
            {openSection === 'recruit' ? <ChevronUp size={20} className="text-stone-400" /> : <ChevronDown size={20} className="text-stone-400" />}
          </button>

          {openSection === 'recruit' && (
            <div className="p-6 pt-0 border-t border-stone-100 space-y-5">
              <div className="bg-background rounded-2xl p-4 border border-border text-xs text-foreground-subtle space-y-2">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-600" />
                  爆速AIメモ解析機能
                </div>
                <p>
                  メモ欄に <code className="bg-surface px-1.5 py-0.5 rounded font-mono font-bold text-amber-900 border border-border">21:30 カスタム 初心者歓迎！</code> のように書くだけで、AIが時間（21:30）・モード（カスタム）・人数（10人）を自動解析して即座にパネルを作成します。
                </p>
              </div>

              <div>
                <h4 className="text-xs font-black text-foreground mb-2">🔘 募集パネルのボタン一覧</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface-subtle/80 text-foreground-subtle border-b border-border">
                        <th className="p-2.5 font-bold">ボタン</th>
                        <th className="p-2.5 font-bold">押せる人</th>
                        <th className="p-2.5 font-bold">動作・効果</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-foreground-subtle">
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">✋ どこでも参加</td>
                        <td className="p-2.5">誰でも</td>
                        <td className="p-2.5">参加者リストに追加され、枠を1つ確保します。</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">🛡️ Top / ⚔️ Jg 等</td>
                        <td className="p-2.5">誰でも（ノーマル時）</td>
                        <td className="p-2.5">希望のレーン枠に直接エントリーします。</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">⏳ 待機 / 👁️ 観戦希望</td>
                        <td className="p-2.5">誰でも</td>
                        <td className="p-2.5">対戦枠には入らず、待機枠に入ります（観戦Pityが貯まります）。</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">🏃 離脱</td>
                        <td className="p-2.5">誰でも</td>
                        <td className="p-2.5">参加・待機リストから抜けます。</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">🚀 10人に拡張</td>
                        <td className="p-2.5">募集主のみ</td>
                        <td className="p-2.5">ノーマル/ARAM等の5人募集を、10人のカスタム募集に即座に拡張します。</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">👥 代理追加</td>
                        <td className="p-2.5">募集主のみ</td>
                        <td className="p-2.5">Discordメンバーを選択し、代わりに募集へ追加します。</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">📢 一括連絡</td>
                        <td className="p-2.5">募集主のみ</td>
                        <td className="p-2.5">参加者全員へ一括でメンション連絡を送信します。</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">🚩 募集終了（通知あり）</td>
                        <td className="p-2.5">募集主のみ</td>
                        <td className="p-2.5">参加者全員にメンションで締切・解散通知を送信して締め切ります。</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">🔕 募集終了（通知なし）</td>
                        <td className="p-2.5">募集主のみ</td>
                        <td className="p-2.5">メンション通知を飛ばさずに静かに募集パネルを締め切ります。</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 1.5 週末定期カスタム募集 詳細 */}
        <div className="bg-surface rounded-3xl border border-border shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('periodic')}
            className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-background transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-xl">
                ⚔️
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">
                  2. 週末定期カスタム募集（土曜本戦 ＆ 日曜お祭り）
                </h3>
                <p className="text-xs text-stone-500">毎週月曜12時に自動投稿される定期募集と参加ボタンの役割</p>
              </div>
            </div>
            {openSection === 'periodic' ? <ChevronUp size={20} className="text-stone-400" /> : <ChevronDown size={20} className="text-stone-400" />}
          </button>

          {openSection === 'periodic' && (
            <div className="p-6 pt-0 border-t border-stone-100 space-y-5">
              <div className="bg-background rounded-2xl p-4 border border-border text-xs text-foreground-subtle space-y-2">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-600" />
                  定期カスタムの開催日程 ＆ 通知スケジュール
                </div>
                <ul className="space-y-1 text-stone-600">
                  <li>・<strong className="text-foreground-soft">毎週月曜 12:00:</strong> 土日分の募集カードが自動投下されます。</li>
                  <li>・<strong className="text-foreground-soft">毎週水曜 12:00:</strong> 中間人数アナウンス（あと◯名で確定）。</li>
                  <li>・<strong className="text-foreground-soft">毎週金曜 19:00:</strong> 前日最終アナウンス（土曜開催の直前確認）。</li>
                  <li>・<strong className="text-foreground-soft">当日 20:00:</strong> 開催可否の最終判定。10名未満の部門は自動中止となり、ワンクリックで「ノーマル」「ARAM/メイヘム」の代替募集へ切り替わります。</li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-black text-foreground mb-2">🔘 柔軟な参加スタイル（フル / 1戦のみ / 途中参加）</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-1.5">
                    <div className="font-black text-xs text-teal-900 flex items-center gap-1.5">
                      <span>🟢</span> フル参加 (21:00〜)
                    </div>
                    <p className="text-[11px] text-teal-800 leading-relaxed">
                      開始から最後まで通して参加します。
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-1.5">
                    <div className="font-black text-xs text-teal-900 flex items-center gap-1.5">
                      <span>⏱️</span> 1戦のみ参加 (21:00〜1戦)
                    </div>
                    <p className="text-[11px] text-teal-800 leading-relaxed">
                      第1試合のみ参加して退出します。2戦目以降は途中参加者とスムーズに交代できます。
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                    <div className="font-black text-xs text-amber-900 flex items-center gap-1.5">
                      <span>🌙</span> 途中参加 (2戦目〜 / 21:45頃)
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      21時には間に合わない方向け！2戦目開始時にバランサー側で自動合流できます。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. /lane 詳細 */}
        <div className="bg-surface rounded-3xl border border-border shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('lane')}
            className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-background transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-xl">
                🎯
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">
                  2. レーン設定コマンド <code className="font-mono text-amber-700">/lane</code> とこだわり度
                </h3>
                <p className="text-xs text-stone-500">希望ロール・NGロール・対面格上許可の設定方法</p>
              </div>
            </div>
            {openSection === 'lane' ? <ChevronUp size={20} className="text-stone-400" /> : <ChevronDown size={20} className="text-stone-400" />}
          </button>

          {openSection === 'lane' && (
            <div className="p-6 pt-0 border-t border-stone-100 space-y-5">
              <p className="text-xs text-stone-600 leading-relaxed">
                チーム分けAIはあなたの設定した希望レーンとNGレーンを参照し、全員が納得できる配置を自動計算します。ポータルの <strong className="text-foreground font-bold">マイページ</strong> からも同一設定が可能です。
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-2">
                  <h4 className="text-xs font-black text-foreground">設定パラメータ</h4>
                  <ul className="text-xs text-stone-600 space-y-1.5">
                    <li>・<strong className="text-foreground-soft">main:</strong> メインレーン（TOP / JG / MID / ADC / SUP / ALL）</li>
                    <li>・<strong className="text-foreground-soft">sub:</strong> サブレーン（2番目に得意な位置）</li>
                    <li>・<strong className="text-foreground-soft">ng1 / ng2:</strong> NGレーン（絶対に行きたくない位置）</li>
                    <li>・<strong className="text-foreground-soft">weight:</strong> こだわり度（1〜3）</li>
                    <li>・<strong className="text-foreground-soft">allow_higher:</strong> 格上との対面を許容するか</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-background border border-border/80 space-y-2">
                  <h4 className="text-xs font-black text-foreground">こだわり度（weight）の目安</h4>
                  <ul className="text-xs text-stone-600 space-y-1.5">
                    <li>・<strong className="text-foreground-soft">1 (柔軟):</strong> チームバランス優先。他レーンでもOK</li>
                    <li>・<strong className="text-foreground-soft">2 (普通):</strong> なるべく希望レーンに行きたい（標準）</li>
                    <li>・<strong className="text-foreground-soft">3 (絶対):</strong> 何が何でも希望レーンでプレイしたい</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. /balance 詳細 */}
        <div className="bg-surface rounded-3xl border border-border shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('balance')}
            className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-background transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold text-xl">
                ⚔️
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">
                  3. チーム分けコマンド <code className="font-mono text-emerald-700">/balance</code> と3つのプリセット
                </h3>
                <p className="text-xs text-stone-500">AIが提案する3タイプのチーム分け案と投票の仕組み</p>
              </div>
            </div>
            {openSection === 'balance' ? <ChevronUp size={20} className="text-stone-400" /> : <ChevronDown size={20} className="text-stone-400" />}
          </button>

          {openSection === 'balance' && (
            <div className="p-6 pt-0 border-t border-stone-100 space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                定員に達した募集パネルから「🏆 チーム分け実行」を押すか、ボイスチャンネルに入った状態で <code className="bg-surface-subtle px-1 py-0.5 rounded font-mono font-bold text-emerald-900">/balance</code> を実行すると、AIが以下の3案を同時に提案します。
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                  <div className="font-black text-xs text-emerald-900">案A: バランス（推奨）</div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    レーン対面ごとの実力差（MMR）を最も均等にし、全体の勝率が50:50に近づく標準設定。
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-background border border-border space-y-1">
                  <div className="font-black text-xs text-foreground">案B: 戦力均等</div>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    レーン適性を無視し、チーム全体の総MMRが最も均等になるように配置。
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-background border border-border space-y-1">
                  <div className="font-black text-xs text-foreground">案C: 希望優先</div>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    参加者の希望メインレーン配置を最優先にした構成。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. 師弟募集チャンネルボタン & 先輩スカウト */}
        <div className="bg-surface rounded-3xl border border-border shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('mentorship')}
            className="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-background transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-xl">
                🤝
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">
                  4. 師弟募集チャンネルのワンポチ登録 ＆ 先輩スカウト機能
                </h3>
                <p className="text-xs text-stone-500">#🤝師弟募集 チャンネルからWebログイン不要で即エントリー</p>
              </div>
            </div>
            {openSection === 'mentorship' ? <ChevronUp size={20} className="text-stone-400" /> : <ChevronDown size={20} className="text-stone-400" />}
          </button>

          {openSection === 'mentorship' && (
            <div className="p-6 pt-0 border-t border-stone-100 space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                Discordの <code>#🤝師弟募集</code> チャンネルに常設されているピン留めメッセージから、Webポータルを開かずにワンタップでエントリーできます。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                  <div className="font-black text-xs text-emerald-900">🌱 弟子入りしたい（緑ボタン）</div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    ボタンを押すとポップアップ（モーダル）が開きます。学びたいレーンや悩みを入力するだけで即時エントリー完了！
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-1">
                  <div className="font-black text-xs text-teal-900">🥋 弟子を取りたい（青ボタン）</div>
                  <p className="text-[11px] text-teal-800 leading-relaxed">
                    指導可能レーンや得意チャンプ、活動可能時間を入力して師匠登録。AIが相性の良い弟子をマッチングします。
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1">
                  <div className="font-black text-xs text-amber-900">🌟 頼れる先輩スカウト ＆ 指導引き受け</div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    弟子エントリーがあると、適任な先輩へAIからDMでスカウト通知が届きます。「🤝 師匠を引き受ける」ボタンを押せば即時ペア結成＆ボーナス <strong>+300🪙</strong>！
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
