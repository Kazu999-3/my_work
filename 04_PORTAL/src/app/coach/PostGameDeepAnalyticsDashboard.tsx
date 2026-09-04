'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Clock, ShoppingBag, Eye, ShieldAlert, Sparkles, Award, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

interface PostGameData {
  success: boolean;
  my_champion: string;
  enemy_champion: string;
  match_duration_str: string;
  kda_str: string;
  early_game_metrics: {
    cs_timeline: { minute: number; cs: number; benchmark: number }[];
    cs_at_15: number;
    cs_per_min_at_15: number;
    trade_ratio: number;
    gold_diff_at_15: number;
    lane_result: string;
  };
  recall_efficiency: {
    events: {
      time_str: string;
      gold_at_recall: number;
      bought_items: string[];
      wave_state: string;
      loss_cs: number;
      loss_gold: number;
      evaluation: string;
      detail: string;
    }[];
    total_loss_gold: number;
    rating: string;
  };
  build_audit: {
    score: number;
    grade: string;
    summary: string;
    items_audited: {
      item_name: string;
      timing: string;
      audit: string;
      reason: string;
    }[];
  };
  timing_scaling: {
    phase: string;
    win_rate: number;
    impact: string;
    status: string;
  }[];
  radar_metrics: {
    subject: string;
    my_score: number;
    target_score: number;
    diff: string;
    status: string;
  }[];
  biggest_bottleneck: {
    metric: string;
    advice: string;
  };
}

export default function PostGameDeepAnalyticsDashboard() {
  const [data, setData] = useState<PostGameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    fetch('/api/lol/postgame-deep-analytics')
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSyncFeedback = async () => {
    if (!data || syncing || synced) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/lol/sync-match-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myChampion: data.my_champion,
          enemyChampion: data.enemy_champion,
          keyLearning: `${data.biggest_bottleneck.metric}: ${data.biggest_bottleneck.advice}`,
          bottleneck: data.biggest_bottleneck.metric
        })
      });
      const d = await res.json();
      if (d.success) {
        setSynced(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs animate-pulse">
        <div className="h-5 bg-stone-200 rounded w-1/4 mb-3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-36 bg-stone-100 rounded-xl"></div>
          <div className="h-36 bg-stone-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 md:p-6 shadow-xs text-stone-900 space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[10px] font-black uppercase tracking-wider">
            Deep Analytics v3.0
          </span>
          <h3 className="text-base font-black text-stone-900 flex items-center gap-1.5">
            <span>⚡ 試合後クイックデトックス ＆ 5大ディープアナリティクス</span>
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-500">
          <span className="bg-stone-100 px-2 py-0.5 rounded border border-stone-200 text-stone-700">対戦: {data.my_champion} vs {data.enemy_champion}</span>
          <span>•</span>
          <span>KDA: {data.kda_str}</span>
          <span>•</span>
          <span>時間: {data.match_duration_str}</span>
        </div>
      </div>

      {/* 🚨 1-Action Takeaway (次戦への最重要改善アクション・最優先ファーストビュー) */}
      <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border-2 border-rose-400/80 rounded-xl p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <span className="text-xs font-black text-rose-950 uppercase tracking-wide">
              【次戦への絶対約束】1分で脳に刻む最重要改善アクション
            </span>
          </div>
          <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded font-mono">
            ボトルネック: {data.biggest_bottleneck.metric}
          </span>
        </div>
        <p className="text-xs md:text-sm font-black text-stone-900 leading-relaxed bg-white/95 p-3 rounded-lg border border-rose-200">
          {data.biggest_bottleneck.advice}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 案1: 序盤15分メトリクス */}
        <div className="bg-stone-50/70 border border-stone-200 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-600" />
              1. 序盤15分メトリクス精密分析
            </span>
            <span className="text-[11px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
              {data.early_game_metrics.lane_result}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2.5 rounded-lg border border-stone-200">
              <div className="text-[10px] font-bold text-stone-400">15分CS数</div>
              <div className="text-base font-black text-stone-900 font-mono">{data.early_game_metrics.cs_at_15}</div>
              <div className="text-[9px] text-emerald-600 font-bold">目標達成率 98%</div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-stone-200">
              <div className="text-[10px] font-bold text-stone-400">トレード効率</div>
              <div className="text-base font-black text-emerald-700 font-mono">{data.early_game_metrics.trade_ratio}倍</div>
              <div className="text-[9px] text-stone-500">与ダメ &gt; 被ダメ</div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-stone-200">
              <div className="text-[10px] font-bold text-stone-400">15分差分</div>
              <div className="text-base font-black text-amber-700 font-mono">+{data.early_game_metrics.gold_diff_at_15}G</div>
              <div className="text-[9px] text-amber-600 font-bold">リード確立</div>
            </div>
          </div>
        </div>

        {/* 案6: アイテムビルド選択の分岐監査 (Build Audit) */}
        <div className="bg-stone-50/70 border border-stone-200 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-sky-600" />
              2. ビルド選択の分岐監査 (Build Audit)
            </span>
            <span className="text-[11px] font-black text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200 font-mono">
              スコア: {data.build_audit.score}点 ({data.build_audit.grade}ランク)
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            {data.build_audit.items_audited.map((item, idx) => (
              <div key={idx} className="bg-white p-2 rounded-lg border border-stone-200 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-extrabold text-stone-800">{item.item_name}</span>
                  <span className="text-[10px] text-stone-400 ml-1.5 font-mono">({item.timing})</span>
                  <p className="text-[10px] text-stone-600 truncate mt-0.5">{item.reason}</p>
                </div>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded shrink-0">
                  {item.audit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 案E: リコール＆ウェーブ テンポロス逆再生 */}
        <div className="bg-stone-50/70 border border-stone-200 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-600" />
              3. リコール＆ウェーブ テンポロス逆再生
            </span>
            <span className="text-[10px] font-bold text-stone-500 font-mono">
              ロス: {data.recall_efficiency.total_loss_gold}Gのみ
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            {data.recall_efficiency.events.map((ev, idx) => (
              <div key={idx} className="bg-white p-2 rounded-lg border border-stone-200 space-y-1">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded">{ev.time_str} リコール</span>
                  <span className="font-bold text-stone-700">{ev.evaluation}</span>
                </div>
                <p className="text-[10px] text-stone-600">{ev.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 案4 ＆ 案9: スケーリング ＆ 目標ランクギャップ */}
        <div className="bg-stone-50/70 border border-stone-200 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-stone-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-600" />
              4. 目標ランク（ダイヤ帯）との多角形ギャップ
            </span>
            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              ダイヤ基準照合
            </span>
          </div>

          {/* レーダーメトリクスグリッド */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            {data.radar_metrics.map((m, idx) => (
              <div key={idx} className="bg-white p-2 rounded-lg border border-stone-200 flex items-center justify-between">
                <span className="font-bold text-stone-700">{m.subject}</span>
                <span className={`font-mono font-bold text-[10px] ${m.diff.startsWith('+') ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {m.diff}pt ({m.status})
                </span>
              </div>
            ))}
          </div>

          {/* 昇格ボトルネックアドバイス */}
          <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-3 text-[11px] space-y-1">
            <div className="flex items-center gap-1.5 font-black text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>ダイヤ昇格への唯一のボトルネック: {data.biggest_bottleneck.metric}</span>
            </div>
            <p className="text-stone-700 text-[10px] leading-relaxed">
              {data.biggest_bottleneck.advice}
            </p>
          </div>
        </div>
      </div>

      {/* 完全勝利サイクル: ナレッジ自動フィードバック同期バー */}
      <div className="bg-gradient-to-r from-amber-50 via-purple-50 to-emerald-50 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="space-y-0.5 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-black text-stone-900">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>完全勝利サイクル (The Sovereign Victory Loop) 連動</span>
          </div>
          <p className="text-[11px] text-stone-600 font-medium">
            この試合で得た確定データ（対面攻略 ＆ 視界改善点）をチャンピオン辞典へ自動蓄積し、次回プレイ前へ循環させます。
          </p>
        </div>
        <button
          onClick={handleSyncFeedback}
          disabled={syncing || synced}
          className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer ${
            synced
              ? 'bg-emerald-600 text-white border border-emerald-500'
              : syncing
              ? 'bg-stone-700 text-stone-300 animate-pulse'
              : 'bg-stone-900 hover:bg-stone-800 text-white'
          }`}
        >
          <CheckCircle2 className={`w-4 h-4 ${synced ? 'text-white' : 'text-emerald-400'}`} />
          <span>{synced ? '✅ ナレッジ辞典に自動同期完了！' : syncing ? '同期中...' : '教訓をナレッジ辞典に自動同期'}</span>
        </button>
      </div>
    </div>
  );
}
