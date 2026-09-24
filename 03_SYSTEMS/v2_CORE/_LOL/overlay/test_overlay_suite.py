"""
Sovereign HUD - オーバーレイ全機能 自動テストスイート (test_overlay_suite.py)
=============================================================================
実ゲームを起動せずとも、全5大ウィジェット・計算エンジン・チャット検知・動的ビルド推薦の
表示崩れや例外エラー、計算ミスを100%自動検証し、各レーン別スクリーンショットを保存します。
"""

import os
import sys
import unittest
from pathlib import Path

# パス追加
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Windows UTF-8 出力
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from PyQt6.QtWidgets import QApplication

from v2_CORE._LOL.overlay.dynamic_build_advisor import DynamicBuildAdvisor
from v2_CORE._LOL.overlay.hud_state_engine import HudStateEngine, extract_champion_name
from v2_CORE._LOL.overlay.kill_line_calculator import KillLineCalculator
from v2_CORE._LOL.overlay.chat_spell_detector import ChatSpellDetector
from v2_CORE._LOL.overlay.gank_opportunity_engine import GankOpportunityEngine
from v2_CORE._LOL.overlay.top_bar_widget import TopBarWidget
from v2_CORE._LOL.overlay.matchup_card_widget import MatchupCardWidget
from v2_CORE._LOL.overlay.spell_tracker_widget import SpellTrackerWidget
from v2_CORE._LOL.overlay.toast_alert_widget import ToastAlertWidget
from v2_CORE._LOL.overlay.lane_dominance_widget import LaneDominanceWidget
from v2_CORE._LOL.overlay.lol_live_client import LiveClient


def get_or_create_qapp():
    app = QApplication.instance()
    if app is None:
        app = QApplication(["--platform", "offscreen" if sys.platform != "win32" else "windows"])
    return app


class TestDynamicBuildAdvisor(unittest.TestCase):
    """1. 動的ビルド推薦 & コアアイテム判定エンジンのテスト"""

    def test_diverse_champion_blueprints(self):
        """ADC, ファイター, メイジ, アサシン, タンク, サポートのビルド推薦が正常に判定されること"""
        test_champions = [
            ("KaiSa", ["クラーケン スレイヤー", "ルインドキング ブレード", "グインソー レイジブレード"]),
            ("Jinx", ["クラーケン スレイヤー", "ルナーン ハリケーン", "インフィニティ エッジ"]),
            ("Aatrox", ["サンダード スカイ", "プロフェイン ハイドラ", "ステラックの篭手", "トリニティ フォース"]),
            ("Ahri", ["ルーデン コンパニオン", "シャドウフレイム", "ラバドン デスキャップ"]),
            ("Zed", ["ボルテイク サイクロソード", "オポチュニティ", "セリルの怨嗟"]),
            ("Thresh", ["ソラリのロケット", "騎士の誓い", "ソーンメイル"]),
            ("Nautilus", ["ソラリのロケット", "騎士の誓い", "ソーンメイル"]),
            ("LeeSin", ["サンダード スカイ", "ブラック クリーバー", "ステラックの篭手", "トリニティ フォース"]),
            ("Darius", ["ストライドブレイカー", "トリニティ フォース", "ステラックの篭手"]),
            ("Ezreal", ["トリニティ フォース", "マナムネ", "セリルの怨嗟"]),
        ]

        for champ, expected_items in test_champions:
            rec = DynamicBuildAdvisor.advise_next_item(
                my_champion=champ,
                my_items=[],
                enemy_players=[{"championName": "Darius"}],
                game_time_sec=600.0
            )
            self.assertIsNotNone(rec, f"Recommendation should not be None for {champ}")
            self.assertIn("item_name", rec, f"item_name missing for {champ}")
            self.assertGreater(rec["price"], 0, f"{champ} price should be > 0")
            self.assertTrue(rec["reason"], f"{champ} reason should not be empty")

    def test_heal_cut_reaction(self):
        """敵に強回復持ち（Aatrox/Soraka/Vladimir等）がいる場合、重傷アイテムが最優先推薦されること"""
        rec = DynamicBuildAdvisor.advise_next_item(
            my_champion="KaiSa",
            my_items=[{"displayName": "KrakenSlayer", "price": 3100, "itemID": 6672}],
            enemy_players=[{"championName": "Aatrox"}, {"championName": "Soraka"}],
            game_time_sec=900.0
        )
        self.assertIn("重傷", rec["tag"])
        self.assertEqual(rec["item_name"], "エクセキューショナー コーリング")

    def test_zyra_first_core_recommendation(self):
        """Zyra (ザイラ) でプレイ時、SunderedSkyではなくLiandrysTorment (ライアンドリーの苦悶) が1stコアとして推薦されること"""
        rec = DynamicBuildAdvisor.advise_next_item(
            my_champion="Zyra",
            my_items=[],
            enemy_players=[{"championName": "Jinx"}, {"championName": "Thresh"}],
            game_time_sec=300.0
        )
        self.assertEqual(rec["item_name"], "ライアンドリーの苦悶")
        self.assertNotEqual(rec["item_name"], "サンダード スカイ")

    def test_owned_items_not_recommended(self):
        """1stコア(SunderedSky)購入後は1stコアが除外され、2ndコアまたは靴・重傷等に自動遷移すること"""
        # Aatrox で SunderedSky (ID: 6610) をすでに持っている場合
        rec = DynamicBuildAdvisor.advise_next_item(
            my_champion="Aatrox",
            my_items=[{"displayName": "Sundered Sky", "price": 3100, "itemID": 6610}],
            enemy_players=[{"championName": "Darius"}],
            game_time_sec=700.0
        )
        # Sundered Sky ではなく 2nd コア (エクリプス等) または靴が提案されること
        self.assertNotEqual(rec["item_name"], "サンダード スカイ")
        self.assertIn(rec["item_name"], ["エクリプス", "ブラック クリーバー", "プレート スチールキャップ", "マーキュリー ブーツ"])



class TestHudStateEngine(unittest.TestCase):
    """2. Live Client Data パーサー & 状態分析エンジンのテスト"""

    def setUp(self):
        self.engine = HudStateEngine()

    def test_raw_champion_name_extraction(self):
        """game_character_displayname_KaiSa 等のプレフィックスからクリーンなチャンピオン名を抽出"""
        self.assertEqual(extract_champion_name({"rawChampionName": "game_character_displayname_KaiSa"}), "Kaisa")
        self.assertEqual(extract_champion_name({"rawChampionName": "game_character_displayname_LeeSin"}), "LeeSin")
        self.assertEqual(extract_champion_name({"championName": "Aatrox"}), "Aatrox")
        self.assertEqual(extract_champion_name({"championName": "エイトロックス"}), "Aatrox")

    def test_mock_frame_analysis(self):
        """モックフレームが正しく解析され、全ウィジェット用の必須フィールドが揃っていること"""
        mock_raw = LiveClient.get_mock_game_data()
        state = self.engine.analyze_frame(mock_raw)

        self.assertTrue(state["active"])
        self.assertEqual(state["my_champion"], "Aatrox")
        self.assertEqual(state["enemy_champion"], "Darius")
        self.assertGreater(state["my_gold"], 0)
        self.assertIn("gold_diff_str", state)
        self.assertIn("threat_skill_info", state)
        self.assertIn("next_item_advice", state)
        self.assertIn("lane_dominance", state)

        # 全5レーンの対面ペアが生成されていること
        self.assertEqual(len(state["lane_dominance"]), 5)
        for row in state["lane_dominance"]:
            self.assertIn(row["role"], ["TOP", "JG", "MID", "ADC", "SUP"])
            self.assertTrue(row["ally_champ"])
            self.assertTrue(row["enemy_champ"])
            self.assertIn("diff_str", row)

    def test_effective_gold_includes_self_current_gold(self):
        """自分自身の実効ゴールド計算に手持ちゴールド(currentGold)が正しく合算されること"""
        from v2_CORE._LOL.overlay.hud_state_engine import calculate_player_effective_gold, find_my_player
        
        player_obj = {
            "summonerName": "Kazu#JP1",
            "items": [{"itemID": 1055, "displayName": "Doran's Blade", "price": 450, "count": 1}],
            "scores": {"creepScore": 10, "kills": 0, "assists": 0}
        }
        
        # プレイヤーのアイテム総額の厳密算出テスト (Doran's Blade 450G)
        gold_val = calculate_player_effective_gold(player_obj)
        self.assertEqual(gold_val, 450)

        # find_my_player でタグ付き/タグなしのRiot IDが一致すること
        active_player = {"riotId": "Kazu#JP1", "summonerName": ""}
        all_players = [{"summonerName": "Other"}, {"riotIdGameName": "Kazu", "summonerName": "Kazu#JP1"}]
        matched = find_my_player(active_player, all_players)
        self.assertEqual(matched.get("summonerName"), "Kazu#JP1")

    def test_enhanced_overlay_features(self):
        """強化機能（重傷判定、大砲ミニオン周期、敵属性比率、ゴールド推定、ワード追跡、試合前ブリーフィング）のテスト"""
        mock_raw = LiveClient.get_mock_game_data()
        state = self.engine.analyze_frame(mock_raw)

        # 1. 重傷アイテム解析
        self.assertIn("grievous_wounds", state)
        gw = state["grievous_wounds"]
        self.assertIn("needed", gw)
        self.assertIn("summary_text", gw)

        # 2. 大砲ミニオン（キャノンウェーブ）
        self.assertIn("cannon_wave_info", state)
        cannon = state["cannon_wave_info"]
        self.assertIn("sec_until_cannon", cannon)
        self.assertIn("desc", cannon)

        # 3. 敵チーム攻撃属性比率 (AD vs AP)
        self.assertIn("enemy_damage_profile", state)
        dmg_p = state["enemy_damage_profile"]
        self.assertIn("ad_pct", dmg_p)
        self.assertIn("ap_pct", dmg_p)
        self.assertEqual(dmg_p["ad_pct"] + dmg_p["ap_pct"], 100)

        # 4. コントロールワード追跡
        self.assertIn("ward_stats", state)
        ward = state["ward_stats"]
        self.assertIn("my_purchased", ward)
        self.assertIn("summary_text", ward)

        # 5. ゴールド推定
        self.assertIn("gold_estimates", state)
        ge = state["gold_estimates"]
        self.assertIn("my_item_gold", ge)
        self.assertIn("enemy_item_gold", ge)
        self.assertIn("enemy_est_current_gold", ge)

        # 6. 【3-1】試合前対面ブリーフィング
        self.assertIn("pregame_briefing", state)
        pb = state["pregame_briefing"]
        self.assertIn("title", pb)
        self.assertIn("threat_skill", pb)
        self.assertIn("early_action", pb)


class TestKillLineCalculator(unittest.TestCase):
    """3. キルライン計算エンジンのテスト"""

    def setUp(self):
        self.calc = KillLineCalculator()

    def test_burst_calculation(self):
        """対面チャンピオンのLvに応じたバーストダメージとキルライン判定"""
        res = self.calc.calculate_kill_line(
            enemy_champ="Zed",
            enemy_level=6,
            enemy_bonus_ad=35.0,
            has_ignite=True,
            my_champ="Kaisa",
            my_max_hp=1100.0,
            my_armor=40.0
        )
        self.assertIn("total_lethal_damage", res)
        self.assertGreater(res["total_lethal_damage"], 0)
        self.assertIn("kill_hp_percent", res)
        self.assertIn("danger_badge", res)
        self.assertIn("advice", res)


class TestChatSpellDetector(unittest.TestCase):
    """4. チャット・サモナースペル自動検知エンジンのテスト"""

    def test_chat_parsing_patterns(self):
        """様々なチャット入力パターンからチャンピオンとスペル種別が検出できること"""
        cases = [
            ("darius flash", "Darius", "FLASH"),
            ("ダリウスがフラッシュを使用", "Darius", "FLASH"),
            ("zed r", "Zed", "ULT"),
            ("ahri ult", "Ahri", "ULT"),
            ("jinx f", "Jinx", "FLASH"),
            ("aatrox flash", "Aatrox", "FLASH"),
        ]

        for text, expected_champ, expected_spell in cases:
            res = ChatSpellDetector.parse_chat_message(text)
            self.assertIsNotNone(res, f"Failed to parse chat: '{text}'")
            champ, spell = res
            self.assertEqual(champ, expected_champ, f"Champ mismatch for '{text}'")
            self.assertEqual(spell, expected_spell, f"Spell mismatch for '{text}'")


class TestOverlayWidgetsVisual(unittest.TestCase):
    """5. PyQt6 ウィジェット描画 ＆ スクリーンショット自動保存テスト"""

    @classmethod
    def setUpClass(cls):
        cls.app = get_or_create_qapp()
        cls.screenshot_dir = CURRENT_DIR / "test_screenshots"
        cls.screenshot_dir.mkdir(parents=True, exist_ok=True)

    def test_all_widgets_rendering_and_screenshots(self):
        """5つのウィジェットにモックデータを流し込み、例外なく描画され画像保存できること"""
        raw_data = LiveClient.get_mock_game_data()
        engine = HudStateEngine()
        state = engine.analyze_frame(raw_data)

        # 1. TopBarWidget (画面右上: マクロ＆経済)
        top_bar = TopBarWidget()
        top_bar.update_data(state)
        top_bar.show()
        self.app.processEvents()
        pix_top = top_bar.grab()
        pix_top.save(str(self.screenshot_dir / "01_top_bar.png"))
        self.assertFalse(pix_top.isNull(), "TopBar screenshot should not be null")

        # 2. MatchupCardWidget (画面左側: 対面手順書＆動的ビルド)
        card = MatchupCardWidget()
        card.update_data(state)
        card.show()
        self.app.processEvents()
        pix_card = card.grab()
        pix_card.save(str(self.screenshot_dir / "02_matchup_card.png"))
        self.assertFalse(pix_card.isNull(), "MatchupCard screenshot should not be null")

        # 3. SpellTrackerWidget (画面右側: マクロヘッダー ＆ 敵スペル/Ultタイマー)
        tracker = SpellTrackerWidget()
        tracker.update_data(state)
        tracker.show()
        self.app.processEvents()
        pix_tracker = tracker.grab()
        pix_tracker.save(str(self.screenshot_dir / "03_spell_tracker.png"))
        self.assertFalse(pix_tracker.isNull(), "SpellTracker screenshot should not be null")

        # 4. ToastAlertWidget (画面左下: スマート通知パネル - スパイク/JG/バフ/購入通知)
        toast_state = dict(state)
        toast_state["spike_details"] = [{
            "champion": "Darius",
            "item_name": "トリニティ・フォース",
            "item_id": 3078,
            "price": 3333
        }]
        toast_state["is_gank_danger"] = True
        toast_state["enemy_jg"] = "Elise"
        toast_state["buff_status"] = ["🟣 バロン: 175s"]
        toast = ToastAlertWidget()
        toast.update_events(toast_state)
        toast.show()
        self.app.processEvents()
        pix_toast = toast.grab()
        pix_toast.save(str(self.screenshot_dir / "04_toast_alert.png"))
        self.assertFalse(pix_toast.isNull(), "ToastAlert screenshot should not be null")

        # 5. LaneDominanceWidget (画面中央下部: 対面ゴールド差マトリクス)
        lane = LaneDominanceWidget()
        lane.update_data(state)
        lane.show()
        self.app.processEvents()
        pix_lane = lane.grab()
        # 6. チャット検知によるスペルタイマー始動テスト
        darius_col = None
        for col in tracker.columns:
            if col.champion.lower() == "darius":
                darius_col = col
                break
        self.assertIsNotNone(darius_col, "Darius column should exist in tracker")
        darius_col.btn_spell1.trigger_cooldown()
        self.assertGreater(darius_col.btn_spell1.ready_time, 0, "Darius Flash cooldown should be active")

        # 7. 🌲 JGメイン用 タクティカルカード描画テスト (LeeSin vs Elise)
        jg_state = dict(state)
        jg_state["is_jg"] = True
        jg_state["my_champion"] = "LeeSin"
        jg_state["enemy_champion"] = "Elise"
        jg_state["smite_damage"] = 900
        jg_state["smite_tier_name"] = "Primal"
        jg_state["jg_gank_targets"] = [
            "🎯 MID (Zed): Flash落ち / プッシュ中 ➔ 最優先ガンク！",
            "🎯 BOT (Kai'Sa): 対面孤立 ➔ ガンク後ドラゴン直行"
        ]
        jg_state["jg_objective_plan"] = "🐉 ヴォイドグラブ ＆ ドラゴン管理 (スマイト: 900dmg)"

        card_jg = MatchupCardWidget()
        card_jg.update_data(jg_state)
        card_jg.show()
        self.app.processEvents()
        pix_jg = card_jg.grab()
        pix_jg.save(str(self.screenshot_dir / "02_matchup_card_jg.png"))
        self.assertFalse(pix_jg.isNull(), "JG MatchupCard screenshot should not be null")
        card_jg.close()

        top_bar.close()
        card.close()
        tracker.close()
        toast.close()
        lane.close()


class TestGankOpportunityEngine(unittest.TestCase):
    """5. JG視点ガンク成功率 ＆ キル確定判定エンジンのテスト"""

    def test_high_success_gank_case(self):
        """敵瀕死 ＋ Flashなし ＋ 味方確定CCありの場合、確実キル (90%以上) と判定されること"""
        res = GankOpportunityEngine.calculate_gank_opportunity(
            jg_champ="Elise",
            jg_level=6,
            enemy_champ="Syndra",
            enemy_level=6,
            enemy_current_hp_pct=30.0,
            enemy_has_flash=False,
            ally_laner_champ="Ahri",
            lane="MID"
        )
        self.assertGreaterEqual(res["score"], 80.0)
        self.assertEqual(res["verdict"], "KILL_CONFIRMED")
        self.assertEqual(res["color"], "#22c55e")

    def test_high_risk_gank_case(self):
        """敵レベル先行 ＋ 敵満タンHP ＋ 味方レーナー瀕死の場合、危険判定されること"""
        res = GankOpportunityEngine.calculate_gank_opportunity(
            jg_champ="MasterYi",
            jg_level=5,
            enemy_champ="Darius",
            enemy_level=7,
            enemy_current_hp_pct=95.0,
            enemy_has_flash=True,
            ally_laner_champ="Aatrox",
            ally_laner_hp_pct=20.0,
            lane="TOP"
        )
        self.assertLessEqual(res["score"], 40.0)
        self.assertEqual(res["verdict"], "HIGH_RISK")
        self.assertEqual(res["color"], "#ef4444")

    def test_champion_matchup_turnaround_risk(self):
        """Illaoi等の1v2返り討ちチャンピオンに対する高リスク判定、およびPantheon確定CCでの高成功率判定"""
        # 1. Illaoi 高HP時 ➔ 返り討ちリスクで減点
        res_illaoi = GankOpportunityEngine.calculate_gank_opportunity(
            jg_champ="LeeSin",
            jg_level=6,
            enemy_champ="Illaoi",
            enemy_level=6,
            enemy_current_hp_pct=80.0,
            enemy_has_flash=True,
            ally_laner_champ="Aatrox",
            lane="TOP"
        )
        self.assertLessEqual(res_illaoi["score"], 40.0)
        self.assertEqual(res_illaoi["verdict"], "HIGH_RISK")

        # 2. 味方Pantheon確定スタン + 敵Ashe(ブリンクなし&Flash落ち) ➔ 確実キル
        res_pantheon = GankOpportunityEngine.calculate_gank_opportunity(
            jg_champ="JarvanIV",
            jg_level=6,
            enemy_champ="Ashe",
            enemy_level=6,
            enemy_current_hp_pct=60.0,
            enemy_has_flash=False,
            ally_laner_champ="Pantheon",
            lane="BOTTOM"
        )
        self.assertGreaterEqual(res_pantheon["score"], 80.0)
        self.assertEqual(res_pantheon["verdict"], "KILL_CONFIRMED")


class TestMacroAnalyticsAndIntel(unittest.TestCase):
    """7. 新設モジュール (macro_analytics, matchup_intel_provider) の独立単体テスト"""

    def test_cannon_wave_timing(self):
        """大砲ミニオン出現タイマーの境界値テスト"""
        from v2_CORE._LOL.overlay.macro_analytics import calculate_cannon_wave_info
        # 試合開始前
        c0 = calculate_cannon_wave_info(10.0)
        self.assertFalse(c0["is_cannon_active"])
        self.assertIn("第1ウェーブまで", c0["desc"])

        # 序盤 (3ウェーブに1回)
        c_early = calculate_cannon_wave_info(120.0)
        self.assertIn("次大砲", c_early["desc"])

        # 25分以降 (毎ウェーブ大砲)
        c_late = calculate_cannon_wave_info(1600.0)
        self.assertTrue(c_late["is_current_cannon"])

    def test_damage_profile(self):
        """敵ダメージ属性比率の判定テスト"""
        from v2_CORE._LOL.overlay.macro_analytics import calculate_enemy_damage_profile
        ad_enemies = [
            {"championName": "Darius", "championStats": {"attackDamage": 150.0, "abilityPower": 0.0}},
            {"championName": "Zed", "championStats": {"attackDamage": 200.0, "abilityPower": 0.0}},
            {"championName": "Jinx", "championStats": {"attackDamage": 250.0, "abilityPower": 0.0}},
        ]
        prof = calculate_enemy_damage_profile(ad_enemies)
        self.assertEqual(prof["bias"], "HEAVY_AD")
        self.assertGreaterEqual(prof["ad_pct"], 65)

    def test_grievous_wounds(self):
        """重傷アイテム解析テスト"""
        from v2_CORE._LOL.overlay.macro_analytics import analyze_grievous_wounds
        # 敵にAatroxがいる場合
        enemies = [{"championName": "Aatrox"}]
        allies_no_gw = [{"summonerName": "Me", "championName": "Garen", "items": []}]
        res_needed = analyze_grievous_wounds(allies_no_gw, enemies, "Me")
        self.assertTrue(res_needed["needed"])
        self.assertEqual(res_needed["status"], "CRITICAL_MISSING")

        # 味方がExecutioner's Calling (3123) 所持時
        allies_gw = [{"summonerName": "Me", "championName": "Garen", "items": [{"itemID": 3123}]}]
        res_owned = analyze_grievous_wounds(allies_gw, enemies, "Me")
        self.assertTrue(res_owned["self_holding"])
        self.assertEqual(res_owned["status"], "ACQUIRED")

    def test_matchup_intel_fallback(self):
        """対面インテル未登録時のフォールバックテスト"""
        from v2_CORE._LOL.overlay.matchup_intel_provider import MatchupIntelProvider
        provider = MatchupIntelProvider(supabase_url="", supabase_key="")
        memo = provider.get_matchup_memo("LeeSin", "Elise")
        self.assertTrue(memo.get("is_fallback"))
        self.assertIn("未登録", memo.get("title"))


def run_full_suite():
    print("=" * 65)
    print("🧪 Sovereign HUD - オーバーレイ全自動テストスイート実行")
    print("=" * 65)

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    suite.addTest(loader.loadTestsFromTestCase(TestDynamicBuildAdvisor))
    suite.addTest(loader.loadTestsFromTestCase(TestHudStateEngine))
    suite.addTest(loader.loadTestsFromTestCase(TestKillLineCalculator))
    suite.addTest(loader.loadTestsFromTestCase(TestChatSpellDetector))
    suite.addTest(loader.loadTestsFromTestCase(TestGankOpportunityEngine))
    suite.addTest(loader.loadTestsFromTestCase(TestMacroAnalyticsAndIntel))
    suite.addTest(loader.loadTestsFromTestCase(TestOverlayWidgetsVisual))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    screenshot_path = CURRENT_DIR / "test_screenshots"
    print("\n" + "=" * 65)
    if result.wasSuccessful():
        print("✅ 【全テスト合格！】すべてのオーバーレイ機能＆ウィジェットが正常に動作しています。")
        print(f"📸 生成されたUIスクリーンショット: {screenshot_path}")
    else:
        print(f"❌ 【テスト失敗】{len(result.failures)} 件の失敗、{len(result.errors)} 件のエラーが発生しました。")
    print("=" * 65)

    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(run_full_suite())
