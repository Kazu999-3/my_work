"""
Sovereign HUD - 勝因・敗因自動アナライザー (Fight Analyst)
=========================================================
集団戦セッションのデータ（キル数、オブジェクト、ダメージ、時間帯）から
「なぜ勝てたのか / なぜ負けたのか」の具体的要因と改善アドバイスを自動生成する。
"""

from typing import Dict, Any

class FightAnalyst:
    @staticmethod
    def analyze_fight(fight_data: Dict[str, Any], my_champion: str = "Aatrox") -> Dict[str, Any]:
        """ファイトの勝因・敗因と戦術レビューを生成"""
        result = fight_data.get("result", "EVEN")
        ally_kills = fight_data.get("ally_kills", 0)
        enemy_kills = fight_data.get("enemy_kills", 0)
        objectives = fight_data.get("objectives", [])
        my_damage = fight_data.get("my_damage_dealt", 0)
        title = fight_data.get("title", "")

        has_baron = any("Baron" in o for o in objectives)
        has_dragon = any("Dragon" in o for o in objectives)

        if result == "VICTORY":
            if has_baron:
                summary = "👑 【バロン獲得大勝利】 敵前衛を崩してバロンを獲得！一気に試合を決定づける主導権を握りました。"
                key_factor = "集団戦のフォーカスが統率され、バロンバフでミニオン強化プッシュが可能に。"
            elif has_dragon:
                summary = "🐉 【ドラゴン獲得勝利】 敵の隙を突き、ドラゴンとキルを両取り。チーム全体に強力な永続バフを付与。"
                key_factor = "オブジェクト前でのポジショニングが完璧で、敵のエンゲージを的確に返り討ちにしました。"
            else:
                summary = f"⚔️ 【レーン交戦大勝利】 {ally_kills}キルを獲得！対面とのゴールド差を大きく拡大。"
                key_factor = "スキルのCDタイミングを突いた鋭い仕掛けが功を奏しました。"

            feedback = f"🔥 {my_champion} の活躍: {my_damage:,} dmg (高い火力貢献で前線を維持)"

        elif result == "DEFEAT":
            if has_baron:
                summary = "⚠️ 【バロン戦惜敗】 バロンピット周辺で敵に挟撃され、壊滅的な痛手を受けました。"
                key_factor = "視界確保が不十分な状態での強引なバロンスタートが原因。次はピンクワードで視界をクリアにしてから仕掛けましょう。"
            elif has_dragon:
                summary = "⚠️ 【ドラゴン戦惜敗】 ドラゴン前の人数不利または孤立した味方がキャッチされました。"
                key_factor = "味方が揃う前にファイトが始まってしまいました。Pingで集合を待つ意識を持ちましょう。"
            else:
                summary = f"⚠️ 【交戦敗北】 {enemy_kills}デスを許し、敵にシャットダウンゴールドを献上。"
                key_factor = "敵のパワースパイク（完成コア）またはJGの寄りを見落としていた可能性があります。"

            feedback = "💡 改善ポイント: 次回の集団戦では、敵主要CCが落ちるのを確認してから突入しましょう。"

        else:
            summary = "⚖️ 【互角のトレード】 双方にキルが発生し、決定打には至りませんでした。"
            key_factor = "ウェーブ状況やタワーHPの有利不利を確認し、無理な追撃を避けたのは賢明な判断です。"
            feedback = f"🎯 次の展開: ミニオンウェーブを押し込み、1stリコールまたは視界確保へ移行しましょう。"

        return {
            **fight_data,
            "summary": summary,
            "key_factor": key_factor,
            "feedback": feedback,
        }
