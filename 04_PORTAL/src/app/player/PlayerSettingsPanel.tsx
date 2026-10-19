"use client";

import { useState, useEffect } from "react";
import { 
  Shield, Trees, Zap, Target, Heart, Shuffle, Ban, 
  Save, CheckCircle2, AlertTriangle, RefreshCw, Moon,
  Swords, Users, Snowflake, Coffee, BookOpen, Sparkles,
  Coins, X
} from "lucide-react";
import ThemeToggle from "../../components/ThemeToggle";

interface PlayerSettingsPanelProps {
  player: any;
  onSaved?: (updatedPlayer: any) => void;
}

const ROLES = [
  { id: "TOP", name: "トップ", icon: Shield, color: "text-primary-600 border-primary-edge-strong/40 bg-primary-500/10" },
  { id: "JG", name: "ジャングル", icon: Trees, color: "text-success-600 border-success-edge-strong/40 bg-success-500/10" },
  { id: "MID", name: "ミッド", icon: Zap, color: "text-secondary-600 border-secondary-edge-strong/40 bg-secondary-500/10" },
  { id: "ADC", name: "ボット(ADC)", icon: Target, color: "text-danger-600 border-danger-edge-strong/40 bg-danger-500/10" },
  { id: "SUP", name: "サポート", icon: Heart, color: "text-primary-600 border-primary-edge-strong/40 bg-primary-500/10" },
  { id: "ALL", name: "おまかせ(ALL)", icon: Shuffle, color: "text-muted border-stone-500/40 bg-stone-500/10" },
];

const PLAYSTYLE_ITEMS = [
  {
    key: "soloq",
    label: "🥊 ソロキュー奮闘中",
    desc: "ソロランク回し中・デュオ募集中の意思表示",
    icon: Swords,
    activeColor: "bg-danger-500/15 border-danger-500 text-danger-700 dark:text-danger-400 shadow-danger-500/10",
  },
  {
    key: "flex",
    label: "🤝 フレックス希望",
    desc: "3〜5人のフレックス募集・参加をしたい時",
    icon: Users,
    activeColor: "bg-secondary-500/15 border-secondary-500 text-secondary-700 dark:text-secondary-400 shadow-secondary-500/10",
  },
  {
    key: "aram",
    label: "❄️ ARAM・サクッと勢",
    desc: "平日夜や短時間で気軽に1〜2戦回したい時",
    icon: Snowflake,
    activeColor: "bg-orange-500/15 border-orange-500 text-orange-700 dark:text-orange-400 shadow-orange-500/10",
  },
  {
    key: "casual",
    label: "☕ エンジョイ・まったり",
    desc: "勝ち負け気にせずミスも笑って雑談しながら楽しむ",
    icon: Coffee,
    activeColor: "bg-success-500/15 border-success-500 text-success-700 dark:text-success-400 shadow-success-500/10",
  },
  {
    key: "learner",
    label: "📖 教わりたい",
    desc: "立ち回りやアドバイスを気軽に教えてもらいたい時",
    icon: BookOpen,
    activeColor: "bg-primary-500/15 border-primary-500 text-primary-700 dark:text-primary-400 shadow-primary-500/10",
  },
];

export default function PlayerSettingsPanel({ player, onSaved }: PlayerSettingsPanelProps) {
  const prefs = player?.role_preferences || {};
  // 旧データの FILL は ALL と同じ意味（2026-10-17 統一）
  const toAll = (v?: string) => (!v || v === "FILL" ? "ALL" : v);
  const [primaryRole, setPrimaryRole] = useState<string>(toAll(prefs.primary));
  const [secondaryRole, setSecondaryRole] = useState<string>(toAll(prefs.secondary));
  const [ngRoles, setNgRoles] = useState<string[]>(prefs.ng_roles || [player?.ng_lane_1, player?.ng_lane_2].filter(Boolean));
  const [ign, setIgn] = useState<string>(player?.ign || "");
  // こだわり度（1:絶対 / 2:通常 / 3:柔軟）と格上許可。チーム分けで使う（2026-10-17 マイページから設定可能に）
  const [weight, setWeight] = useState<number>([1, 2, 3].includes(Number(player?.weight)) ? Number(player?.weight) : 2);
  const [allowHigher, setAllowHigher] = useState<boolean>(!!player?.allow_higher);

  // プレイスタイルロール状態
  const [playstyles, setPlaystyles] = useState<Record<string, boolean>>({
    soloq: false,
    flex: false,
    aram: false,
    casual: false,
    learner: false,
  });
  const [loadingPlaystyle, setLoadingPlaystyle] = useState(false);
  // KTM の Discord サーバーにいない時は、プレイスタイル（Discord のロール）を付けられない
  const [notInServer, setNotInServer] = useState(false);
  const [togglingPlaystyle, setTogglingPlaystyle] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初参加（通算0戦）判定 & ウェルカムバナー表示状態
  const isNewPlayer = (player?.total_games ?? 0) === 0 && (player?.stats?.total?.g ?? 0) === 0;
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (isNewPlayer && player?.id) {
      try {
        const dismissed = localStorage.getItem(`ktm_welcome_dismissed_${player.id}`);
        if (!dismissed) {
          setShowWelcome(true);
        }
      } catch {
        setShowWelcome(true);
      }
    }
  }, [isNewPlayer, player?.id]);

  const handleDismissWelcome = () => {
    setShowWelcome(false);
    if (player?.id) {
      try {
        localStorage.setItem(`ktm_welcome_dismissed_${player.id}`, "true");
      } catch {
        // local storage unavailable
      }
    }
  };

  useEffect(() => {
    if (player) {
      const p = player.role_preferences || {};
      setPrimaryRole(toAll(p.primary));
      setSecondaryRole(toAll(p.secondary));
      setNgRoles(p.ng_roles || [player.ng_lane_1, player.ng_lane_2].filter(Boolean));
      setIgn(player.ign || "");
      setWeight([1, 2, 3].includes(Number(player.weight)) ? Number(player.weight) : 2);
      setAllowHigher(!!player.allow_higher);
    }
  }, [player]);

  // プレイスタイルのロード
  useEffect(() => {
    async function loadPlaystyles() {
      try {
        setLoadingPlaystyle(true);
        const res = await fetch("/api/player/playstyle", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.playstyles) {
            setPlaystyles(data.playstyles);
            setNotInServer(!!data.notInServer);
          }
        }
      } catch (err) {
        console.warn("[PlayerSettingsPanel] プレイスタイル取得失敗:", err);
      } finally {
        setLoadingPlaystyle(false);
      }
    }
    loadPlaystyles();
  }, []);

  const togglePlaystyle = async (key: string) => {
    if (togglingPlaystyle) return;
    const current = !!playstyles[key];
    // 楽観的UI更新
    setPlaystyles((prev) => ({ ...prev, [key]: !current }));
    setTogglingPlaystyle(key);
    try {
      const res = await fetch("/api/player/playstyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roleKey: key }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        // ロールバック
        setPlaystyles((prev) => ({ ...prev, [key]: current }));
      } else {
        setPlaystyles((prev) => ({ ...prev, [key]: !!data.active }));
      }
    } catch (err) {
      // ロールバック
      setPlaystyles((prev) => ({ ...prev, [key]: current }));
    } finally {
      setTogglingPlaystyle(null);
    }
  };

  const toggleNgRole = (roleId: string) => {
    if (roleId === "ALL") return;
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
          weight,
          allow_higher: allowHigher,
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
    <div className="bg-surface/80 dark:bg-background/80 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
      {/* 🔰 初参加メンバー限定ウェルカムバナー */}
      {showWelcome && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-primary-500/40 bg-gradient-to-br from-primary-500/15 via-secondary-500/10 to-transparent p-5 sm:p-6 shadow-lg shadow-primary-500/5 animate-fade-in">
          <button
            type="button"
            onClick={handleDismissWelcome}
            aria-label="バナーを閉じる"
            className="absolute top-3.5 right-3.5 p-1.5 rounded-xl text-muted hover:text-foreground dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-stone-950 font-black text-xl shrink-0 shadow-md shadow-primary-500/20">
              🔰
            </div>

            <div className="space-y-3 flex-1 pr-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-foreground dark:text-white">
                    KTM LoL部へようこそ！🎉
                  </h3>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-700 dark:text-primary-300 border border-primary-500/30">
                    初参加ウェルカム
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-foreground-soft font-medium mt-1 leading-relaxed">
                  サーバーへのご参加ありがとうございます！KTMは初心者から上級者まで、誰でも対等に楽しめるコミュニティです。
                </p>
              </div>

              {/* 3大安心ハイライト */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="flex items-center gap-2.5 bg-surface/90 dark:bg-background/90 border border-black/5 dark:border-white/10 rounded-xl px-3 py-2 text-xs">
                  <Coins className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-black text-foreground dark:text-white block">1,000 KTMコイン</span>
                    <span className="text-[10px] text-muted block">参加ボーナス配布済み🪙</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 bg-surface/90 dark:bg-background/90 border border-black/5 dark:border-white/10 rounded-xl px-3 py-2 text-xs">
                  <Shield className="w-4 h-4 text-primary-500 shrink-0" />
                  <div>
                    <span className="font-black text-foreground dark:text-white block">AIチームバランサー</span>
                    <span className="text-[10px] text-muted block">実力差を自動均等化⚡</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 bg-surface/90 dark:bg-background/90 border border-black/5 dark:border-white/10 rounded-xl px-3 py-2 text-xs">
                  <Sparkles className="w-4 h-4 text-secondary-500 shrink-0" />
                  <div>
                    <span className="font-black text-foreground dark:text-white block">足引っ張り心配ゼロ</span>
                    <span className="text-[10px] text-muted block">全員エンジョイ推奨🍵</span>
                  </div>
                </div>
              </div>

              {/* 最初のアクション案内 */}
              <div className="pt-1 flex items-center gap-2 text-xs text-primary-800 dark:text-primary-300 font-bold">
                <span>👉 まずは下の画面で「希望レーン」と「プレイスタイル」を設定してみましょう！</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-black text-foreground dark:text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-600" />
          <span>アカウント設定 ＆ 希望・NGレーン設定</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-strong font-medium mt-1">
          カスタム募集やチーム分けバランサーで優先される希望ロールと、絶対に入りたくないNGロールを自己設定できます。
        </p>
      </div>

      {/* サモナーネーム（IGN）入力 */}
      <div className="bg-background dark:bg-surface border border-border rounded-2xl p-4 sm:p-5 space-y-2">
        <label className="block text-xs font-black text-foreground-subtle uppercase tracking-wider">
          ゲーム内サモナーネーム (IGN#TAG)
        </label>
        <input
          type="text"
          value={ign}
          onChange={(e) => setIgn(e.target.value)}
          placeholder="例: Hide on bush#KR1"
          className="w-full bg-surface dark:bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground dark:text-white font-mono placeholder:text-faint focus:outline-none focus:border-primary-edge-strong focus:ring-1 focus:ring-primary-500 shadow-xs"
        />
        <p className="text-[11px] text-faint font-medium">
          ※ LoLクライアント内の Riot ID と タグライン（#JP1など）を入力すると、OP.GGやカルテへの自動連携が有効になります。
        </p>
      </div>

      {/* 第1希望レーン */}
      <div className="space-y-3">
        <label className="block text-xs font-black text-primary-800 dark:text-primary-400 uppercase tracking-wider flex items-center justify-between">
          <span>⭐ 第1希望レーン (Primary Role)</span>
          <span className="text-[11px] text-muted-strong normal-case font-bold">最優先で割り当てられます</span>
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
                    ? "bg-primary-500 text-stone-950 font-black shadow-md border-primary-edge-strong scale-[1.02]"
                    : "bg-surface dark:bg-surface border-border dark:border-border text-muted hover:border-border hover:bg-background dark:hover:bg-surface-hover font-bold"
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
        <label className="block text-xs font-black text-foreground-subtle uppercase tracking-wider flex items-center justify-between">
          <span>🥈 第2希望レーン (Secondary Role)</span>
          <span className="text-[11px] text-muted-strong normal-case font-bold">第1希望が埋まった際の次候補</span>
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
                    ? "bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 font-black shadow-md border-stone-900 dark:border-stone-200 scale-[1.02]"
                    : "bg-surface dark:bg-surface border-border dark:border-border text-muted hover:border-border hover:bg-background dark:hover:bg-surface-hover font-bold"
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
      <div className="space-y-3 pt-4 border-t border-border dark:border-border">
        <label className="block text-xs font-black text-danger-700 dark:text-danger-400 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Ban className="w-4 h-4" />
            <span>🚫 NGレーン設定 (最大2つまで)</span>
          </span>
          <span className="text-[11px] text-muted-strong normal-case font-bold">
            バランサーがこのレーンへの配置を回避します
          </span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {ROLES.filter((r) => r.id !== "ALL").map((r) => {
            const Icon = r.icon;
            const isNg = ngRoles.includes(r.id);
            return (
              <button
                key={`ng-${r.id}`}
                type="button"
                onClick={() => toggleNgRole(r.id)}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  isNg
                    ? "bg-danger-500 text-white font-black shadow-md border-danger-edge-strong scale-[1.02]"
                    : "bg-surface dark:bg-surface border-border dark:border-border text-muted hover:border-border hover:bg-background dark:hover:bg-surface-hover font-bold"
                }`}
              >
                <Ban className={`w-4 h-4 ${isNg ? "text-white" : "text-faint"}`} />
                <Icon className="w-4 h-4" />
                <span className="text-xs">{r.name}</span>
              </button>
            );
          })}
        </div>
        {ngRoles.length > 0 && (
          <p className="text-[11px] text-danger-600 dark:text-danger-400 font-bold">
            現在設定中のNGレーン: {ngRoles.join(", ")}
          </p>
        )}
      </div>

      {/* 🎚️ こだわり度・格上許可（チーム分けに反映） */}
      <div className="space-y-4 pt-4 border-t border-border dark:border-border">
        <div className="space-y-2">
          <label className="block text-xs font-black text-foreground-subtle uppercase tracking-wider">
            🎚️ 希望レーンの強さ
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: 1, title: "絶対このレーン", desc: "希望レーン以外はできるだけ避けたい" },
              { v: 2, title: "できれば", desc: "なるべく希望レーン（標準）" },
              { v: 3, title: "どこでもOK", desc: "チームのためならどこでも入ります" },
            ].map((o) => (
              <button
                key={`w-${o.v}`}
                type="button"
                onClick={() => setWeight(o.v)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  weight === o.v
                    ? "bg-primary-500 text-stone-950 border-primary-edge-strong font-black shadow-md"
                    : "bg-surface border-border text-muted hover:bg-background font-bold"
                }`}
              >
                <div className="text-sm">{o.title}</div>
                <div className={`text-[10px] mt-0.5 leading-snug ${weight === o.v ? "text-stone-900" : "text-muted-strong"}`}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black text-foreground-subtle uppercase tracking-wider">
            ⚔️ 格上との対面
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { v: false, title: "🛡️ 守ってほしい", desc: "MMRが大きく上の人とは、なるべくレーンで当たらないようにします" },
              { v: true, title: "⚔️ 挑戦したい", desc: "格上の人ともレーンで当たってかまいません" },
            ].map((o) => (
              <button
                key={`ah-${String(o.v)}`}
                type="button"
                onClick={() => setAllowHigher(o.v)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  allowHigher === o.v
                    ? "bg-primary-500 text-stone-950 border-primary-edge-strong font-black shadow-md"
                    : "bg-surface border-border text-muted hover:bg-background font-bold"
                }`}
              >
                <div className="text-sm">{o.title}</div>
                <div className={`text-[10px] mt-0.5 leading-snug ${allowHigher === o.v ? "text-stone-900" : "text-muted-strong"}`}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 🎯 プレイスタイル設定 */}
      <div className="space-y-3 pt-4 border-t border-border dark:border-border">
        <label className="block text-xs font-black text-secondary-700 dark:text-secondary-400 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-secondary-500" />
            <span>🎯 プレイスタイル ＆ 志向性ロール設定（複数選択OK）</span>
          </span>
          <span className="text-[11px] text-muted-strong normal-case font-bold">
            タップで即時反映・Discordロールが自動で切り替わります
          </span>
        </label>
        <p className="text-[11px] text-muted-strong">
          今の気分や参加スタイルに合わせて自由にON/OFFできます。Discordサーバー内の募集や交流でアイコンが表示されます。
        </p>
        {notInServer && (
          <p className="text-[11px] font-bold rounded-lg border px-3 py-2 bg-danger-100 text-danger-700 border-danger-edge-soft">
            KTM の Discord サーバーに参加していないため、プレイスタイルは設定できません（サーバーに参加すると使えます）
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {PLAYSTYLE_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = !!playstyles[item.key];
            const isToggling = togglingPlaystyle === item.key;
            return (
              <button
                key={`ps-${item.key}`}
                type="button"
                onClick={() => togglePlaystyle(item.key)}
                disabled={isToggling || notInServer}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? `${item.activeColor} border font-black shadow-md scale-[1.01]`
                    : "bg-surface dark:bg-surface border-border dark:border-border text-muted hover:border-border hover:bg-background dark:hover:bg-surface-hover font-bold opacity-75 hover:opacity-100"
                }`}
              >
                <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${isActive ? "bg-black/10 dark:bg-white/10" : "bg-black/5 dark:bg-white/5 text-faint"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black tracking-tight">{item.label}</span>
                    {isActive ? (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-foreground dark:text-white">ON</span>
                    ) : (
                      <span className="text-[10px] text-faint font-bold">OFF</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-strong mt-0.5 leading-snug line-clamp-2">
                    {item.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 🌙 外観・ダークモード設定 */}
      <div className="bg-background/80 dark:bg-surface/80 border border-border/80 dark:border-border rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-black">
              <Moon size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground dark:text-white">外観・テーマ設定</h3>
              <p className="text-[11px] text-muted-strong">ライトモード・スレート調ダークモード・OS自動連動を切り替えられます</p>
            </div>
          </div>
          <ThemeToggle variant="full" />
        </div>
      </div>

      {/* 保存ボタン & 通知 */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border dark:border-border">
        <div>
          {saveSuccess && (
            <div className="flex items-center gap-2 text-success-700 dark:text-success-400 text-xs font-black animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>設定を正常に保存しました！次回のカスタムから即時反映されます。</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-danger-700 dark:text-danger-400 text-xs font-black animate-fade-in">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 disabled:opacity-50 transition-all cursor-pointer"
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
