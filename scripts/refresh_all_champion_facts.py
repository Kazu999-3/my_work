import os
import sys
import re
import datetime
from pathlib import Path
from dotenv import load_dotenv
import requests

# Windows cp932対策
if sys.platform == "win32":
    import io
    if not getattr(sys.stdout, "_custom_utf8", False):
        try:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stdout._custom_utf8 = True
        except Exception:
            pass

ROOT_DIR = Path("d:/my_work")
for env_file in [ROOT_DIR / "04_PORTAL" / ".env.local", ROOT_DIR / "04_PORTAL" / ".env", ROOT_DIR / ".env"]:
    if env_file.exists():
        load_dotenv(env_file)
        break

url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not url or not key:
    print("No Supabase credentials")
    sys.exit(1)

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Range": "0-999"
}

# 文字化け修復用マスター辞書（確定データ）
GARBLED_FIXES = {
    "Graves": {
        "strengths": "E（クイックドロー）による物理防御（AR）の上昇と、ノックバック付き通常攻撃による高いジャングル周回健全性。煙幕（W）による視界遮断と高い引き撃ち（カイト）性能。",
        "weaknesses": "魔法防御が上昇しないためAPバーストに弱い。射程が短くミニオンや中立モンスターに通常攻撃が遮られる。ハードCCを持たないため味方のエンゲージに依存する。",
        "strategy": "序盤からEのスタックを維持して高ARを保ち、敵ジャングラーへの積極的な侵入（インベード）やカウンタージャングルで差をつける。集団戦では煙幕で敵キャリーの視界を奪い、引き撃ちで前衛から溶かす。"
    },
    "Kindred": {
        "strengths": "パッシブ（キンドレッドの刻印）による射程・攻撃力無限スケーリング。Qの短CDブリンクとWの領域展開による優れたカイト能力。R（羊の果てぬ救済）による絶対的延命と集団戦リセット。",
        "weaknesses": "序盤のマーク獲得に失敗するとスケーリングが遅れる。耐久力が極めて低くアサシンの急襲に弱い。Rの使い所を誤ると敵を救命してしまうハイリスク性。",
        "strategy": "マーク出現位置（スカトル、ラプター、グロンプ等）を先読みし、味方レーンの主導権（Prio）があるタイミングで確実に回収する。集団戦では後方からカイトし、敵の即死コンボに合わせてRを発動、終了直前にE3段目で敵を処刑する。"
    },
    "Maokai": {
        "strengths": "パッシブ（樹液吸収）による高い回復力。W（樹根拘束）の対象指定不可長距離拘束。Eの苗木によるブッシュ視界確保とゾーン制圧。R（大地の捕縛）による超広範囲エンゲージ。",
        "weaknesses": "序盤のタイマン性能が低くインベードに弱い。機動力が低くスキルを回避しづらい。マナ消費が重く息切れしやすい。",
        "strategy": "苗木（E）で敵の侵入ルートやオブジェクト周辺の視界を制圧。集団戦ではRを先撃ちして敵陣形を崩し、Wで敵主要キャリーを拘束して味方にフォーカスさせる。"
    },
    "Rammus": {
        "strengths": "W（アーマードシェル）とパッシブによる対物理（AD）最強の硬さ。Q（ころがる）による圧倒的な巡回速度。Eの挑発による確定行動不能。",
        "weaknesses": "魔法ダメージ（AP）に非常に弱い。序盤のクリア速度が遅い。ミニオンや障害物でQが止められる。",
        "strategy": "敵チームがAD偏重の際に最強のカウンターピック。Qで加速して敵のワード視界外から急襲し、Eの挑発とWの棘ダメージで敵ADCを自滅させる。"
    },
    "Cassiopeia": {
        "strengths": "毒状態の敵に対するE（ツインファング）の圧倒的持続DPS。W（ミアズマ）による移動スキル完全封殺（グラウンデッド）。Rの石化による集団戦反転。",
        "weaknesses": "靴を購入できないため序盤の移動速度が遅い。マナ消費が極めて重い。ブリンクがなくガンクに弱い。",
        "strategy": "Qで毒を付与し、移動速度バフを得ながらEを連射してトレード。集団戦では敵の突進ルートにWを敷いてブリンクを封じ、接近してきた敵をRで石化させて殲滅する。"
    },
    "Heimerdinger": {
        "strengths": "H-28Gタレット3基による絶対的エリア制圧とタワー防衛。Eのスタン/スロウによる自衛。強化タレット（R-Q）による高いDPS。",
        "weaknesses": "タレットを破壊されると戦闘力が半減する。本体の基礎耐久と機動力が極めて低い。長射程ポークに弱い。",
        "strategy": "あらかじめ三角形にタレットを配置して陣地を構築。敵がガンクに来た場合はタレットの射程内でEスタンを当て、R強化スキルで返り討ちにする。"
    }
}

def clean_strategy_text(text: str) -> str:
    """重複した【追記知見】を統合し、整理された単一の文章に再構成"""
    if not text:
        return text

    parts = text.split("【追記知見】")
    main_part = parts[0].strip()
    notes = [p.strip() for p in parts[1:] if p.strip()]

    if not notes:
        return main_part

    unique_notes = []
    seen = set()
    for n in notes:
        clean_key = re.sub(r"\s+", "", n)[:30]
        if clean_key not in seen and len(n) > 5:
            seen.add(clean_key)
            unique_notes.append(n)

    selected_notes = unique_notes[:3]
    cleaned = main_part
    if selected_notes:
        cleaned += "\n\n【実戦要点メモ】\n" + "\n".join(f"・{note.rstrip('。')}。" for note in selected_notes)

    return cleaned

def run_refresh_pipeline():
    print("=" * 65)
    print(" Sovereign OS チャンピオン辞典 全系一括リフレッシュ・パイプライン")
    print("=" * 65)

    res = requests.get(f"{url}/rest/v1/champion_facts?select=*", headers=headers)
    if res.status_code != 200:
        print(f"Failed to fetch data: {res.status_code}")
        return

    rows = res.json()
    total = len(rows)
    print(f"走査対象: 全 {total} 件\n")

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    updated_patch_count = 0
    cleaned_strategy_count = 0
    fixed_garbled_count = 0

    for row in rows:
        champ = row.get("champion")
        if not champ:
            continue

        updates = {}
        row_updated = False

        # 1. パッチ番号の最新化 (26.17 ➔ 26.18)
        current_patch = row.get("patch")
        if current_patch != "26.18":
            updates["patch"] = "26.18"
            updated_patch_count += 1
            row_updated = True

        # 2. 【追記知見】の多重重複クリーン化
        strategy = row.get("strategy") or ""
        if strategy.count("【追記知見】") >= 2:
            new_strategy = clean_strategy_text(strategy)
            if new_strategy != strategy:
                updates["strategy"] = new_strategy
                cleaned_strategy_count += 1
                row_updated = True

        # 3. 文字化け修復
        if champ in GARBLED_FIXES:
            fix_data = GARBLED_FIXES[champ]
            for field, fix_val in fix_data.items():
                curr_val = row.get(field) or ""
                if "\ufffd" in curr_val or "?" * 4 in curr_val or len(curr_val) < 20:
                    updates[field] = fix_val
                    row_updated = True
            if row_updated and any(k in updates for k in fix_data):
                fixed_garbled_count += 1

        # DB反映
        if row_updated:
            updates["updated_at"] = now
            up_res = requests.patch(
                f"{url}/rest/v1/champion_facts?champion=eq.{champ}",
                headers=headers,
                json=updates
            )
            if up_res.status_code in [200, 204]:
                print(f"  [OK] {champ}: updated {len(updates)} fields")
            else:
                print(f"  [FAILED] {champ}: {up_res.status_code} {up_res.text}")

    print("\n" + "-" * 65)
    print(" 全系一括リフレッシュ完了レポート:")
    print(f"  - 最新パッチ (26.18) 同期件数    : {updated_patch_count} 件")
    print(f"  - 重複【追記知見】のクリーン化  : {cleaned_strategy_count} 件")
    print(f"  - 文字化けの完全修復             : {fixed_garbled_count} 件")
    print("=" * 65)

if __name__ == "__main__":
    run_refresh_pipeline()
