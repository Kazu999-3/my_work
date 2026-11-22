"use client";

import { useState, useEffect } from "react";
import { 
  Shield, Trees, Zap, Target, Heart, Shuffle, Ban, 
  Save, CheckCircle2, AlertTriangle, RefreshCw, Moon,
  Swords, Users, Snowflake, Coffee, BookOpen, Sparkles,
  Coins, X
} from "lucide-react";
import ThemeToggle from "../../components/ThemeToggle";
import { getPlayerTierBand, normalizeTierPromotionPref, TIER_BAND_THRESHOLD, type TierPromotionPref } from "../../lib/balancer/tierBand";

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
  // 希望レーンの強さ（1:絶対このレーン / 2:できれば / 3:どこでもOK）と対面保護・帯繰り上げ設定
  const [weight, setWeight] = useState<number>([1, 2, 3].includes(Number(player?.weight)) ? Number(player?.weight) : 2);
  const [allowHigher, setAllowHigher] = useState<boolean>(!!player?.allow_higher);
  // 定期カスタムの帯繰り上げ設定（2026-11-22 SPEC 10）
  const [tierPromotionPref, setTierPromotionPref] = useState<TierPromotionPref>(
    normalizeTierPromotionPref(player?.tier_promotion_pref)
  );

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
      setTierPromotionPref(normalizeTierPromotionPref(player.tier_promotion_pref));
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

  // SPEC 18 (v4): レーンごとの4択（「第1希望」「第2希望」「どちらでも」「NG」）の整合性制御
  // 別のレーンを第1希望にした場合、元の第1希望は自動で「どちらでも」(ALL) に戻す
  type LaneChoice = "PRIMARY" | "SECONDARY" | "ANY" | "NG";
  const getLaneChoice = (roleId: string): LaneChoice => {
    if (primaryRole === roleId) return "PRIMARY";
    if (secondaryRole === roleId) return "SECONDARY";
    if (ngRoles.includes(roleId)) return "NG";
    return "ANY";
  };

  const setLaneChoice = (roleId: string, choice: LaneChoice) => {
    if (choice === "PRIMARY") {
      setPrimaryRole(roleId);
      if (secondaryRole === roleId) setSecondaryRole("ALL");
      if (ngRoles.includes(roleId)) setNgRoles(ngRoles.filter((r) => r !== roleId));
      return;
    }
    if (choice === "SECONDARY") {
      setSecondaryRole(roleId);
      if (primaryRole === roleId) setPrimaryRole("ALL");
      if (ngRoles.includes(roleId)) setNgRoles(ngRoles.filter((r) => r !== roleId));
      return;
    }
    if (choice === "NG") {
      if (roleId === "ALL") return;
      if (primaryRole === roleId) setPrimaryRole("ALL");
      if (secondaryRole === roleId) setSecondaryRole("ALL");
      if (!ngRoles.includes(roleId)) {
        toggleNgRole(roleId);
      }
      return;
    }
    // ANY（どちらでも）
    if (primaryRole === roleId) setPrimaryRole("ALL");
    if (secondaryRole === roleId) setSecondaryRole("ALL");
    if (ngRoles.includes(roleId)) setNgRoles(ngRoles.filter((r) => r !== roleId));
  };

  const roleLabel = (id: string) => ROLES.find((r) => r.id === id)?.name || id;
  const weightLabel = weight === 1 ? "絶対このレーン" : weight === 3 ? "どこでもOK" : "できれば";
  const higherLabel = allowHigher ? "格上対面OK" : "格上との対面を避ける";
  const tierLabel =
    tierPromotionPref === "mix_ok"
      ? "上の帯に混ざってもいい"
      : tierPromotionPref === "never"
      ? "自分の帯のみ"
      : "人不足なら上の帯OK";
  const isUnsetCustom =
    !prefs.primary &&
    !prefs.secondary &&
    ngRoles.length === 0 &&
    primaryRole === "ALL" &&
    secondaryRole === "ALL";
  const hasUnsavedChanges =
    primaryRole !== toAll(prefs.primary) ||
    secondaryRole !== toAll(prefs.secondary) ||
    JSON.stringify(ngRoles) !== JSON.stringify(prefs.ng_roles || [player?.ng_lane_1, player?.ng_lane_2].filter(Boolean)) ||
    ign !== (player?.ign || "") ||
    weight !== ([1, 2, 3].includes(Number(player?.weight)) ? Number(player?.weight) : 2) ||
    allowHigher !== !!player?.allow_higher ||
    tierPromotionPref !== normalizeTierPromotionPref(player?.tier_promotion_pref);

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
          tier_promotion_pref: tierPromotionPref,
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

  // 読み込み中（スケルトン）状態
  if (!player) {
    return (
      <div className="bg-surface/80 dark:bg-background/80 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-pulse">
        <div className="h-6 w-56 rounded-xl bg-black/10 dark:bg-white/10" />
        <div className="h-16 rounded-2xl bg-black/5 dark:bg-white/5" />
        <div className="h-64 rounded-2xl bg-black/5 dark:bg-white/5" />
        <div className="h-48 rounded-2xl bg-black/5 dark:bg-white/5" />
      </div>
    );
  }

  return (
    <div className="bg-surface/80 dark:bg-background/80 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-3xl p-4 sm:p-8 shadow-xl space-y-6">
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

              <div className="pt-1 flex items-center gap-2 text-xs text-primary-800 dark:text-primary-300 font-bold">
                <span>👉 まずは下の「🎯 レーンのこと」から設定してみましょう！</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー ＆ 「今のあなたの設定」ライブ要約 */}
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-black text-foreground dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-600" />
            <span>カスタム参加設定 ＆ アカウント設定</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-strong font-medium mt-1">
            上から順に設定するだけで、定期カスタムのチーム分けと帯編成に反映されます。
          </p>
        </div>

        {/* 未設定（空）状態の案内 */}
        {isUnsetCustom && (
          <div className="rounded-2xl border border-primary-500/40 bg-primary-500/10 px-4 py-3 text-xs text-primary-900 dark:text-primary-200 font-bold">
            ✨ まだ希望レーンが設定されていません（現在はすべて「おまかせ(ALL)」）。まずは「🎯 レーンのこと」から設定してみてください。
          </div>
        )}

        {/* 今のあなたの設定（要約文） */}
        <div className="rounded-2xl border border-border bg-surface-subtle/80 px-4 py-3 space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-black text-foreground-subtle uppercase tracking-wider">
              📋 今のあなたの設定
            </span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                hasUnsavedChanges
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40"
                  : "bg-success-500/15 text-success-700 dark:text-success-300 border-success-500/30"
              }`}
            >
              {hasUnsavedChanges ? "未保存の変更あり（最下部の保存ボタンで反映）" : "保存済み"}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-black text-foreground leading-relaxed">
            第1希望: {roleLabel(primaryRole)} ／ 第2希望: {roleLabel(secondaryRole)} ／ NG:{" "}
            {ngRoles.length > 0 ? ngRoles.map(roleLabel).join("・") : "なし"} ／ レーンの強さ: {weightLabel} ／{" "}
            {higherLabel} ／ {tierLabel}
          </p>
          <p className="text-[11px] text-muted-strong">
            💡 「🎯 レーンのこと」「⚔️ 格上との関わり方」および下の IGN は、最下部の<strong>「設定を保存する」ボタン</strong>で保存されます（プレイスタイル・外観テーマのみタップで即時反映）。
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          カード1: 🎯 レーンのこと
         ═══════════════════════════════════════════════════════════════ */}
      <section className="rounded-3xl border border-border bg-background/70 dark:bg-surface/60 p-4 sm:p-6 space-y-5 shadow-xs">
        <div className="space-y-1 border-b border-border/70 pb-3">
          <h3 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
            <span>🎯 レーンのこと</span>
          </h3>
          <p className="text-xs text-muted-strong">
            どのレーンで遊びたいか・避けたいかの設定です。チーム分けバランサーで優先的に割り振られます。
          </p>
        </div>

        {/* 軸で選ぶUI: 縦軸=レーン / 横軸=希望の強さ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-black text-foreground-subtle">
              希望レーン表（縦：レーン ／ 横：希望）
            </div>
            <div className="text-[11px] text-muted-strong font-bold">
              第1・第2希望は各1つ／NGは最大2つ（別レーンを選ぶと前のレーンは「どちらでも」に戻ります）
            </div>
          </div>

          <div className="space-y-2">
            {/* PC向け列ヘッダー */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 text-[11px] font-black text-muted-strong">
              <div className="col-span-4">レーン</div>
              <div className="col-span-2 text-center">⭐ 第1希望</div>
              <div className="col-span-2 text-center">🥈 第2希望</div>
              <div className="col-span-2 text-center">➖ どちらでも</div>
              <div className="col-span-2 text-center">🚫 NG</div>
            </div>

            {ROLES.filter((r) => r.id !== "ALL").map((r) => {
              const Icon = r.icon;
              const choice = getLaneChoice(r.id);
              const buttons: { key: LaneChoice; label: string; activeCls: string }[] = [
                {
                  key: "PRIMARY",
                  label: "第1希望",
                  activeCls: "bg-primary-500 text-stone-950 border-primary-edge-strong font-black shadow-sm",
                },
                {
                  key: "SECONDARY",
                  label: "第2希望",
                  activeCls: "bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-200 font-black shadow-sm",
                },
                {
                  key: "ANY",
                  label: "どちらでも",
                  activeCls: "bg-surface-subtle text-foreground border-border-strong font-black",
                },
                {
                  key: "NG",
                  label: "NG",
                  activeCls: "bg-danger-500 text-white border-danger-edge-strong font-black shadow-sm",
                },
              ];

              return (
                <div
                  key={`lane-row-${r.id}`}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-2xl border border-border bg-surface p-2.5 sm:px-3 sm:py-2"
                >
                  <div className="sm:col-span-4 flex items-center justify-between sm:justify-start gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-xl border ${r.color}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-xs sm:text-sm font-black text-foreground">{r.name}</span>
                    </div>
                    <span className="sm:hidden text-[10px] font-black px-2 py-0.5 rounded-full bg-surface-subtle border border-border text-foreground-subtle">
                      選択中:{" "}
                      {choice === "PRIMARY"
                        ? "第1希望"
                        : choice === "SECONDARY"
                        ? "第2希望"
                        : choice === "NG"
                        ? "NG"
                        : "どちらでも"}
                    </span>
                  </div>

                  <div className="sm:col-span-8 grid grid-cols-4 gap-1.5">
                    {buttons.map((b) => {
                      const isSelected = choice === b.key;
                      return (
                        <button
                          key={`${r.id}-${b.key}`}
                          type="button"
                          onClick={() => setLaneChoice(r.id, b.key)}
                          aria-pressed={isSelected}
                          className={`min-h-[40px] px-1.5 py-1.5 rounded-xl border text-[11px] sm:text-xs transition cursor-pointer flex items-center justify-center gap-1 ${
                            isSelected
                              ? b.activeCls
                              : "bg-background/60 border-border text-muted hover:bg-surface-hover font-bold"
                          }`}
                        >
                          {isSelected && <span aria-hidden="true">✓</span>}
                          <span>{b.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* おまかせ(ALL) の切り替え行 */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-2xl border border-dashed border-border bg-surface-subtle/50 p-2.5 sm:px-3 sm:py-2">
              <div className="sm:col-span-4 flex items-center gap-2">
                <span className="p-1.5 rounded-xl border text-muted border-stone-500/40 bg-stone-500/10">
                  <Shuffle className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-xs font-black text-foreground block">おまかせ(ALL)</span>
                  <span className="text-[10px] text-muted-strong">空いているレーンどこでもOK</span>
                </div>
              </div>
              <div className="sm:col-span-8 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPrimaryRole("ALL")}
                  aria-pressed={primaryRole === "ALL"}
                  className={`min-h-[40px] px-2 py-1.5 rounded-xl border text-[11px] sm:text-xs transition cursor-pointer ${
                    primaryRole === "ALL"
                      ? "bg-primary-500 text-stone-950 border-primary-edge-strong font-black shadow-sm"
                      : "bg-surface border-border text-muted hover:bg-surface-hover font-bold"
                  }`}
                >
                  {primaryRole === "ALL" ? "✓ 第1希望をおまかせ中" : "第1希望をおまかせにする"}
                </button>
                <button
                  type="button"
                  onClick={() => setSecondaryRole("ALL")}
                  aria-pressed={secondaryRole === "ALL"}
                  className={`min-h-[40px] px-2 py-1.5 rounded-xl border text-[11px] sm:text-xs transition cursor-pointer ${
                    secondaryRole === "ALL"
                      ? "bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-200 font-black shadow-sm"
                      : "bg-surface border-border text-muted hover:bg-surface-hover font-bold"
                  }`}
                >
                  {secondaryRole === "ALL" ? "✓ 第2希望をおまかせ中" : "第2希望をおまかせにする"}
                </button>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-strong leading-relaxed">
            💡 例：第1希望を「ジャングル」、NGを「サポート」にすると、JGが優先され、SUPには原則割り当てられません（NGは2つ選んだ状態で3つ目を押すと古い方が自動で外れます）。
          </p>
        </div>

        {/* 希望レーンの強さ（ボタン形式） */}
        <div className="space-y-2 pt-3 border-t border-border/70">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <label className="block text-xs font-black text-foreground-subtle">
              🎚️ 希望レーンの強さ
            </label>
            <span className="text-[11px] text-muted-strong font-bold">
              例：「絶対このレーン」にすると他メンバーと被っても希望レーンを優先します
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { v: 1, title: "絶対このレーン", desc: "希望レーン以外はできるだけ避けたい" },
              { v: 2, title: "できれば", desc: "なるべく希望レーン（標準）" },
              { v: 3, title: "どこでもOK", desc: "チームのためならどこでも入ります" },
            ].map((o) => {
              const isSelected = weight === o.v;
              return (
                <button
                  key={`w-${o.v}`}
                  type="button"
                  onClick={() => setWeight(o.v)}
                  aria-pressed={isSelected}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary-500 text-stone-950 border-primary-edge-strong font-black shadow-sm"
                      : "bg-surface border-border text-muted hover:bg-background font-bold"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-sm">
                    <span>{o.title}</span>
                    {isSelected && <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-black/15">選択中</span>}
                  </div>
                  <div className={`text-[10px] mt-0.5 leading-snug ${isSelected ? "text-stone-900" : "text-muted-strong"}`}>{o.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          カード2: ⚔️ 格上との関わり方（2軸グリッド）
         ═══════════════════════════════════════════════════════════════ */}
      <section className="rounded-3xl border border-border bg-background/70 dark:bg-surface/60 p-4 sm:p-6 space-y-4 shadow-xs">
        <div className="space-y-1 border-b border-border/70 pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <span>⚔️ 格上との関わり方</span>
            </h3>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-surface border border-border text-muted-strong">
              現在の帯:{" "}
              {getPlayerTierBand(player?.mmr) === "UPPER"
                ? `上位帯 (MMR ${TIER_BAND_THRESHOLD}+)`
                : `中初級帯 (MMR <${TIER_BAND_THRESHOLD})`}
            </span>
          </div>
          <p className="text-xs text-muted-strong">
            同じ試合で実力が上の人と対面するか（縦軸）と、上の帯の部屋に繰り上がるか（横軸）をマス目で同時に選べます。
          </p>
        </div>

        <div className="text-[11px] text-muted-strong leading-relaxed bg-surface-subtle/70 rounded-xl px-3 py-2 border border-border/60">
          💡 定期カスタムは Portal MMR {TIER_BAND_THRESHOLD} を境に「上位帯」と「中初級帯」に分かれます。
          <strong> 縦軸（対面保護）</strong>は同じ試合の中で誰と対面になるか、<strong>横軸（帯の繰り上げ）</strong>は中初級帯の人が上の帯の試合に入るかどうかを決めます。
        </div>

        {/* 2軸グリッド（PC: 2行×3列マトリクス / 狭幅375px: 縦軸ごとに3択ボタン） */}
        <div className="space-y-3">
          {/* PC向け横軸ヘッダー */}
          <div className="hidden md:grid md:grid-cols-12 gap-2 px-1 text-[11px] font-black text-foreground-subtle">
            <div className="col-span-3 flex items-end pb-1">縦：対面 ＼ 横：上の帯</div>
            <div className="col-span-3 text-center bg-surface-subtle rounded-xl py-1.5 px-2 border border-border/60">
              🌟 混ざってもいい
              <span className="block text-[10px] font-normal text-muted-strong">上の帯へ積極的に繰り上げ</span>
            </div>
            <div className="col-span-3 text-center bg-surface-subtle rounded-xl py-1.5 px-2 border border-border/60">
              🤝 人不足ならOK
              <span className="block text-[10px] font-normal text-muted-strong">上の帯が10人未満の時だけ（既定）</span>
            </div>
            <div className="col-span-3 text-center bg-surface-subtle rounded-xl py-1.5 px-2 border border-border/60">
              🔒 自分の帯のみ
              <span className="block text-[10px] font-normal text-muted-strong">上の帯には繰り上がらない</span>
            </div>
          </div>

          {(
            [
              {
                allow: false,
                rowTitle: "🛡️ 格上対面を避ける",
                rowDesc: "同じ試合でMMRが大きく上の人とは別レーンにします",
              },
              {
                allow: true,
                rowTitle: "⚔️ 格上対面もOK",
                rowDesc: "同じ試合で実力が上の人と対面になっても構いません",
              },
            ] as const
          ).map((row) => (
            <div
              key={`ah-row-${String(row.allow)}`}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 items-stretch rounded-2xl border border-border bg-surface p-3"
            >
              <div className="md:col-span-3 flex flex-col justify-center pr-1">
                <div className="text-xs sm:text-sm font-black text-foreground">{row.rowTitle}</div>
                <div className="text-[10px] text-muted-strong leading-snug mt-0.5">{row.rowDesc}</div>
              </div>

              <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    { v: "mix_ok", title: "🌟 混ざってもいい", desc: "上の帯へ積極的に参加" },
                    { v: "fill_only", title: "🤝 人不足ならOK", desc: "10人未満の時だけ参加（既定）" },
                    { v: "never", title: "🔒 自分の帯のみ", desc: "自分の帯にのみ参加" },
                  ] as const
                ).map((col) => {
                  const isSelected = allowHigher === row.allow && tierPromotionPref === col.v;
                  return (
                    <button
                      key={`cell-${String(row.allow)}-${col.v}`}
                      type="button"
                      onClick={() => {
                        setAllowHigher(row.allow);
                        setTierPromotionPref(col.v);
                      }}
                      aria-pressed={isSelected}
                      className={`min-h-[56px] p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-primary-500 text-stone-950 border-primary-edge-strong font-black shadow-sm"
                          : "bg-background/70 border-border text-muted hover:bg-surface-hover font-bold"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-xs">
                        <span>{col.title}</span>
                        {isSelected && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-black/15 shrink-0">
                            ✓ 選択中
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] mt-1 leading-snug ${isSelected ? "text-stone-900" : "text-muted-strong"}`}>
                        {col.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          カード3: 🎨 その他の設定（カスタムのチーム分け以外）
         ═══════════════════════════════════════════════════════════════ */}
      <section className="rounded-3xl border border-border bg-background/70 dark:bg-surface/60 p-4 sm:p-6 space-y-6 shadow-xs">
        <div className="space-y-1 border-b border-border/70 pb-3">
          <h3 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
            <span>🎨 その他の設定</span>
          </h3>
          <p className="text-xs text-muted-strong">
            アカウント名（Riot ID）やDiscordのプレイスタイル、画面の明るさなど、チーム分け以外の設定です。
          </p>
        </div>

        {/* サモナーネーム（IGN）入力 */}
        <div className="bg-surface border border-border rounded-2xl p-4 space-y-2">
          <label className="block text-xs font-black text-foreground-subtle uppercase tracking-wider">
            ゲーム内サモナーネーム (IGN#TAG)
          </label>
          <input
            type="text"
            value={ign}
            onChange={(e) => setIgn(e.target.value)}
            placeholder="例: Hide on bush#KR1"
            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground dark:text-white font-mono placeholder:text-faint focus:outline-none focus:border-primary-edge-strong focus:ring-1 focus:ring-primary-500 shadow-xs"
          />
          <p className="text-[11px] text-faint font-medium">
            ※ Riot ID とタグライン（#JP1など）を入力すると戦績連携が有効になります（変更後は最下部の「設定を保存する」で保存）。
            {player?.discord_id && (
              <span className="block mt-0.5 text-muted-strong">
                連携中 Discord ID: <code className="font-mono">{player.discord_id}</code>
              </span>
            )}
          </p>
        </div>

        {/* プレイスタイルロール設定（タップで即時反映） */}
        <div className="space-y-3 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-1.5 text-xs font-black text-secondary-700 dark:text-secondary-400">
              <Sparkles className="w-4 h-4 text-secondary-500" />
              <span>プレイスタイル ＆ 志向性ロール（複数選択OK）</span>
            </span>
            <span className="text-[11px] text-muted-strong font-bold">
              {loadingPlaystyle ? "読み込み中..." : "タップで即時反映・Discordロールと連動"}
            </span>
          </div>
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
                      ? `${item.activeColor} border font-black shadow-sm`
                      : "bg-surface border-border text-muted hover:bg-background font-bold opacity-85 hover:opacity-100"
                  }`}
                >
                  <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${isActive ? "bg-black/10 dark:bg-white/10" : "bg-black/5 dark:bg-white/5 text-faint"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black tracking-tight">{item.label}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10">
                        {isActive ? "ON" : "OFF"}
                      </span>
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

        {/* 外観・テーマ設定 */}
        <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-black shrink-0">
              <Moon size={18} />
            </div>
            <div>
              <h4 className="text-sm font-black text-foreground dark:text-white">外観・テーマ設定</h4>
              <p className="text-[11px] text-muted-strong">ライトモード・ダークモード・OS自動連動を即時切り替えできます</p>
            </div>
          </div>
          <ThemeToggle variant="full" />
        </div>
      </section>

      {/* 保存ボタン & 通知（エラー時は選択を保持して再試行可能） */}
      <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border">
        <div className="w-full sm:w-auto">
          {saveSuccess && (
            <div className="flex items-center gap-2 text-success-700 dark:text-success-400 text-xs font-black transition-opacity">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>設定を保存しました！次回のカスタム編成から反映されます。</span>
            </div>
          )}
          {error && (
            <div className="flex flex-wrap items-center gap-2 text-danger-700 dark:text-danger-400 text-xs font-black">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}（入力中の選択はそのまま残っています）</span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-2.5 py-1 rounded-lg bg-danger-600 hover:bg-danger-700 text-white text-[11px] font-black cursor-pointer"
              >
                再試行する
              </button>
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
