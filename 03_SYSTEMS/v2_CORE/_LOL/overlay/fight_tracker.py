"""
Sovereign HUD - 集団戦セッション自動クラスタリングエンジン (Fight Tracker)
========================================================================
Live Client Data API のイベントログ（キル、ドラゴン、バロン、タワー）を時系列監視し、
25秒以内の連続交戦イベントを1つの「集団戦（ファイトセッション）」として自動クラスタリング・集計する。
"""

import time
from typing import List, Dict, Any

class FightSession:
    def __init__(self, fight_id: int, start_time: float, my_team: str):
        self.fight_id = fight_id
        self.start_time = start_time
        self.end_time = start_time
        self.my_team = my_team
        
        self.events: List[Dict[str, Any]] = []
        self.ally_kills = 0
        self.enemy_kills = 0
        self.objectives: List[str] = []
        self.my_damage_dealt = 0.0
        self.gold_swing = 0
        self.is_active = True

    def add_event(self, event: Dict[str, Any]):
        self.events.append(event)
        self.end_time = event.get("EventTime", self.start_time)
        
        ev_name = event.get("EventName", "")
        if ev_name == "ChampionKill":
            killer = event.get("KillerName", "")
            victim = event.get("VictimName", "")
            # キラーと被害者の所属判定（後で詳細バインド）
            # 簡易判定: イベント内のフラグまたは外部からカウント
        elif ev_name in ["DragonKill", "BaronKill", "HeraldKill", "HordeKill"]:
            dragon_type = event.get("DragonType", "")
            obj_name = f"{dragon_type} Dragon" if dragon_type else ev_name.replace("Kill", "")
            self.objectives.append(obj_name)
        elif ev_name == "TurretKilled":
            self.objectives.append("Turret")

    def finish_session(self, my_damage: float = 0.0):
        self.is_active = False
        self.my_damage_dealt = my_damage
        
        # 勝敗判定
        if self.ally_kills > self.enemy_kills or (self.ally_kills == self.enemy_kills and len(self.objectives) > 0):
            self.result = "VICTORY"
            self.result_badge = "大勝利 🟢"
        elif self.ally_kills < self.enemy_kills:
            self.result = "DEFEAT"
            self.result_badge = "惜敗 🔴"
        else:
            self.result = "EVEN"
            self.result_badge = "互角 🟡"

        # ゴールドスイング概算 (キル 300G + ドラゴン 150G + バロン 1500G + タワー 250G)
        self.gold_swing = (self.ally_kills - self.enemy_kills) * 300
        if "Baron" in self.objectives:
            self.gold_swing += 1500
        if "Dragon" in "".join(self.objectives):
            self.gold_swing += 300
        if "Turret" in self.objectives:
            self.gold_swing += 250

    def to_dict(self) -> Dict[str, Any]:
        min_part = int(self.start_time // 60)
        sec_part = int(self.start_time % 60)
        time_str = f"{min_part:02d}:{sec_part:02d}"

        # タイトル決定
        if any("Baron" in o for o in self.objectives):
            loc = "バロン前集団戦"
        elif any("Dragon" in o for o in self.objectives):
            loc = "ドラゴン前集団戦"
        elif any("Herald" in o or "Horde" in o for o in self.objectives):
            loc = "オブジェクト争奪戦"
        else:
            loc = "レーン交戦"

        title = f"{time_str} {loc}"

        return {
            "fight_id": self.fight_id,
            "time_str": time_str,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_sec": int(self.end_time - self.start_time),
            "title": title,
            "ally_kills": self.ally_kills,
            "enemy_kills": self.enemy_kills,
            "objectives": self.objectives,
            "my_damage_dealt": int(self.my_damage_dealt),
            "gold_swing": self.gold_swing,
            "result": getattr(self, "result", "EVEN"),
            "result_badge": getattr(self, "result_badge", "互角 🟡"),
        }

class FightTracker:
    def __init__(self):
        self.sessions: List[FightSession] = []
        self.current_session: FightSession = None
        self.last_processed_event_id = -1
        self.recent_finished_fight: Dict[str, Any] = None

    def process_events(self, events: List[Dict[str, Any]], game_time_sec: float, my_team: str = "ORDER", my_damage: float = 0.0):
        """1フレームのイベント配列を処理して集団戦セッションを管理"""
        FIGHT_GAP_THRESHOLD = 25.0  # 25秒間イベントがなければセッション終了

        for ev in events:
            ev_id = ev.get("EventID", 0)
            if ev_id <= self.last_processed_event_id:
                continue
            self.last_processed_event_id = ev_id

            ev_name = ev.get("EventName", "")
            ev_time = ev.get("EventTime", game_time_sec)

            if ev_name in ["ChampionKill", "DragonKill", "BaronKill", "HeraldKill", "HordeKill", "TurretKilled"]:
                # セッションがなければ新設、または直前イベントから25秒以上経過していれば前セッション終了
                if not self.current_session:
                    new_id = len(self.sessions) + 1
                    self.current_session = FightSession(new_id, ev_time, my_team)
                elif (ev_time - self.current_session.end_time) > FIGHT_GAP_THRESHOLD:
                    self.current_session.finish_session(my_damage)
                    self.sessions.append(self.current_session)
                    self.recent_finished_fight = self.current_session.to_dict()
                    
                    new_id = len(self.sessions) + 1
                    self.current_session = FightSession(new_id, ev_time, my_team)

                # キルカウント判定
                if ev_name == "ChampionKill":
                    # 簡易: 敵味方判定（偶数/奇数または名前判定）
                    self.current_session.ally_kills += 1  # サンプル加算
                self.current_session.add_event(ev)

        # 現在のセッションが非アクティブ（25秒経過）なら確定終了
        if self.current_session and (game_time_sec - self.current_session.end_time) > FIGHT_GAP_THRESHOLD:
            self.current_session.finish_session(my_damage)
            self.sessions.append(self.current_session)
            self.recent_finished_fight = self.current_session.to_dict()
            self.current_session = None

    def get_all_fights(self) -> List[Dict[str, Any]]:
        return [s.to_dict() for s in self.sessions]

    def get_recent_finished_fight(self) -> Dict[str, Any]:
        """直前に完了したファイトを取得（一度取得したらクリア可能）"""
        res = self.recent_finished_fight
        self.recent_finished_fight = None
        return res
