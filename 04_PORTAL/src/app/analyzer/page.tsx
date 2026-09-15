'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  Users,
  Layers,
  Sparkles,
  Shield,
  Eye,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  ClipboardPaste,
  CheckCircle2,
  ArrowRight,
  HelpCircle,
  Lock,
} from 'lucide-react';
import MultiSiteLauncherCard from '../../components/analyzer/MultiSiteLauncherCard';
import StatsTextImporterCard from '../../components/analyzer/StatsTextImporterCard';
import VisionAnalyticsCard from '../../components/coach/VisionAnalyticsCard';
import PlayerStyleRadarCard from '../../components/coach/PlayerStyleRadarCard';

export default function PlayerAnalyzerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentSummoner, setCurrentSummoner] = useState({
    name: 'Kazurin',
    tag: '4036',
  });

  const [activeTab, setActiveTab] = useState<'single' | 'team' | 'import'>('single');

  useEffect(() => {
    fetch('/api/auth/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then((res) => res.json())
      .then((data) => setIsAuthenticated(!!data.valid))
      .catch(() => setIsAuthenticated(false));
  }, []);

  // 5人スカウティング用の入力
  const [teamRosterText, setTeamRosterText] = useState(
    `Kazurin#4036 (JG)
PlayerA#JP1 (TOP)
PlayerB#JP1 (MID)
PlayerC#JP1 (ADC)
PlayerD#JP1 (SUP)`
  );

  const [teamAnalysisList, setTeamAnalysisList] = useState<
    Array<{
      name: string;
      tag: string;
      role: string;
      yourggUrl: string;
      opggUrl: string;
      logUrl: string;
      dangerPoint: string;
      visionStatus: string;
    }>
  >([]);

  const handleSearch = (name: string, tag: string) => {
    setCurrentSummoner({ name, tag });
  };

  const handleAnalyzeTeam = () => {
    const lines = teamRosterText.split('\n').filter((l) => l.trim().length > 0);
    const parsed = lines.map((line) => {
      const match = line.match(/([a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)#([a-zA-Z0-9]+)/);
      const name = match ? match[1] : line.trim();
      const tag = match ? match[2] : 'JP1';
      const roleMatch = line.match(/\((TOP|JG|MID|ADC|BOT|SUP|SUPPORT)\)/i);
      const role = roleMatch ? roleMatch[1].toUpperCase() : 'UNKNOWN';

      return {
        name,
        tag,
        role,
        yourggUrl: `https://your.gg/jp/profile/${encodeURIComponent(name)}-${encodeURIComponent(tag)}`,
        opggUrl: `https://www.op.gg/summoners/jp/${encodeURIComponent(name)}-${encodeURIComponent(tag)}`,
        logUrl: `https://www.leagueofgraphs.com/ja/summoner/jp/${encodeURIComponent(name)}-${encodeURIComponent(tag)}`,
        dangerPoint: role === 'TOP' ? '孤立デス警戒（Gank耐性B）' : role === 'JG' ? '15分戦闘関与不足（ディープ視界推奨）' : '視界スコア良好',
        visionStatus: role === 'SUP' ? '分間2.2個 (優秀)' : role === 'JG' ? '分間1.62個 (上位18%)' : '平均水準',
      };
    });

    setTeamAnalysisList(parsed);
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-300 border-t-amber-600" />
        <p className="text-xs font-bold text-stone-500">認証ステータスを確認中...</p>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-stone-50">
        <div className="text-center max-w-sm rounded-3xl border border-stone-200/90 bg-white p-8 shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-2xl mx-auto shadow-2xs">
            🔑
          </div>
          <div>
            <h2 className="text-lg font-black text-stone-900 mb-1.5">管理者認証が必要です</h2>
            <p className="text-xs text-stone-500 leading-relaxed font-medium">
              プレイヤー深層アナライザー (Deep Intel Hub) は現在、管理者専用機能として運用されています。管理者パスコードまたはDiscord管理者アカウントでログインしてください。
            </p>
          </div>
          <a
            href="/login"
            className="inline-block w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-xs transition"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* イントロバナー */}
      <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-indigo-500/15 border border-amber-500/30 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-900 text-xs font-black border border-amber-500/30">
              <Globe size={14} className="text-amber-600" />
              マルチ分析サイト連携ハブ
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">
              プレイヤー深層アナライザー (Deep Intel Hub)
            </h1>
            <p className="text-stone-700 text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
              <strong>your.gg / OP.GG / League of Graphs / Deeplol / U.GG</strong> の客観データを集約！<br className="hidden sm:inline" />
              プレイスタイル5大レーダー、視界侵入深度、敗因ボトルネックをワンストップで深層解析します。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-white/80 border border-stone-300 text-stone-600 shadow-2xs">
              Riot ID ＆ 5大サイト連動
            </span>
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="flex items-center gap-2 bg-stone-100 p-1.5 rounded-2xl max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('single')}
          className={`flex-1 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'single'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <span>🔍</span>
          <span>単体プレイヤー解析</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('team')}
          className={`flex-1 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'team'
              ? 'bg-white text-stone-900 shadow-xs text-amber-700'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <span>👥</span>
          <span>5v5 チームスカウト</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('import')}
          className={`flex-1 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'import'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <span>📋</span>
          <span>テキストAIインポート</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. 単体プレイヤー解析タブ */}
      {/* ========================================================================= */}
      {activeTab === 'single' && (
        <div className="space-y-6 animate-in fade-in">
          {/* マルチサイト一括ランチャー */}
          <MultiSiteLauncherCard
            summonerName={currentSummoner.name}
            tagLine={currentSummoner.tag}
            onSearch={handleSearch}
          />

          {/* 2カラム分析結果HUD */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* 左側: 視界・コントロール客観解析 */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <VisionAnalyticsCard />
            </div>

            {/* 右側: プレイスタイル5大レーダー ＆ 成長推移カルテ */}
            <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-4">
              <PlayerStyleRadarCard />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. 5v5 チームスカウトタブ */}
      {/* ========================================================================= */}
      {activeTab === 'team' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl text-amber-600 shadow-2xs shrink-0">
                  👥
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-stone-900">
                    5v5 チーム一括スカウティング ＆ 弱点レーン抽出
                  </h3>
                  <p className="text-[11px] text-stone-500 font-medium">
                    チーム5人分のRiot IDを貼り付けて、全メンバーの分析リンクと警戒ポイントを一括生成
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700">
                参加メンバー（1行に1人 / ロール任意指定可）:
              </label>
              <textarea
                rows={5}
                value={teamRosterText}
                onChange={(e) => setTeamRosterText(e.target.value)}
                placeholder="Kazurin#4036 (JG)&#10;Player2#JP1 (MID)&#10;Player3#JP1 (TOP)..."
                className="w-full p-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-mono text-stone-900 focus:outline-none focus:border-amber-500 focus:bg-white transition leading-relaxed"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAnalyzeTeam}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer hover:scale-105"
                >
                  <Users size={14} />
                  <span>5人一括スカウトを実行</span>
                </button>
              </div>
            </div>

            {/* スカウト結果一覧 */}
            {teamAnalysisList.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-stone-100">
                <div className="text-xs font-black text-stone-800">
                  📋 スカウティング診断結果 ({teamAnalysisList.length}名)
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {teamAnalysisList.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-stone-200 bg-stone-50/70 hover:border-amber-400 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                            {m.role}
                          </span>
                          <span className="font-black text-sm text-stone-900">
                            {m.name}#{m.tag}
                          </span>
                        </div>
                        <div className="text-xs text-stone-600 flex items-center gap-3">
                          <span>⚠️ {m.dangerPoint}</span>
                          <span>👁️ 視界: {m.visionStatus}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={m.yourggUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-white hover:bg-emerald-600 hover:text-white border border-stone-200 text-stone-700 font-bold text-xs rounded-xl transition flex items-center gap-1 shadow-2xs"
                        >
                          <span>your.gg</span>
                          <ExternalLink size={11} />
                        </a>
                        <a
                          href={m.opggUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-white hover:bg-blue-600 hover:text-white border border-stone-200 text-stone-700 font-bold text-xs rounded-xl transition flex items-center gap-1 shadow-2xs"
                        >
                          <span>OP.GG</span>
                          <ExternalLink size={11} />
                        </a>
                        <a
                          href={m.logUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-white hover:bg-indigo-600 hover:text-white border border-stone-200 text-stone-700 font-bold text-xs rounded-xl transition flex items-center gap-1 shadow-2xs"
                        >
                          <span>League of Graphs</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. テキストAIインポートタブ */}
      {/* ========================================================================= */}
      {activeTab === 'import' && (
        <div className="space-y-6 animate-in fade-in">
          <StatsTextImporterCard />
        </div>
      )}
    </div>
  );
}
