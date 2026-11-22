"use client";

import React from 'react';
import Link from 'next/link';
import { 
  Globe, 
  User, 
  Coins, 
  Trophy, 
  Swords, 
  HeartHandshake, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  ShieldAlert,
  Flame,
  ShoppingBag,
  TrendingUp,
  History,
  Dices
} from 'lucide-react';

export default function GuidePortalTab() {
  return (
    <div className="space-y-8">
      {/* ページ内クイック目次 */}
      <div className="p-3 bg-surface rounded-2xl border border-border shadow-xs flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-muted px-2 py-0.5 text-[11px] flex items-center gap-1">
          📌 目次:
        </span>
        <a href="#portal-mypage" className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground font-medium transition cursor-pointer">
          👤 マイページ
        </a>
        <a href="#portal-balancer" className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground font-medium transition cursor-pointer">
          ⚖️ バランサー
        </a>
        <a href="#portal-casino" className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground font-medium transition cursor-pointer">
          🪙 ベット＆ショップ
        </a>
        <a href="#portal-synergy" className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground font-medium transition cursor-pointer">
          🤝 相性分析
        </a>
        <a href="#portal-leaderboard" className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground font-medium transition cursor-pointer">
          🏆 リーダーボード
        </a>
        <a href="#portal-mentorship" className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground font-medium transition cursor-pointer">
          🤝 先輩・後輩ハブ
        </a>
        <a href="#portal-festival" className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground font-medium transition cursor-pointer">
          🎭 お祭りピック
        </a>
        <a href="#portal-history" className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground font-medium transition cursor-pointer">
          📜 対戦履歴
        </a>
        <a href="#portal-mmr" className="px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-hover text-foreground font-medium transition cursor-pointer">
          📊 MMRの見方
        </a>
      </div>

      {/* イントロバナー */}
      <div className="bg-gradient-to-r from-secondary-500/15 via-secondary-500/10 to-secondary-500/15 border border-secondary-edge-strong/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-500/20 text-secondary-800 text-xs font-black border border-secondary-edge-strong/30">
            <Globe size={14} className="text-secondary-600" />
            ポータルWeb機能ガイド
          </div>
          <h2 className="text-xl md:text-2xl font-black text-foreground">
            ポータル（Webアプリ）の主要機能と活用法
          </h2>
          <p className="text-foreground-subtle text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
            マイページ管理からコインの勝敗予想ベット、相性分析、大会チーム分けまで、ポータルで利用できる多彩な機能をご紹介します。
          </p>
        </div>
      </div>

      {/* 機能別グリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. マイページ & 選手カルテ */}
        <div id="portal-mypage" className="bg-surface rounded-3xl p-6 border border-border shadow-xs flex flex-col justify-between hover:border-primary-edge transition-all group scroll-mt-20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-edge-soft flex items-center justify-center text-primary-600 font-bold text-2xl group-hover:scale-105 transition">
                👤
              </div>
              <span className="text-[11px] font-bold text-muted-strong bg-surface-subtle px-2.5 py-1 rounded-full">
                プレイヤー設定・戦績
              </span>
            </div>
            <h3 className="text-base font-black text-foreground">マイページ ＆ 選手カルテ</h3>
            <p className="text-muted text-xs leading-relaxed">
              希望レーンやRiot ID（サモナー名#タグ）連携、所持コイン・インベントリを管理。ロール別勝率と得意チャンピオン戦績を1画面で直感的に確認できます。
            </p>
            <div className="bg-background rounded-2xl p-3.5 border border-border/80 text-xs text-foreground-subtle space-y-1.5">
              <div className="font-bold text-foreground-soft flex items-center gap-1.5 text-[11px]">
                <Sparkles size={13} className="text-primary-600" />
                主な機能
              </div>
              <p>・希望レーン（Main/Sub/NG）・希望レーンの強さ・格上との対面の変更</p>
              <p>・🎁 <strong>デイリーログインボーナス</strong>（毎日アクセスでコインGET）</p>
              <p>・ロール勝率 ＆ 得意チャンプ戦績の統合カルテ表示</p>
              <p>・他プレイヤーへの感謝コイン送金（チップ機能）</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-subtle">
            <Link
              href="/mypage"
              className="text-xs font-black text-primary-700 hover:text-primary-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              マイページへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 2. チーム分けバランサー */}
        <div id="portal-balancer" className="bg-surface rounded-3xl p-6 border border-border shadow-xs flex flex-col justify-between hover:border-primary-edge transition-all group scroll-mt-20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-secondary-50 border border-secondary-edge-soft flex items-center justify-center text-secondary-600 font-bold text-2xl group-hover:scale-105 transition">
                ⚖️
              </div>
              <span className="text-[11px] font-bold text-secondary-800 bg-secondary-100 px-2.5 py-1 rounded-full">
                お祭り機能追加 ✨
              </span>
            </div>
            <h3 className="text-base font-black text-foreground">チーム分けバランサー</h3>
            <p className="text-muted text-xs leading-relaxed">
              MMRや希望ロールをもとに実力差を最小化する公平な5v5チーム分けを自動生成。ワンクリックで全員のOP.GG一括コピーやカスタムリンク生成が可能です。
            </p>
            <div className="bg-background rounded-2xl p-3.5 border border-border/80 text-xs text-foreground-subtle space-y-1.5">
              <div className="font-bold text-foreground-soft flex items-center gap-1.5 text-[11px]">
                <Swords size={13} className="text-secondary-600" />
                主な機能
              </div>
              <p>・🎲 <strong>お祭りロールランダム</strong>: 10人のロールをランダムにシャッフルしつつチーム間MMRを拮抗させる新機能</p>
              <p>・ワンクリックで全員の<strong>OP.GG一括コピー</strong>＆カスタムリンク生成</p>
              <p>・確定した対戦カードはポータルトップの<strong>スタジアムビュー</strong>にリアルタイム掲示</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-subtle">
            <Link
              href="/balancer"
              className="text-xs font-black text-secondary-700 hover:text-secondary-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              バランサーへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 3. カジノ・勝敗予想ベット & ショップ */}
        <div id="portal-casino" className="bg-surface rounded-3xl p-6 border border-border shadow-xs flex flex-col justify-between hover:border-primary-edge transition-all group scroll-mt-20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-edge-soft flex items-center justify-center text-primary-600 font-bold text-2xl group-hover:scale-105 transition">
                🪙
              </div>
              <span className="text-[11px] font-bold text-primary-700 bg-primary-100 px-2.5 py-1 rounded-full">
                大人気
              </span>
            </div>
            <h3 className="text-base font-black text-foreground">勝敗予想ベット ＆ KTMショップ</h3>
            <p className="text-muted text-xs leading-relaxed">
              チーム分けが出たら [BLUE] か [RED] にコインを賭けて観戦！オッズは賭け金比率でリアルタイム変動します。貯めたコインはショップで宝くじやくじ、激闘ブースターと交換可能！
            </p>
            <div className="bg-background rounded-2xl p-3.5 border border-border/80 text-xs text-foreground-subtle space-y-1.5">
              <div className="font-bold text-foreground-soft flex items-center gap-1.5 text-[11px]">
                <ShoppingBag size={13} className="text-primary-600" />
                ショップのおすすめアイテム
              </div>
              <p>・🎟️ <strong className="text-foreground-soft">週末メガ宝くじ</strong>（日曜22時抽選！ジャックポット総取り）</p>
              <p>・🥠 <strong className="text-foreground-soft">闇のスクラッチくじ</strong>（その場で即削り！最大3,000🪙当選）</p>
              <p>・💎 <strong className="text-foreground-soft">全損保険チケット</strong>（勝敗予想ハズレ時に50%キャッシュバック）</p>
              <p>・⚔️ <strong className="text-foreground-soft">勝利ボーナス激闘チケット</strong>（カスタム勝利時+600ptへ爆増）</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-subtle">
            <Link
              href="/casino"
              className="text-xs font-black text-primary-700 hover:text-primary-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              勝敗ベット・ショップへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 4. 相性分析 & デュオ勝率 */}
        <div id="portal-synergy" className="bg-surface rounded-3xl p-6 border border-border shadow-xs flex flex-col justify-between hover:border-primary-edge transition-all group scroll-mt-20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-edge-soft flex items-center justify-center text-primary-600 font-bold text-2xl group-hover:scale-105 transition">
                🤝
              </div>
              <span className="text-[11px] font-bold text-muted-strong bg-surface-subtle px-2.5 py-1 rounded-full">
                統計・データ
              </span>
            </div>
            <h3 className="text-base font-black text-foreground">チーム相性 ＆ デュオ勝率シミュレーター</h3>
            <p className="text-muted text-xs leading-relaxed">
              過去の全カスタム戦績から、誰と組んだときに最も勝率が高いか（シナジー）、逆に敵になった時の勝率（ライバル関係）をグラフィカルに分析します。
            </p>
            <div className="bg-background rounded-2xl p-3.5 border border-border/80 text-xs text-foreground-subtle space-y-1.5">
              <div className="font-bold text-foreground-soft flex items-center gap-1.5 text-[11px]">
                <HeartHandshake size={13} className="text-primary-600" />
                見どころ
              </div>
              <p>・2人を選んで共闘勝率を即座にシミュレーション</p>
              <p>・3〜5人のグループ相性ランキング</p>
              <p>・個人の「宿敵＆カモ」プレイヤー分析</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-subtle">
            <Link
              href="/leaderboard?tab=synergy"
              className="text-xs font-black text-primary-700 hover:text-primary-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              相性分析ページへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 5. リーダーボード & コイン長者番付 */}
        <div id="portal-leaderboard" className="bg-surface rounded-3xl p-6 border border-border shadow-xs flex flex-col justify-between hover:border-primary-edge transition-all group col-span-1 md:col-span-2 scroll-mt-20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-success-50 border border-success-edge-soft flex items-center justify-center text-success-600 font-bold text-2xl group-hover:scale-105 transition">
                🏆
              </div>
              <span className="text-[11px] font-bold text-success-700 bg-success-100 px-2.5 py-1 rounded-full">
                ランキング ＆ メタ統計
              </span>
            </div>
            <h3 className="text-base font-black text-foreground">リーダーボード ＆ チャンピオン・メタ統計</h3>
            <p className="text-muted text-xs leading-relaxed">
              勝率・MMRランキング、ロール別勝率、コイン長者番付に加え、サーバー内の流行チャンピオン勝率と各プレイヤーの使用実績を一覧できます。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="bg-background rounded-2xl p-3 border border-border/80 text-xs text-foreground-subtle space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <span>👑</span> 総合順位表
                </div>
                <p className="text-[11px] text-muted">
                  勝率・MMR・総試合数・連勝記録で競う公式ランキング。
                </p>
              </div>
              <div className="bg-background rounded-2xl p-3 border border-border/80 text-xs text-foreground-subtle space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <span>🪙</span> コイン長者番付
                </div>
                <p className="text-[11px] text-muted">
                  予想ベットや日々の活動で貯めたKTMコイン資産TOP一覧。
                </p>
              </div>
              <div className="bg-background rounded-2xl p-3 border border-border/80 text-xs text-foreground-subtle space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <span>🛡️</span> ロール別覇者
                </div>
                <p className="text-[11px] text-muted">
                  TOP / JG / MID / ADC / SUP 各レーンの勝率トップを抽出。
                </p>
              </div>
              <div className="bg-background rounded-2xl p-3 border border-border/80 text-xs text-foreground-subtle space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <span>📊</span> チャンプ別メタ統計
                </div>
                <p className="text-[11px] text-muted">
                  各チャンプの勝率・ピック率と使用プレイヤー一覧を切替表示。
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-subtle">
            <Link
              href="/leaderboard"
              className="text-xs font-black text-success-700 hover:text-success-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              リーダーボードへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 2026-10-16: 「月刊KTMスポーツ速報」はユーザー判断でポータルから外した（Discordの試合結果の号外欄は継続） */}

        {/* 7. 師弟マッチングハブ */}
        <div id="portal-mentorship" className="bg-surface rounded-3xl p-6 border border-border shadow-xs flex flex-col justify-between hover:border-primary-edge transition-all group col-span-1 md:col-span-2 scroll-mt-20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-edge-soft flex items-center justify-center text-primary-600 font-bold text-2xl group-hover:scale-105 transition">
                🤝
              </div>
              <span className="text-[11px] font-bold text-primary-800 bg-primary-100 px-2.5 py-1 rounded-full border border-primary-edge-soft">
                新登場 ✨
              </span>
            </div>
            <h3 className="text-base md:text-lg font-black text-foreground">
              師弟マッチングハブ（Discord内完結登録 ＆ AI仲人・先輩スカウト）
            </h3>
            <p className="text-muted text-xs leading-relaxed">
              教えたい師匠（Mentor）と学びたい弟子（Pupil）を繋ぐ公式掲示板です。Discordの <code>#🎒-教えて先輩-相談募集</code> チャンネルの常設ボタンからワンタップで即座にエントリー可能！AI相性分析（70%以上で自動推薦）、先輩スカウト、運営からのお見合い便、ワンポチ指導引き受け（+300🪙）を完備しています。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-background rounded-2xl p-3 border border-border/80 text-xs text-foreground-subtle space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <span>💬</span> Discord完結ワンポチ登録
                </div>
                <p className="text-[11px] text-muted">
                  Webログイン不要！Discordの <code>#🎒-教えて先輩-相談募集</code> から緑/青ボタンを押すだけでモーダル入力から即登録。
                </p>
              </div>
              <div className="bg-background rounded-2xl p-3 border border-border/80 text-xs text-foreground-subtle space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <span>🤖</span> AI仲人 ＆ 先輩スカウト
                </div>
                <p className="text-[11px] text-muted">
                  カードを登録すると、相性70%以上の相手を #🎒-教えて先輩-相談募集 で自動推薦。弟子に合う師匠がいない時は、AIが頼れる先輩を選んでスカウトを送ります（先輩の個別案内チャンネルにも届きます）。
                </p>
              </div>
              <div className="bg-background rounded-2xl p-3 border border-border/80 text-xs text-foreground-subtle space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <span>🤝</span> ワンポチ指導引き受け (初めて組む相手なら+300🪙)
                </div>
                <p className="text-[11px] text-muted">
                  弟子カードの「師匠を引き受ける」ボタンを押すだけで、先輩登録がなくても即座にペア成立＆専用スレッド自動開設。
                </p>
              </div>
            </div>

            <div className="p-3 bg-primary-50/70 rounded-2xl border border-primary-edge-soft/80 text-xs text-foreground-soft space-y-1 mt-3">
              <div className="font-black text-primary-950 flex items-center gap-1.5 text-[11px]">
                <span>📜</span> 師弟の心得（ポジティブ指導文化）
              </div>
              <p className="text-[11px] text-foreground-subtle leading-relaxed font-medium">
                ・<strong>師匠:</strong> ダメ出しではなく良い所を褒める／1試合の課題は1つに絞る／優しく理由を伝える<br />
                ・<strong>弟子:</strong> 感謝を伝える／分からない事は遠慮なく質問する／1つずつ意識して実践する
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-subtle flex items-center justify-between">
            <span className="text-[11px] text-muted-strong font-medium">
              カードを登録して相性の良いバディを探してみましょう！
            </span>
            <Link
              href="/mentorship"
              className="text-xs font-black text-primary-700 hover:text-primary-900 flex items-center gap-1 group-hover:translate-x-1 transition"
            >
              師弟ハブへ移動 <ArrowRight size={13} />
            </Link>
          </div>
        </div>


        {/* 📊 MMR ＆ KTMカスタムレートの説明（2026-09-23 追加） */}
        <div id="portal-mmr" className="md:col-span-2 bg-surface rounded-3xl p-5 md:p-6 border border-border shadow-xs space-y-4 scroll-mt-20">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-edge-soft flex items-center justify-center text-primary-600 font-bold text-2xl">
              📊
            </div>
            <span className="text-[11px] font-bold text-muted-strong bg-surface-subtle px-2.5 py-1 rounded-full">
              レート ＆ ランク
            </span>
          </div>
          <h3 className="text-base font-black text-foreground">MMR（KTMカスタムレート）の見方</h3>
          <p className="text-muted text-xs leading-relaxed">
            MMRは<strong>KTMカスタムの成績だけ</strong>で動く独自レートです。ソロQのランクとは別物で、
            全員1200からスタートします。<strong>レーンごとに別々</strong>に管理されるので、
            JGとTOPで違う数字を持ちます。カルテに出る「総合MMR」は、実際にプレイしたレーンの試合数で
            重み付けした平均です。
          </p>

          <div className="bg-background rounded-2xl p-4 border border-border/80 space-y-2.5">
            <div className="font-bold text-foreground-soft text-xs">🔢 勝敗でどれだけ動くか</div>
            <ul className="text-xs text-foreground-subtle space-y-1.5 list-disc list-inside leading-relaxed">
              <li><strong>勝利で +18 / 敗北で -20</strong> が基本。ここから下の補正が乗ります。</li>
              <li><strong>格差補正（最大 ±15）</strong>: 対面が自分より強いほど、勝ったときの上がり幅が大きくなります。格下に勝っても上がり幅は小さめです。</li>
              <li><strong>KDAボーナス（最大 +15）</strong>: (キル+アシスト)÷デス が 2.0 を超えた分だけ加点。サポートは +0.8 の補正付き。</li>
              <li><strong>プレースメント（×1.5）</strong>: <strong>そのレーンで5戦未満</strong>のあいだは変動が1.5倍になり、早く適正レートへ寄ります。慣れないレーンを試したときに大きく動くのはこのためです。</li>
              <li><strong>高勝率の抑制</strong>: 通算勝率が60%を超えると、上がり幅が最大8ポイント抑えられます。</li>
              <li>1試合の変動幅は <strong>勝利 +50 / 敗北 -40</strong> が上限（プレースメント中は +70 / -60）。敗北時は必ず3ポイント以上下がります。</li>
            </ul>
          </div>

          <div className="bg-background rounded-2xl p-4 border border-border/80 space-y-2.5">
            <div className="font-bold text-foreground-soft text-xs">🏅 MMRとティアの対応</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-0 sm:min-w-[320px] text-xs">
                <thead>
                  <tr className="text-left text-[11px] text-muted-strong">
                    <th className="py-1.5 pr-3 font-black">ティア</th>
                    <th className="py-1.5 font-black">必要MMR</th>
                  </tr>
                </thead>
                <tbody className="text-foreground-subtle">
                  <tr className="border-t border-border"><td className="py-1 pr-3 font-bold">CHALLENGER</td><td className="py-1 tabular-nums">2000 〜</td></tr>
                  <tr className="border-t border-border"><td className="py-1 pr-3 font-bold">GRANDMASTER</td><td className="py-1 tabular-nums">1900 〜</td></tr>
                  <tr className="border-t border-border"><td className="py-1 pr-3 font-bold">MASTER</td><td className="py-1 tabular-nums">1850 〜</td></tr>
                  <tr className="border-t border-border"><td className="py-1 pr-3 font-bold">DIAMOND IV 〜 I</td><td className="py-1 tabular-nums">1800 〜 1849</td></tr>
                  <tr className="border-t border-border"><td className="py-1 pr-3 font-bold">EMERALD IV 〜 I</td><td className="py-1 tabular-nums">1650 〜 1799</td></tr>
                  <tr className="border-t border-border"><td className="py-1 pr-3 font-bold">PLATINUM IV 〜 I</td><td className="py-1 tabular-nums">1500 〜 1649</td></tr>
                  <tr className="border-t border-border"><td className="py-1 pr-3 font-bold">GOLD IV 〜 I</td><td className="py-1 tabular-nums">1350 〜 1499</td></tr>
                  <tr className="border-t border-border"><td className="py-1 pr-3 font-bold">SILVER IV 〜 I</td><td className="py-1 tabular-nums">1200 〜 1349</td></tr>
                  <tr className="border-t border-border"><td className="py-1 pr-3 font-bold">BRONZE IV 〜 I</td><td className="py-1 tabular-nums">1050 〜 1199</td></tr>
                  <tr className="border-t border-border"><td className="py-1 pr-3 font-bold">IRON IV 〜 I</td><td className="py-1 tabular-nums">900 〜 1049</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-strong leading-relaxed">
              各ティアはさらに IV → III → II → I の4段階に分かれます（例: GOLD IV は1350、GOLD I は1460から）。
              開始時の1200は SILVER IV にあたります。
            </p>
          </div>

          <div className="bg-primary-50 rounded-2xl p-3.5 border border-primary-edge-soft text-[11px] text-primary-900 leading-relaxed space-y-1.5">
            <p>
              💡 <strong>チーム分けバランサー</strong>はこのMMRを使って両チームの戦力が釣り合うように組みます。
              レーンごとに管理しているのは「TOPは得意だがSUPは不慣れ」といった差を正しく反映するためです。
            </p>
            <p>
              🏟️ <strong>帯分けと繰り上げ参加:</strong> 定期カスタムは代表MMR 1450 を境に「上位帯」「中初級帯」の2帯に分けて編成します。上位帯が10人未満の時は、マイページの「上の実力帯への繰り上げ参加」が有効な方からMMRが近い順に補充されます。
            </p>
            <p>
              🎟️ <strong>待機優先度 (Pity):</strong> 見学枠に回った場合や希望外レーンになった場合にポイントが貯まり、次回優先して出場・希望レーンに割り当てられます。
            </p>
            <p>
              ⚔️ <strong>KDAとは:</strong> 「(キル数 + アシスト数) ÷ デス数」で表す活躍度指標です。3.0以上で好成績、5.0以上で圧巻の活躍の目安です。
            </p>
          </div>
        </div>

        {/* 8. お祭りピック ＆ 大会ドラフト */}
        <div id="portal-festival" className="bg-surface rounded-3xl p-6 border border-border shadow-xs flex flex-col justify-between hover:border-amber-500 transition-all group scroll-mt-20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold text-2xl group-hover:scale-105 transition">
                🎭
              </div>
              <span className="text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                特殊縛り ＆ 大会抽選
              </span>
            </div>
            <h3 className="text-base font-black text-foreground">お祭りピック ＆ 大会ドラフト</h3>
            <p className="text-muted text-xs leading-relaxed">
              全50種類の特殊縛りテーマ（例: ノクサス軍団、全員タンク、青髪縛り等）をワンタップで反映。Lolalytics実測統計（通常 vs オフメタ枠）に基づく公平なプール絞り込みが可能です。
            </p>
            <div className="bg-background rounded-2xl p-3.5 border border-border/80 text-xs text-foreground-subtle space-y-1.5">
              <div className="font-bold text-foreground-soft flex items-center gap-1.5 text-[11px]">
                <Dices size={13} className="text-amber-500" />
                主な機能
              </div>
              <p>・🎲 <strong>お祭り縛りテーマ抽選ルーレット</strong>（ランダムでテーマ即決定）</p>
              <p>・「このテーマのみ残す」ボタンで対象外チャンプを一発全除外</p>
              <p>・Lolalytics過去30日実測統計準拠の通常 vs オフメタ枠自動分類</p>
              <p>・トーナメント形式でのドラフト指名モーダル ＆ 画像書き出し</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-subtle">
            <Link
              href="/festival/pick"
              className="inline-flex items-center gap-1 text-xs font-black text-amber-600 hover:underline"
            >
              <span>お祭りピックを開く</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* 9. 対戦履歴 ＆ 戦績アナリティクス */}
        <div id="portal-history" className="bg-surface rounded-3xl p-6 border border-border shadow-xs flex flex-col justify-between hover:border-secondary-edge transition-all group scroll-mt-20">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-secondary-500/15 border border-secondary-edge-strong/30 flex items-center justify-center text-secondary-600 font-bold text-2xl group-hover:scale-105 transition">
                📜
              </div>
              <span className="text-[11px] font-bold text-secondary-600 bg-secondary-500/10 px-2.5 py-1 rounded-full border border-secondary-edge-strong/20">
                戦績ログ ＆ 分析
              </span>
            </div>
            <h3 className="text-base font-black text-foreground">対戦履歴 ＆ 戦績アナリティクス</h3>
            <p className="text-muted text-xs leading-relaxed">
              過去のカスタム全試合を詳細スタッツ付きで完全アーカイブ。プレイヤー名で絞り込むと、勝率やレーン別勝敗サマリーがリアルタイムで自動計算されます。
            </p>
            <div className="bg-background rounded-2xl p-3.5 border border-border/80 text-xs text-foreground-subtle space-y-1.5">
              <div className="font-bold text-foreground-soft flex items-center gap-1.5 text-[11px]">
                <History size={13} className="text-secondary-600" />
                主な機能
              </div>
              <p>・📊 <strong>プレイヤー別リアルタイム戦績サマリー</strong>（勝率・レーン内訳表示）</p>
              <p>・公式戦 vs お祭りカスタム（戦績対象外）の種別フィルター切り替え</p>
              <p>・ロール別（TOP/JG/MID/ADC/SUP）フィルター</p>
              <p>・アコーディオンによる詳細スタッツ（KDA・与ダメージバー・装備）展開</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-subtle">
            <Link
              href="/history"
              className="inline-flex items-center gap-1 text-xs font-black text-secondary-600 hover:underline"
            >
              <span>対戦履歴を開く</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
