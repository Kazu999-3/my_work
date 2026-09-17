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
    <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/30 flex flex-col justify-between gap-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔊</span>
          <div>
            <h4 className="text-xs font-black text-indigo-950">Discord VCチャンネル名の動的更新</h4>
            <p className="text-[10px] text-stone-600">登録したチャンネル名をクリックしてVC名を即座に変更できます</p>
          </div>
        </div>
        {updatingVc && <span className="text-[10px] font-bold text-indigo-700 animate-pulse">更新中...</span>}
      </div>

      {/* 登録済みプリセット一覧 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {vcPresets.map((preset, idx) => (
          <div key={idx} className="inline-flex items-center rounded-xl bg-white/90 border border-indigo-200 shadow-2xs overflow-hidden group">
            <button
              type="button"
              disabled={updatingVc}
              onClick={() => handleUpdate(preset)}
              className="px-2.5 py-1.5 text-[11px] font-black text-indigo-950 hover:bg-indigo-50 transition cursor-pointer disabled:opacity-50"
              title={`VC名を「${preset}」に変更`}
            >
              {preset}
            </button>
            {vcPresets.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteVcPreset(preset)}
                className="px-1.5 py-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 border-l border-indigo-100 text-[10px] transition cursor-pointer"
                title="このプリセットを削除"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 新しいチャンネル名の追加・即時送信フォーム */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAddVcPreset();
        }}
        className="flex items-center gap-1.5 pt-2 border-t border-indigo-500/20"
      >
        <input
          type="text"
          value={newPresetText}
          onChange={(e) => setNewPresetText(e.target.value)}
          placeholder="例: 🔊 カスタム【お祭りマッチ開催中！】"
          className="flex-1 bg-white/90 border border-indigo-200 text-stone-900 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-500 shadow-inner"
        />
        <button
          type="submit"
          disabled={!newPresetText.trim()}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-xs cursor-pointer disabled:opacity-40"
          title="新しいチャンネル名をプリセットに保存"
        >
          ＋ 追加保存
        </button>
        <button
          type="button"
          disabled={!newPresetText.trim() || updatingVc}
          onClick={() => {
            const text = newPresetText.trim();
            if (text) handleUpdate(text);

          }}
          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition shadow-xs cursor-pointer disabled:opacity-40"
          title="入力した名前で今すぐVC名を更新"
        >
          即時更新
        </button>
      </form>
    </div>
  );
});
