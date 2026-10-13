"use client";

import React, { useState, memo } from "react";

const DEFAULT_VC_PRESETS = [
  '🔊 カスタム【1戦目進行中・途中交代歓迎】',
  '🔊 カスタム【2戦目進行中・途中交代歓迎】',
  '🔊 カスタム【3戦目進行中・最終決戦】',
  '🔊 🎮カスタムVC',
];

export async function updateVcStatus(statusOrName: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/discord/vc-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusOrName, name: statusOrName })
    });
    const data = await res.json();
    if (res.ok && (data.success || !data.error)) {
      return { success: true, message: data.message || `Discord VC名を「${statusOrName}」に更新しました！` };
    } else {
      return { success: false, error: data.error || 'VCステータスの更新に失敗しました' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || '通信エラーが発生しました' };
  }
}

interface BalancerVcManagerProps {
  onMessage?: (msg: { type: string; text: string }) => void;
}

export const BalancerVcManager = memo(function BalancerVcManager({ onMessage }: BalancerVcManagerProps) {
  const [vcPresets, setVcPresets] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ktm_vc_custom_presets');
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return DEFAULT_VC_PRESETS;
  });

  const [newPresetText, setNewPresetText] = useState('');
  const [updatingVc, setUpdatingVc] = useState(false);

  // プリセット追加
  const handleAddVcPreset = () => {
    const text = newPresetText.trim();
    if (!text) return;
    if (vcPresets.includes(text)) {
      alert('同じチャンネル名が既に登録されています');
      return;
    }
    const next = [...vcPresets, text];
    setVcPresets(next);
    localStorage.setItem('ktm_vc_custom_presets', JSON.stringify(next));
    setNewPresetText('');
  };

  // プリセット削除
  const handleDeleteVcPreset = (target: string) => {
    if (vcPresets.length <= 1) {
      alert('最低1つのプリセットが必要です');
      return;
    }
    const next = vcPresets.filter(p => p !== target);
    setVcPresets(next);
    localStorage.setItem('ktm_vc_custom_presets', JSON.stringify(next));
  };

  // VCステータス更新
  const handleUpdate = async (statusOrName: string) => {
    setUpdatingVc(true);
    const res = await updateVcStatus(statusOrName);
    if (res.success) {
      if (onMessage) onMessage({ type: 'success', text: `🔊 ${res.message}` });
    } else {
      alert(`VC更新エラー: ${res.error}`);
    }
    setUpdatingVc(false);
  };


  return (
    <div className="p-3 rounded-2xl bg-surface border border-border flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
      <div className="flex items-center gap-2">
        <span className="text-base">🔊</span>
        <div>
          <h4 className="text-xs font-bold text-foreground">VCステータス</h4>
          <p className="text-[10px] text-muted">DiscordのVC横に吹き出しで進行状況を表示</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => handleUpdate('game1')}
          disabled={updatingVc}
          className="px-2.5 py-1 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-foreground-soft font-bold text-[11px] transition cursor-pointer"
        >
          1戦目
        </button>
        <button
          type="button"
          onClick={() => handleUpdate('game2')}
          disabled={updatingVc}
          className="px-2.5 py-1 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-foreground-soft font-bold text-[11px] transition cursor-pointer"
        >
          2戦目
        </button>
        <button
          type="button"
          onClick={() => handleUpdate('game3')}
          disabled={updatingVc}
          className="px-2.5 py-1 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-foreground-soft font-bold text-[11px] transition cursor-pointer"
        >
          3戦目
        </button>
        <button
          type="button"
          onClick={() => handleUpdate('game4')}
          disabled={updatingVc}
          className="px-2.5 py-1 rounded-xl bg-surface-subtle hover:bg-surface-hover border border-border text-foreground-soft font-bold text-[11px] transition cursor-pointer"
        >
          4戦目
        </button>
        <button
          type="button"
          onClick={() => handleUpdate('mayhem')}
          disabled={updatingVc}
          className="px-2.5 py-1 rounded-xl bg-primary-100 hover:bg-primary-200 border border-primary-edge text-primary-950 font-black text-[11px] transition cursor-pointer shadow-2xs"
          title="締めメイヘム中！"
        >
          🎪 締めメイヘム中
        </button>
        <button
          type="button"
          onClick={() => handleUpdate('reset')}
          disabled={updatingVc}
          className="px-2 py-1 rounded-xl text-faint hover:text-foreground text-[11px] transition cursor-pointer"
          title="ステータスをクリア"
        >
          クリア ✕
        </button>
        {updatingVc && <span className="text-[10px] text-primary-600 animate-pulse font-bold">更新中...</span>}
      </div>
    </div>
  );
});
