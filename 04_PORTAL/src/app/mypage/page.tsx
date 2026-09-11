"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  User, Shield, Trees, Zap, Target, Heart, Shuffle, Ban, 
  Save, Coins, Trophy, Award, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw,
  GraduationCap, Sparkles, BookOpenCheck, Flame, History, Swords, Star, Activity, ChevronRight
} from "lucide-react";

interface MentorshipPref {
  isStudent?: boolean;
  studentLane?: string;
  studentComment?: string;
  isMentor?: boolean;
  mentorLane?: string;
  mentorComment?: string;
}

interface RolePref {
  primary?: string;
  secondary?: string;
  ng_roles?: string[];
  mentorship?: MentorshipPref;
}

interface PlayerStats {
  total: { g: number; w: number };
  roles: Record<string, { g: number; w: number }>;
  topChampions?: Array<{ champion: string; games: number; wins: number; winRate: number }>;
  recentMatches?: Array<{
    matchId: string;
    date: string;
    isWin: boolean;
    role: string;
    champion: string;
    kills: number;
    deaths: number;
    assists: number;
  }>;
}

interface PlayerData {
  id: string;
  discord_id: string;
  name: string;
  ign: string;
  highest_rank: string;
  coins: number;
  role_preferences: RolePref;
  stats?: PlayerStats;
  mmr?: number;
  avatar?: string;
  isAdmin?: boolean;
}

const ROLES = [
  { id: "TOP", name: "トップ", icon: Shield, color: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
  { id: "JG", name: "ジャングル", icon: Trees, color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  { id: "MID", name: "ミッド", icon: Zap, color: "text-blue-400 border-blue-500/40 bg-blue-500/10" },
  { id: "ADC", name: "ボット(ADC)", icon: Target, color: "text-rose-400 border-rose-500/40 bg-rose-500/10" },
  { id: "SUP", name: "サポート", icon: Heart, color: "text-purple-400 border-purple-500/40 bg-purple-500/10" },
  { id: "FILL", name: "おまかせ(FILL)", icon: Shuffle, color: "text-stone-300 border-stone-500/40 bg-stone-500/10" },
];

export default function MyPage() {
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フォーム状態
  const [primaryRole, setPrimaryRole] = useState<string>("FILL");
  const [secondaryRole, setSecondaryRole] = useState<string>("FILL");
  const [ngRoles, setNgRoles] = useState<string[]>([]);
  const [ign, setIgn] = useState<string>("");

  // 師弟企画状態（弟子・師匠を同時に希望可能）
  const [isStudent, setIsStudent] = useState<boolean>(false);
  const [studentLane, setStudentLane] = useState<string>('ALL');
  const [studentComment, setStudentComment] = useState<string>('');

  const [isMentor, setIsMentor] = useState<boolean>(false);
  const [mentorLane, setMentorLane] = useState<string>('ALL');
  const [mentorComment, setMentorComment] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function fetchMyProfile() {
      try {
        setLoading(true);
        const res = await fetch("/api/player/preferences", { credentials: "include" });
        const data = await res.json();
        if (res.ok && data.ok && data.player) {
          const p = data.player;
          setPlayer(p);
          const prefs = p.role_preferences || {};
          setPrimaryRole(prefs.primary || "FILL");
          setSecondaryRole(prefs.secondary || "FILL");
          
          // ng_roles または ng_lane_1/ng_lane_2 から復元
          const initialNg = prefs.ng_roles || [p.ng_lane_1, p.ng_lane_2].filter(Boolean);
          setNgRoles(initialNg);
          setIgn(p.ign || "");

          // 師弟設定の復元（互換性対応）
          const m = prefs.mentorship || {};
          const isStud = m.isStudent ?? (m.type === 'STUDENT');
          const isMent = m.isMentor ?? (m.type === 'MENTOR');

          setIsStudent(isStud);
          setStudentLane(m.studentLane || (m.type === 'STUDENT' ? m.lane : 'ALL') || 'ALL');
          setStudentComment(m.studentComment || (m.type === 'STUDENT' ? m.comment : '') || '');

          setIsMentor(isMent);
          setMentorLane(m.mentorLane || (m.type === 'MENTOR' ? m.lane : 'ALL') || 'ALL');
          setMentorComment(m.mentorComment || (m.type === 'MENTOR' ? m.comment : '') || '');
        } else {
          setError(data.error || "プロフィールの読み込みに失敗しました。");
        }
      } catch (err: any) {
        setError("通信エラーが発生しました。");
      } finally {
        setLoading(false);
      }
    }
    fetchMyProfile();
  }, []);

  const toggleNgRole = (roleId: string) => {
    if (roleId === "FILL") return;
    if (ngRoles.includes(roleId)) {
      setNgRoles(ngRoles.filter((r) => r !== roleId));
    } else {
      // 最大2つまで
      if (ngRoles.length >= 2) {
        setNgRoles([...ngRoles.slice(1), roleId]);
      } else {
        setNgRoles([...ngRoles, roleId]);
      }
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      setError(null);

      const res = await fetch("/api/player/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          primary: primaryRole,
          secondary: secondaryRole,
          ng_roles: ngRoles,
          ign: ign,
          mentorship: {
            isStudent,
            studentLane,
            studentComment,
            isMentor,
            mentorLane,
            mentorComment,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setError(data.error || "保存に失敗しました。");
      }
    } catch (err: any) {
      setError("保存処理中に通信エラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1c1917] text-stone-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-stone-400 text-sm font-medium">マイページ＆名簿戦績を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error && !player) {
    return (
      <div className="min-h-screen bg-[#1c1917] text-stone-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#2b2620] border border-stone-800 rounded-2xl p-8 text-center shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">ログインが必要です</h2>
          <p className="text-sm text-stone-400 mb-6 leading-relaxed">
            マイページや希望レーン設定を利用するには、Discordでポータルにログインしてください。
          </p>
          <Link
            href="/api/auth/discord"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold transition-all shadow-lg shadow-[#5865F2]/20"
          >
            <User className="w-5 h-5" />
            Discordでログインする
          </Link>
        </div>
      </div>
    );
  }

  const totalGames = player?.stats?.total?.g || 0;
  const totalWins = player?.stats?.total?.w || 0;
  const totalLosses = Math.max(0, totalGames - totalWins);
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
  const roleStats = player?.stats?.roles || {};
  const topChamps = player?.stats?.topChampions || [];
  const recentMatches = player?.stats?.recentMatches || [];

  return (
    <div className="min-h-screen bg-[#1c1917] text-stone-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* プロフィールヘッダーカード */}
        <div className="bg-[#2b2620]/95 backdrop-blur-md border border-amber-500/20 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5">
              <div className="relative">
                {player?.avatar ? (
                  <img
                    src={player.avatar}
                    alt={player.name}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-amber-500/40 object-cover shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-3xl">
                    {player?.name?.[0]?.toUpperCase() || "P"}
                  </div>
                )}
                {player?.isAdmin && (
                  <span className="absolute -bottom-2 -right-2 px-2 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-md border border-rose-400/50 shadow">
                    ADMIN
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {player?.name}
                  </h1>
                  <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-lg">
                    {player?.highest_rank || "UNRANKED"}
                  </span>
                </div>
                <div className="text-xs text-stone-400 flex items-center gap-3 flex-wrap">
                  <span>IGN: <strong className="text-amber-300 font-mono">{player?.ign || "未設定"}</strong></span>
                  <span>•</span>
                  <span>MMR: <strong className="text-stone-200">{player?.mmr || 1200}</strong></span>
                </div>
              </div>
            </div>

            {/* コイン ＆ 名簿カルテ連携リンク */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
              <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5">
                <Coins className="w-5 h-5 text-amber-400 animate-pulse" />
                <div>
                  <div className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider">所持コイン</div>
                  <div className="text-lg font-black text-amber-300 font-mono leading-none">
                    {(player?.coins || 0).toLocaleString()} <span className="text-xs">🪙</span>
                  </div>
                </div>
              </div>

              {player?.discord_id ? (
                <Link
                  href={`/player/${player.discord_id}`}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                  title="プレイヤー名簿の個人カルテ画面を開く"
                >
                  <Activity className="w-4 h-4" />
                  <span>名簿カルテ詳細</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  href="/player"
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <User className="w-4 h-4" />
                  <span>名簿一覧</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* 📊 通算戦績 ＆ 名簿データ統合パネル */}
        <div className="bg-[#2b2620]/90 border border-amber-500/20 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>カスタム通算戦績 (名簿データ連携)</span>
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                KTMカスタムマッチの全試合履歴から自動集計されたリアルタイム戦績です。
              </p>
            </div>
            {player?.discord_id && (
              <Link
                href={`/player/${player.discord_id}`}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition self-start sm:self-auto"
              >
                <span>プレイスタイル・相性分析はこちら</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* 戦績サマリーグリッド */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-4 text-center">
              <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">総試合数</div>
              <div className="text-2xl font-black text-white font-mono mt-1">{totalGames} <span className="text-xs font-normal text-stone-400">戦</span></div>
            </div>
            <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-4 text-center">
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">勝利数 / 敗北数</div>
              <div className="text-2xl font-black text-emerald-300 font-mono mt-1">
                {totalWins} <span className="text-xs text-stone-400 font-normal">勝</span> <span className="text-stone-600">/</span> {totalLosses} <span className="text-xs text-stone-400 font-normal">敗</span>
              </div>
            </div>
            <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-4 text-center">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">総合勝率</div>
              <div className={`text-2xl font-black font-mono mt-1 ${winRate >= 50 ? 'text-amber-300' : 'text-stone-300'}`}>
                {totalGames > 0 ? `${winRate}%` : "-"}
              </div>
            </div>
            <div className="bg-stone-900/70 border border-stone-800 rounded-xl p-4 text-center">
              <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">推定レーティング</div>
              <div className="text-2xl font-black text-blue-300 font-mono mt-1">{player?.mmr || 1200} <span className="text-xs font-normal text-stone-400">MMR</span></div>
            </div>
          </div>

          {/* ロール別戦績バー ＆ 得意チャンピオン */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* ロール別勝率 */}
            <div className="bg-stone-900/50 border border-stone-800/80 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-amber-400" />
                <span>ロール別 出場・勝率</span>
              </h3>
              <div className="space-y-2.5">
                {["TOP", "JG", "MID", "ADC", "SUP"].map((rId) => {
                  const roleObj = ROLES.find(r => r.id === rId);
                  const s = roleStats[rId] || { g: 0, w: 0 };
                  const rRate = s.g > 0 ? Math.round((s.w / s.g) * 100) : 0;
                  const Icon = roleObj?.icon || Shield;
                  return (
                    <div key={rId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-bold text-stone-300">
                          <Icon className="w-3.5 h-3.5 text-stone-400" />
                          <span>{roleObj?.name || rId}</span>
                        </span>
                        <span className="text-stone-400 font-mono text-[11px]">
                          {s.g}戦 {s.w}勝 ({s.g > 0 ? `${rRate}%` : "-"})
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            rRate >= 60 ? 'bg-amber-400' : rRate >= 45 ? 'bg-emerald-500' : 'bg-stone-600'
                          }`}
                          style={{ width: `${s.g > 0 ? rRate : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 得意チャンピオン */}
            <div className="bg-stone-900/50 border border-stone-800/80 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-400" />
                <span>得意チャンピオン (使用数順)</span>
              </h3>
              {topChamps.length > 0 ? (
                <div className="space-y-2">
                  {topChamps.map((c, idx) => (
                    <div
                      key={c.champion}
                      className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-stone-800 text-stone-400 text-[10px] font-black flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-white">{c.champion}</span>
                      </div>
                      <div className="text-xs font-mono text-stone-300 flex items-center gap-3">
                        <span className="text-stone-400">{c.games}試合</span>
                        <span className={`font-bold ${c.winRate >= 50 ? 'text-emerald-400' : 'text-stone-400'}`}>
                          {c.winRate}% 勝率
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-stone-500">
                  まだ試合履歴データがありません。カスタムマッチに参加すると集計されます！
                </div>
              )}
            </div>

          </div>

          {/* 直近の試合履歴 */}
          {recentMatches.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-400" />
                <span>直近のカスタム対戦履歴 (最新5試合)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {recentMatches.map((m) => (
                  <div
                    key={m.matchId}
                    className={`p-3 rounded-xl border flex flex-col justify-between ${
                      m.isWin
                        ? 'bg-blue-950/20 border-blue-500/40 text-blue-200'
                        : 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                        m.isWin ? 'bg-blue-500 text-white' : 'bg-rose-600 text-white'
                      }`}>
                        {m.isWin ? 'WIN' : 'LOSE'}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {m.date ? new Date(m.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '-'}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-black truncate">{m.champion}</div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {m.role} • {m.kills}/{m.deaths}/{m.assists}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 希望レーン & NGレーン設定フォーム */}
        <div className="bg-[#2b2620]/90 border border-stone-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-8">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <span>希望レーン ＆ NGレーン設定</span>
            </h2>
            <p className="text-xs sm:text-sm text-stone-400 mt-1">
              カスタム募集やチーム分けバランサーで優先される希望ロールと、絶対に入りたくないNGロールを設定できます。
            </p>
          </div>

          {/* サモナーネーム（IGN）入力 */}
          <div className="bg-stone-900/50 border border-stone-800/80 rounded-xl p-4">
            <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-2">
              ゲーム内サモナーネーム (IGN#TAG)
            </label>
            <input
              type="text"
              value={ign}
              onChange={(e) => setIgn(e.target.value)}
              placeholder="例: Hide on bush#KR1"
              className="w-full bg-[#1c1917] border border-stone-700 rounded-lg px-4 py-2.5 text-sm text-stone-200 font-mono placeholder:text-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* 第1希望レーン */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
              <span>⭐ 第1希望レーン (Primary Role)</span>
              <span className="text-[11px] text-stone-500 normal-case">最優先で割り当てられます</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const isSelected = primaryRole === r.id;
                return (
                  <button
                    key={`pri-${r.id}`}
                    type="button"
                    onClick={() => setPrimaryRole(r.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? `${r.color} shadow-lg ring-1 ring-amber-400/50 scale-[1.02]`
                        : "bg-stone-900/60 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-300"
                    }`}
                  >
                    <Icon className="w-6 h-6 mb-1.5" />
                    <span className="text-xs font-black">{r.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 第2希望レーン */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center justify-between">
              <span>🥈 第2希望レーン (Secondary Role)</span>
              <span className="text-[11px] text-stone-500 normal-case">第1希望が埋まった際の次候補</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const isSelected = secondaryRole === r.id;
                return (
                  <button
                    key={`sec-${r.id}`}
                    type="button"
                    onClick={() => setSecondaryRole(r.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-stone-700/80 border-stone-500 text-white shadow-md scale-[1.02]"
                        : "bg-stone-900/60 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-300"
                    }`}
                  >
                    <Icon className="w-6 h-6 mb-1.5" />
                    <span className="text-xs font-black">{r.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* NGレーン設定 */}
          <div className="space-y-3 pt-2 border-t border-stone-800/80">
            <label className="block text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Ban className="w-4 h-4" />
                <span>🚫 NGレーン設定 (最大2つまで)</span>
              </span>
              <span className="text-[11px] text-stone-500 normal-case">
                バランサーがこのレーンへの配置を回避します
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {ROLES.filter((r) => r.id !== "FILL").map((r) => {
                const Icon = r.icon;
                const isNg = ngRoles.includes(r.id);
                return (
                  <button
                    key={`ng-${r.id}`}
                    type="button"
                    onClick={() => toggleNgRole(r.id)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isNg
                        ? "bg-rose-950/40 border-rose-500/80 text-rose-300 shadow-md shadow-rose-950/50 scale-[1.02]"
                        : "bg-stone-900/60 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-300"
                    }`}
                  >
                    <Ban className={`w-4 h-4 ${isNg ? "text-rose-400" : "text-stone-600"}`} />
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-black">{r.name}</span>
                  </button>
                );
              })}
            </div>
            {ngRoles.length > 0 && (
              <p className="text-[11px] text-rose-400/90 font-medium">
                現在設定中のNG: {ngRoles.join(", ")}
              </p>
            )}
          </div>

          {/* 🎓 師弟バディ企画 参加希望設定 */}
          <div className="space-y-4 pt-4 border-t border-stone-800/80">
            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-amber-400" />
                  <span>🎓 師弟バディ企画 参加希望 (Sovereign Mentorship)</span>
                </span>
                <span className="text-[11px] text-amber-500/80 font-mono font-normal">同時選択可能</span>
              </label>
              <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                サーバー内の参加者同士で「師匠」と「弟子」のペアを作り、VCや画面共有でアドバイスを受けながら成長を目指す企画です。
                <strong className="text-stone-300">「MIDは弟子として教わりたいが、得意なSUPは師匠として教えたい」といった同時登録も可能です！</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 🛡️ 弟子希望カード */}
              <div className={`rounded-xl border p-4 transition-all ${
                isStudent
                  ? 'bg-emerald-950/20 border-emerald-500/80 shadow-lg shadow-emerald-950/30'
                  : 'bg-stone-900/40 border-stone-800/80 opacity-80 hover:opacity-100 hover:border-stone-700'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isStudent}
                      onChange={(e) => setIsStudent(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 bg-stone-900 border-stone-700 focus:ring-emerald-500 focus:ring-offset-stone-900"
                    />
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-black text-emerald-300">🛡️ 弟子として参加（師匠募集！）</span>
                    </div>
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isStudent ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-stone-800 text-stone-500'
                  }`}>
                    {isStudent ? '参加中' : '未選択'}
                  </span>
                </div>

                {isStudent && (
                  <div className="space-y-3 pt-2 border-t border-emerald-900/40 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-300/90 mb-1.5">
                        🎯 教わりたい希望レーン
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                        {[{ id: 'ALL', name: '全般' }, ...ROLES.filter(r => r.id !== 'FILL')].map((r) => {
                          const isSel = studentLane === r.id;
                          return (
                            <button
                              key={`student-lane-${r.id}`}
                              type="button"
                              onClick={() => setStudentLane(r.id)}
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold text-center transition-all cursor-pointer ${
                                isSel
                                  ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow'
                                  : 'bg-stone-900/90 border-stone-800 text-stone-400 hover:border-stone-700'
                              }`}
                            >
                              {r.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-emerald-300/90 mb-1">
                        💬 学びたいこと・悩み（一言アピール）
                      </label>
                      <input
                        type="text"
                        value={studentComment}
                        onChange={(e) => setStudentComment(e.target.value)}
                        placeholder="例: ウェーブ管理やガンク合わせの判断を学びたいです！"
                        className="w-full bg-[#1c1917] border border-emerald-900/60 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 👑 師匠希望カード */}
              <div className={`rounded-xl border p-4 transition-all ${
                isMentor
                  ? 'bg-amber-950/20 border-amber-500/80 shadow-lg shadow-amber-950/30'
                  : 'bg-stone-900/40 border-stone-800/80 opacity-80 hover:opacity-100 hover:border-stone-700'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMentor}
                      onChange={(e) => setIsMentor(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 bg-stone-900 border-stone-700 focus:ring-amber-500 focus:ring-offset-stone-900"
                    />
                    <div className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-black text-amber-300">👑 師匠として参加（弟子募集！）</span>
                    </div>
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isMentor ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-stone-800 text-stone-500'
                  }`}>
                    {isMentor ? '参加中' : '未選択'}
                  </span>
                </div>

                {isMentor && (
                  <div className="space-y-3 pt-2 border-t border-amber-900/40 animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-300/90 mb-1.5">
                        📖 教えたい得意レーン
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                        {[{ id: 'ALL', name: '全般' }, ...ROLES.filter(r => r.id !== 'FILL')].map((r) => {
                          const isSel = mentorLane === r.id;
                          return (
                            <button
                              key={`mentor-lane-${r.id}`}
                              type="button"
                              onClick={() => setMentorLane(r.id)}
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold text-center transition-all cursor-pointer ${
                                isSel
                                  ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow'
                                  : 'bg-stone-900/90 border-stone-800 text-stone-400 hover:border-stone-700'
                              }`}
                            >
                              {r.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-amber-300/90 mb-1">
                        💬 教えられること・指導スタイル（一言アピール）
                      </label>
                      <input
                        type="text"
                        value={mentorComment}
                        onChange={(e) => setMentorComment(e.target.value)}
                        placeholder="例: サポートの視界管理やレーン戦の仕掛け方を教えられます！"
                        className="w-full bg-[#1c1917] border border-amber-900/60 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 保存ボタン & ステータス */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              {saveSuccess && (
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold animate-fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>設定を正常に保存しました！次回のカスタムから反映されます。</span>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold animate-fade-in">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>設定を保存する</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
