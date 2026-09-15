"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Shield, Trees, Zap, Target, Heart, Shuffle, Ban, 
  Save, CheckCircle2, AlertTriangle, RefreshCw, GraduationCap, Award, Moon, Sun, Laptop
} from "lucide-react";
import ThemeToggle from "../../components/ThemeToggle";

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

interface PlayerSettingsPanelProps {
  player: any;
  onSaved?: (updatedPlayer: any) => void;
}

const ROLES = [
  { id: "TOP", name: "トップ", icon: Shield, color: "text-amber-600 border-amber-500/40 bg-amber-500/10" },
  { id: "JG", name: "ジャングル", icon: Trees, color: "text-emerald-600 border-emerald-500/40 bg-emerald-500/10" },
  { id: "MID", name: "ミッド", icon: Zap, color: "text-blue-600 border-blue-500/40 bg-blue-500/10" },
  { id: "ADC", name: "ボット(ADC)", icon: Target, color: "text-rose-600 border-rose-500/40 bg-rose-500/10" },
  { id: "SUP", name: "サポート", icon: Heart, color: "text-purple-600 border-purple-500/40 bg-purple-500/10" },
  { id: "FILL", name: "おまかせ(FILL)", icon: Shuffle, color: "text-stone-600 border-stone-500/40 bg-stone-500/10" },
];

export default function PlayerSettingsPanel({ player, onSaved }: PlayerSettingsPanelProps) {
  const prefs = player?.role_preferences || {};
  const [primaryRole, setPrimaryRole] = useState<string>(prefs.primary || "FILL");
  const [secondaryRole, setSecondaryRole] = useState<string>(prefs.secondary || "FILL");
  const [ngRoles, setNgRoles] = useState<string[]>(prefs.ng_roles || [player?.ng_lane_1, player?.ng_lane_2].filter(Boolean));
  const [ign, setIgn] = useState<string>(player?.ign || "");

  const m = prefs.mentorship || {};
  const isStud = m.isStudent ?? (m.type === 'STUDENT');
  const isMent = m.isMentor ?? (m.type === 'MENTOR');

  const [isStudent, setIsStudent] = useState<boolean>(isStud);
  const [studentLane, setStudentLane] = useState<string>(m.studentLane || (m.type === 'STUDENT' ? m.lane : 'ALL') || 'ALL');
  const [studentComment, setStudentComment] = useState<string>(m.studentComment || (m.type === 'STUDENT' ? m.comment : '') || '');

  const [isMentor, setIsMentor] = useState<boolean>(isMent);
  const [mentorLane, setMentorLane] = useState<string>(m.mentorLane || (m.type === 'MENTOR' ? m.lane : 'ALL') || 'ALL');
  const [mentorComment, setMentorComment] = useState<string>(m.mentorComment || (m.type === 'MENTOR' ? m.comment : '') || '');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (player) {
      const p = player.role_preferences || {};
      setPrimaryRole(p.primary || "FILL");
      setSecondaryRole(p.secondary || "FILL");
      setNgRoles(p.ng_roles || [player.ng_lane_1, player.ng_lane_2].filter(Boolean));
      setIgn(player.ign || "");

      const ment = p.mentorship || {};
      setIsStudent(ment.isStudent ?? (ment.type === 'STUDENT'));
      setStudentLane(ment.studentLane || (ment.type === 'STUDENT' ? ment.lane : 'ALL') || 'ALL');
      setStudentComment(ment.studentComment || (ment.type === 'STUDENT' ? ment.comment : '') || '');

      setIsMentor(ment.isMentor ?? (ment.type === 'MENTOR'));
      setMentorLane(ment.mentorLane || (ment.type === 'MENTOR' ? ment.lane : 'ALL') || 'ALL');
      setMentorComment(ment.mentorComment || (ment.type === 'MENTOR' ? ment.comment : '') || '');
    }
  }, [player]);

  const toggleNgRole = (roleId: string) => {
    if (roleId === "FILL") return;
    if (ngRoles.includes(roleId)) {
      setNgRoles(ngRoles.filter((r) => r !== roleId));
    } else {
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
        if (onSaved) onSaved(data.player);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setError(data.error || "設定の保存に失敗しました。");
      }
    } catch (err: any) {
      setError("通信エラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-black/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
      <div>
        <h2 className="text-xl font-black text-stone-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-600" />
          <span>アカウント設定 ＆ 希望・NGレーン設定</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-500 font-medium mt-1">
          カスタム募集やチーム分けバランサーで優先される希望ロールと、絶対に入りたくないNGロールを自己設定できます。
        </p>
      </div>

      {/* サモナーネーム（IGN）入力 */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-2">
        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider">
          ゲーム内サモナーネーム (IGN#TAG)
        </label>
        <input
          type="text"
          value={ign}
          onChange={(e) => setIgn(e.target.value)}
          placeholder="例: Hide on bush#KR1"
          className="w-full bg-white border border-stone-300 rounded-xl px-4 py-2.5 text-sm text-stone-900 font-mono placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-xs"
        />
        <p className="text-[11px] text-stone-400 font-medium">
          ※ LoLクライアント内の Riot ID と タグライン（#JP1など）を入力すると、OP.GGやカルテへの自動連携が有効になります。
        </p>
      </div>

      {/* 第1希望レーン */}
      <div className="space-y-3">
        <label className="block text-xs font-black text-amber-800 uppercase tracking-wider flex items-center justify-between">
          <span>⭐ 第1希望レーン (Primary Role)</span>
          <span className="text-[11px] text-stone-500 normal-case font-bold">最優先で割り当てられます</span>
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
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-amber-500 text-stone-950 font-black shadow-md border-amber-600 scale-[1.02]"
                    : "bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50 font-bold"
                }`}
              >
                <Icon className="w-6 h-6 mb-1.5" />
                <span className="text-xs">{r.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 第2希望レーン */}
      <div className="space-y-3">
        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider flex items-center justify-between">
          <span>🥈 第2希望レーン (Secondary Role)</span>
          <span className="text-[11px] text-stone-500 normal-case font-bold">第1希望が埋まった際の次候補</span>
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
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-stone-800 text-white font-black shadow-md border-stone-900 scale-[1.02]"
                    : "bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50 font-bold"
                }`}
              >
                <Icon className="w-6 h-6 mb-1.5" />
                <span className="text-xs">{r.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* NGレーン設定 */}
      <div className="space-y-3 pt-4 border-t border-stone-200">
        <label className="block text-xs font-black text-rose-700 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Ban className="w-4 h-4" />
            <span>🚫 NGレーン設定 (最大2つまで)</span>
          </span>
          <span className="text-[11px] text-stone-500 normal-case font-bold">
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
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  isNg
                    ? "bg-rose-500 text-white font-black shadow-md border-rose-600 scale-[1.02]"
                    : "bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50 font-bold"
                }`}
              >
                <Ban className={`w-4 h-4 ${isNg ? "text-white" : "text-stone-400"}`} />
                <Icon className="w-4 h-4" />
                <span className="text-xs">{r.name}</span>
              </button>
            );
          })}
        </div>
        {ngRoles.length > 0 && (
          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">
            現在設定中のNGレーン: {ngRoles.join(", ")}
          </p>
        )}
      </div>

      {/* 🤝 師弟自己紹介掲示板 連携案内 */}
      <div className="p-4.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl shrink-0">
            🤝
          </div>
          <div>
            <div className="text-xs font-black text-stone-900 dark:text-white flex items-center gap-1.5">
              <span>師弟マッチング ＆ 自己紹介カード</span>
              <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.2 rounded-full font-black">専用掲示板</span>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-300 font-medium mt-0.5">
              師匠・弟子の自己紹介カード投稿、相性診断、オファーの送受信は「師弟掲示板」で行えます。
            </p>
          </div>
        </div>
        <Link
          href="/mentorship"
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-sm shrink-0 cursor-pointer"
        >
          師弟掲示板を開く ↗
        </Link>
      </div>

      {/* 🌙 外観・ダークモード設定 */}
      <div className="bg-stone-50/80 dark:bg-[#2b2d31]/80 border border-stone-200/80 dark:border-[#3f4147] rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
              <Moon size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900 dark:text-white">外観・テーマ設定</h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">ライトモード・スレート調ダークモード・OS自動連動を切り替えられます</p>
            </div>
          </div>
          <ThemeToggle variant="full" />
        </div>
      </div>

      {/* 保存ボタン & 通知 */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-200 dark:border-[#3f4147]">
        <div>
          {saveSuccess && (
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-black animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>設定を正常に保存しました！次回のカスタムから即時反映されます。</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-rose-700 text-xs font-black animate-fade-in">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
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
  );
}
