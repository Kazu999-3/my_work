'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Swords, Trophy, Users, Coins, Sparkles, Shield, Zap, Star, Crosshair, Award } from 'lucide-react';
import { getChampIcon } from '../../../lib/ddragonClient';

const ROLE_ICONS: Record<string, any> = {
  TOP: <Shield className="w-3.5 h-3.5 text-purple-600" />,
  JG: <Zap className="w-3.5 h-3.5 text-emerald-600" />,
  MID: <Star className="w-3.5 h-3.5 text-rose-600" />,
  ADC: <Crosshair className="w-3.5 h-3.5 text-sky-600" />,
  SUP: <Award className="w-3.5 h-3.5 text-amber-600" />,
};

interface BalancerStadiumViewProps {
  result: any;
  currentUserName?: string;
  onOpenAdminModal?: () => void;
  isAdmin?: boolean;
}

export default function BalancerStadiumView({
  result,
  currentUserName,
  onOpenAdminModal,
  isAdmin,
}: BalancerStadiumViewProps) {
  if (!result || !result.teamBlue || !result.teamRed) return null;

  const blue = result.teamBlue || [];
  const red = result.teamRed || [];
  const spectators = result.spectators || [];

  // 自分がどちらのチームにいるか判定
  const myBlueEntry = currentUserName ? blue.find((p: any) => p.name === currentUserName) : null;
  const myRedEntry = currentUserName ? red.find((p: any) => p.name === currentUserName) : null;
  const mySide = myBlueEntry ? 'BLUE' : myRedEntry ? 'RED' : null;
  const myRole = myBlueEntry?.assignedRole || myRedEntry?.assignedRole || null;

  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

  return (
    <div className="bg-gradient-to-b from-stone-900 to-stone-950 border-2 border-amber-500/60 rounded-3xl p-4 sm:p-6 shadow-xl text-white space-y-5 animate-in fade-in">
      {/* スタジアムヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/40 flex items-center justify-center text-xl shrink-0">
            🏟️
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                <span>本日のチーム分け対戦カード</span>
                <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full">
                  進行中
                </span>
              </h2>
            </div>
            <p className="text-xs text-stone-400 font-medium">
              MMR差: <strong className="text-amber-400 font-mono">{result.mmrDiff || 0}</strong> │ Blue代表MMR: {result.teamBlueMMR || 0} vs Red代表MMR: {result.teamRedMMR || 0}
            </p>
          </div>
        </div>

        {/* アクションボタングループ */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/casino"
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer border border-amber-400"
          >
            <Coins size={14} />
            <span>勝敗予想にベット</span>
          </Link>

          {isAdmin && onOpenAdminModal && (
            <button
              type="button"
              onClick={onOpenAdminModal}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              ⚙️ 運営詳細
            </button>
          )}
        </div>
      </div>

      {/* 👤 ログインユーザー専用の所属アナウンスバナー */}
      {mySide && (
        <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
          mySide === 'BLUE'
            ? 'bg-blue-950/60 border-blue-500/50 text-blue-200'
            : 'bg-red-950/60 border-rose-500/50 text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{mySide === 'BLUE' ? '🟦' : '🟥'}</span>
            <div>
              <span className="text-xs font-black">
                あなたは <strong className="text-white font-black">{mySide}チーム ({myRole})</strong> です！
              </span>
              <p className="text-[11px] opacity-80">
                対面相手の得意チャンプや戦略を事前に確認して試合に挑みましょう。
              </p>
            </div>
          </div>
          <Link
            href={`/coach?champion=${encodeURIComponent(myBlueEntry?.primary || myRedEntry?.primary || 'JarvanIV')}`}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded-lg transition border border-white/20 shrink-0"
          >
            対面作戦を開く ➔
          </Link>
        </div>
      )}

      {/* ⚔️ 5レーン対面スタジアムグリッド */}
      <div className="space-y-2">
        {roles.map((role) => {
          const blueP = blue.find((p: any) => p.assignedRole === role) || blue[roles.indexOf(role)];
          const redP = red.find((p: any) => p.assignedRole === role) || red[roles.indexOf(role)];

          const isMyBlue = currentUserName && blueP?.name === currentUserName;
          const isMyRed = currentUserName && redP?.name === currentUserName;

          return (
            <div
              key={role}
              className="bg-stone-900/90 border border-stone-800 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-2 hover:border-stone-700 transition"
            >
              {/* BLUEサイド選手 */}
              <div className={`flex items-center gap-2.5 min-w-0 flex-1 ${isMyBlue ? 'p-1.5 rounded-xl bg-blue-900/40 border border-blue-500/50 ring-1 ring-blue-400/40' : ''}`}>
                <div className="w-7 h-7 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-xs font-black text-blue-300 shrink-0">
                  {blueP?.highest_rank?.slice(0, 1) || 'B'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-black text-white truncate">
                      {blueP?.name || '未定'}
                    </span>
                    {isMyBlue && (
                      <span className="text-[9px] font-black bg-blue-500 text-white px-1.5 rounded">YOU</span>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono">
                    MMR {blueP?.mmr || 1200}
                  </div>
                </div>
              </div>

              {/* 中央レーンバッジ */}
              <div className="flex flex-col items-center justify-center px-2 shrink-0">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-800 border border-stone-700 text-[10px] font-black font-mono text-stone-300">
                  {ROLE_ICONS[role]}
                  <span>{role}</span>
                </div>
                <span className="text-[9px] text-stone-500 font-black mt-0.5">VS</span>
              </div>

              {/* REDサイド選手 */}
              <div className={`flex items-center justify-end gap-2.5 min-w-0 flex-1 text-right ${isMyRed ? 'p-1.5 rounded-xl bg-red-900/40 border border-rose-500/50 ring-1 ring-rose-400/40' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-end gap-1.5">
                    {isMyRed && (
                      <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 rounded">YOU</span>
                    )}
                    <span className="text-xs sm:text-sm font-black text-white truncate">
                      {redP?.name || '未定'}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono">
                    MMR {redP?.mmr || 1200}
                  </div>
                </div>
                <div className="w-7 h-7 rounded-xl bg-red-600/30 border border-rose-500/40 flex items-center justify-center text-xs font-black text-rose-300 shrink-0">
                  {redP?.highest_rank?.slice(0, 1) || 'R'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 待機・観戦者 (Spectators) */}
      {spectators.length > 0 && (
        <div className="pt-2 border-t border-stone-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-stone-400 font-bold flex items-center gap-1">
              <Users size={13} className="text-stone-400" />
              <span>待機・観戦 ({spectators.length}人):</span>
            </span>
            {spectators.map((s: any, idx: number) => (
              <span key={idx} className="bg-stone-800 text-stone-300 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-stone-700">
                {typeof s === 'string' ? s : s.name}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-amber-400 font-bold">
            ※次戦優先選出Pity付与中
          </span>
        </div>
      )}
    </div>
  );
}
