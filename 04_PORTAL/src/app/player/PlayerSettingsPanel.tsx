"use client";

import { useState, useEffect } from "react";
import { 
  Shield, Trees, Zap, Target, Heart, Shuffle, Ban, 
  Save, CheckCircle2, AlertTriangle, RefreshCw, GraduationCap, Award
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
          <p className="text-[11px] text-rose-600 font-bold">
            現在設定中のNGレーン: {ngRoles.join(", ")}
          </p>
        )}
      </div>

      {/* 🎓 師弟バディ企画 参加希望設定 */}
      <div className="space-y-4 pt-4 border-t border-stone-200">
        <div>
          <label className="block text-xs font-black text-amber-800 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-amber-600" />
              <span>🎓 師弟バディ企画 参加希望 (Sovereign Mentorship)</span>
            </span>
            <span className="text-[11px] text-amber-700 font-mono font-bold">同時選択可能</span>
          </label>
          <p className="text-xs text-stone-500 font-medium mt-1 leading-relaxed">
            サーバー内の参加者同士で「師匠」と「弟子」のペアを作り、VCや画面共有でアドバイスを受けながら成長を目指す企画です。
            <strong className="text-stone-800">「MIDは弟子として教わりたいが、得意なSUPは師匠として教えたい」といった同時登録も可能です！</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 🛡️ 弟子希望カード */}
          <div className={`rounded-2xl border p-5 transition-all ${
            isStudent
              ? 'bg-emerald-50/80 border-emerald-400 shadow-md'
              : 'bg-stone-50/60 border-stone-200 opacity-85 hover:opacity-100'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isStudent}
                  onChange={(e) => setIsStudent(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 bg-white border-stone-300 focus:ring-emerald-500"
                />
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-black text-emerald-900">🛡️ 弟子として参加（師匠募集！）</span>
                </div>
              </label>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                isStudent ? 'bg-emerald-200 text-emerald-900' : 'bg-stone-200 text-stone-500'
              }`}>
                {isStudent ? '参加中' : '未選択'}
              </span>
            </div>

            {isStudent && (
              <div className="space-y-3 pt-3 border-t border-emerald-200 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-black text-emerald-900 mb-1.5">
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
                          className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold text-center transition-all cursor-pointer ${
                            isSel
                              ? 'bg-emerald-600 border-emerald-700 text-white font-black shadow-xs'
                              : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-emerald-900 mb-1">
                    💬 学びたいこと・悩み（一言アピール）
                  </label>
                  <input
                    type="text"
                    value={studentComment}
                    onChange={(e) => setStudentComment(e.target.value)}
                    placeholder="例: ウェーブ管理やガンク合わせの判断を学びたいです！"
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 👑 師匠希望カード */}
          <div className={`rounded-2xl border p-5 transition-all ${
            isMentor
              ? 'bg-amber-50/80 border-amber-400 shadow-md'
              : 'bg-stone-50/60 border-stone-200 opacity-85 hover:opacity-100'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMentor}
                  onChange={(e) => setIsMentor(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 bg-white border-stone-300 focus:ring-amber-500"
                />
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-black text-amber-950">👑 師匠として参加（弟子募集！）</span>
                </div>
              </label>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                isMentor ? 'bg-amber-200 text-amber-950' : 'bg-stone-200 text-stone-500'
              }`}>
                {isMentor ? '参加中' : '未選択'}
              </span>
            </div>

            {isMentor && (
              <div className="space-y-3 pt-3 border-t border-amber-200 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-black text-amber-950 mb-1.5">
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
                          className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold text-center transition-all cursor-pointer ${
                            isSel
                              ? 'bg-amber-500 border-amber-600 text-stone-950 font-black shadow-xs'
                              : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-amber-950 mb-1">
                    💬 教えられること・指導スタイル（一言アピール）
                  </label>
                  <input
                    type="text"
                    value={mentorComment}
                    onChange={(e) => setMentorComment(e.target.value)}
                    placeholder="例: サポートの視界管理やレーン戦の仕掛け方を教えられます！"
                    className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 shadow-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 保存ボタン & 通知 */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-200">
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
