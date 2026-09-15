'use client';

import React, { useState } from 'react';
import {
  ExternalLink,
  Globe,
  Search,
  Sparkles,
  Layers,
  ArrowRight,
  Check,
  Copy,
  Users,
  Shield,
} from 'lucide-react';

interface MultiSiteLauncherCardProps {
  summonerName: string;
  tagLine: string;
  onSearch: (name: string, tag: string) => void;
}

export default function MultiSiteLauncherCard({
  summonerName,
  tagLine,
  onSearch,
}: MultiSiteLauncherCardProps) {
  const [inputName, setInputName] = useState(summonerName || 'Kazurin');
  const [inputTag, setInputTag] = useState(tagLine || '4036');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const cleanName = inputName.trim();
  const cleanTag = inputTag.trim().replace(/^#/, '');

  // 各分析サイトのURL生成
  const SITES = [
    {
      id: 'yourgg',
      name: 'your.gg',
      title: 'プレイスタイル5大レーダー・生存率・CSD@15',
      badge: '深層特性',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      icon: '🌾',
      url: `https://your.gg/jp/profile/${encodeURIComponent(cleanName)}-${encodeURIComponent(cleanTag)}`,
      desc: '生存力(S/A/B)、15分CSリード、序盤キル関与率、戦闘レーダーを可視化',
    },
    {
      id: 'opgg',
      name: 'OP.GG',
      title: 'リアルタイム戦績・勝率・得意チャンプ',
      badge: '総合戦績',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
      icon: '📊',
      url: `https://www.op.gg/summoners/jp/${encodeURIComponent(cleanName)}-${encodeURIComponent(cleanTag)}`,
      desc: '直近20試合の勝敗、KDA、ビルド、ルーン、チーム内ダメージ貢献度',
    },
    {
      id: 'leagueofgraphs',
      name: 'League of Graphs',
      title: '分間視界スコア・詳細マップ分析・ランキング',
      badge: '視界 ＆ 順位',
      badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      icon: '👁️',
      url: `https://www.leagueofgraphs.com/ja/summoner/jp/${encodeURIComponent(cleanName)}-${encodeURIComponent(cleanTag)}`,
      desc: '分間視界スコア、ピン刺し頻度、オブジェクト関与、チャンピオン世界順位',
    },
    {
      id: 'deeplol',
      name: 'Deeplol',
      title: '集団戦ダメージ推移・ゴールドグラフ',
      badge: '戦闘分析',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: '⚔️',
      url: `https://www.deeplol.gg/summoner/jp/${encodeURIComponent(cleanName)}-${encodeURIComponent(cleanTag)}`,
      desc: 'タイムライン別ゴールド差、ダメージシェア、パワースパイク分析',
    },
    {
      id: 'ugg',
      name: 'U.GG',
      title: 'チャンピオン別マッチアップ統計',
      badge: 'マッチアップ',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
      icon: '🛡️',
      url: `https://u.gg/lol/profile/jp1/${encodeURIComponent(cleanName)}-${encodeURIComponent(cleanTag)}/overview`,
      desc: '対面マッチアップ勝率、ティア別チャンピオン適性、ルーン統計',
    },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanName) {
      onSearch(cleanName, cleanTag || 'JP1');
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleOpenAll = () => {
    SITES.forEach((site) => {
      window.open(site.url, '_blank', 'noopener,noreferrer');
    });
  };

  // プリセットプレイヤー
  const PRESETS = [
    { name: 'Kazurin', tag: '4036', role: '🌲 JUNGLE (Gold 3)' },
    { name: 'Hide on bush', tag: 'KR1', role: '⚡ Faker (Challenger)' },
    { name: 'Agurin', tag: 'EUW', role: '🌲 EUW Rank 1 JG' },
  ];

  return (
    <div className="rounded-3xl border border-stone-200/90 bg-white/95 p-5 md:p-6 shadow-xs space-y-5">
      {/* 検索バー */}
      <form onSubmit={handleSearchSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="サモナー名 / Riot ID (例: Kazurin)"
              className="w-full pl-10 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="w-28 relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400 text-xs font-mono font-bold">
                #
              </span>
              <input
                type="text"
                value={inputTag}
                onChange={(e) => setInputTag(e.target.value)}
                placeholder="タグ (4036)"
                className="w-full pl-7 pr-3 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-mono font-bold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-2xl shadow-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <span>🔍</span>
              <span>解析・検索</span>
            </button>
          </div>
        </div>

        {/* プリセットタグ */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="text-stone-400 font-bold">クイック選択:</span>
          {PRESETS.map((p) => (
            <button
              key={p.name + p.tag}
              type="button"
              onClick={() => {
                setInputName(p.name);
                setInputTag(p.tag);
                onSearch(p.name, p.tag);
              }}
              className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-amber-100/80 hover:text-amber-900 text-stone-700 font-bold border border-stone-200/80 transition cursor-pointer flex items-center gap-1"
            >
              <span>{p.name}#{p.tag}</span>
              <span className="text-[10px] text-stone-400 font-normal">({p.role})</span>
            </button>
          ))}
        </div>
      </form>

      {/* アクションバー: 一括起動ボタン */}
      <div className="flex items-center justify-between gap-3 bg-amber-50/70 border border-amber-200/80 p-3 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚀</span>
          <div>
            <div className="text-xs font-black text-amber-950">
              {cleanName}#{cleanTag} の全サイト直通リンク
            </div>
            <div className="text-[10px] text-stone-600 font-medium">
              ボタンを押すと、各分析サイトの該当プロフィールが直接開きます
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAll}
          className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer hover:scale-105"
        >
          <Layers size={13} />
          <span>全5サイトを一括展開</span>
        </button>
      </div>

      {/* 各分析サイトの直通カード一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {SITES.map((site) => (
          <div
            key={site.id}
            className="p-4 rounded-2xl border border-stone-200 bg-white hover:border-amber-400 transition-all shadow-2xs flex flex-col justify-between gap-3 group"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl group-hover:scale-110 transition">{site.icon}</span>
                  <span className="font-black text-sm text-stone-900">{site.name}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${site.badgeColor}`}>
                  {site.badge}
                </span>
              </div>

              <div className="text-xs font-bold text-stone-800">
                {site.title}
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                {site.desc}
              </p>
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleCopy(site.url)}
                className="text-[11px] text-stone-400 hover:text-stone-700 font-bold flex items-center gap-1 cursor-pointer"
                title="URLをコピー"
              >
                {copiedUrl === site.url ? (
                  <>
                    <Check size={12} className="text-emerald-600" />
                    <span className="text-emerald-700">コピー完了</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>URLコピー</span>
                  </>
                )}
              </button>

              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-stone-50 hover:bg-amber-600 text-stone-700 hover:text-white border border-stone-200 hover:border-amber-600 font-black text-xs rounded-xl transition flex items-center gap-1 shadow-2xs group-hover:bg-amber-600 group-hover:text-white"
              >
                <span>開く</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
