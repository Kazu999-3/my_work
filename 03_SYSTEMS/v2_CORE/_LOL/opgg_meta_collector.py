#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OP.GG 公式MCPサーバーから全レーン（TOP / JG / MID / ADC / SUP）のメタデータを収集し、
Supabase ktm_settings (opgg_lane_meta_stats) および 05_PILOT/src/data/opgg_lane_meta.json へ保存するスクリプト。
"""

import os
import sys
import json
import re
import time
import urllib.request
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "03_SYSTEMS"))

load_dotenv(BASE_DIR / ".env")

try:
    from v2_CORE._LOL.champ_id_normalizer import normalize_champion_id
except ImportError:
    sys.path.append(str(Path(__file__).resolve().parent))
    from champ_id_normalizer import normalize_champion_id

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("opgg_meta_collector")

OPGG_MCP_URL = "https://mcp-api.op.gg/mcp"
LOCAL_OUTPUT_PATH = BASE_DIR / "05_PILOT" / "src" / "data" / "opgg_lane_meta.json"

POSITIONS = [
    ("top", "TOP", "Top"),
    ("jungle", "JG", "Jungle"),
    ("mid", "MID", "Mid"),
    ("adc", "ADC", "Adc"),
    ("support", "SUP", "Support"),
]

TIER_LABELS = {
    0: "OP",
    1: "Tier 1",
    2: "Tier 2",
    3: "Tier 3",
    4: "Tier 4",
    5: "Tier 5",
}

def fetch_position_meta(pos_arg: str, pos_code: str, class_name: str) -> dict:
    """単一ポジションのメタデータをOP.GG MCPから取得"""
    desired_fields = [
        f"data.positions.{pos_arg}[].champion",
        f"data.positions.{pos_arg}[].tier",
        f"data.positions.{pos_arg}[].win_rate",
        f"data.positions.{pos_arg}[].pick_rate",
        f"data.positions.{pos_arg}[].ban_rate",
        f"data.positions.{pos_arg}[].rank",
        f"data.positions.{pos_arg}[].is_rip",
    ]

    req_body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "lol_list_lane_meta_champions",
            "arguments": {
                "position": pos_arg,
                "lang": "en_US",
                "desired_output_fields": desired_fields,
            }
        }
    }

    req_data = json.dumps(req_body).encode("utf-8")
    req = urllib.request.Request(
        OPGG_MCP_URL,
        data=req_data,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        res_json = json.loads(resp.read().decode("utf-8"))

    content_list = res_json.get("result", {}).get("content", [])
    if not content_list or "text" not in content_list[0]:
        raise ValueError(f"{pos_arg} のレスポンスに有効なテキストデータが含まれていません")

    raw_text = content_list[0]["text"]

    # 例: Jungle("ウーコン",false,0.52,0.07,0.05,1,1) または Jungle("Wukong",false,...)
    pattern = re.compile(rf'{class_name}\("([^"]+)",(true|false),([0-9.]+),([0-9.]+),([0-9.]+),([0-9]+),([0-9]+)\)')
    matches = pattern.findall(raw_text)

    lane_dict = {}
    for champ_raw, is_rip_raw, wr_raw, pr_raw, br_raw, tier_raw, rank_raw in matches:
        normalized_id = normalize_champion_id(champ_raw)
        if not normalized_id:
            normalized_id = champ_raw

        tier_num = int(tier_raw)
        tier_str = TIER_LABELS.get(tier_num, f"Tier {tier_num}")

        win_rate = round(float(wr_raw) * 100, 1)
        pick_rate = round(float(pr_raw) * 100, 1)
        ban_rate = round(float(br_raw) * 100, 1)
        rank_num = int(rank_raw)
        is_rip = is_rip_raw.lower() == "true"

        lane_dict[normalized_id] = {
            "championName": champ_raw,
            "winRate": win_rate,
            "pickRate": pick_rate,
            "banRate": ban_rate,
            "tier": tier_str,
            "tierNum": tier_num,
            "rank": rank_num,
            "isRip": is_rip,
        }

    return lane_dict

def fetch_all_opgg_lane_meta() -> dict:
    """全5レーンのメタデータを順次取得して統合"""
    lanes_data = {}
    total_matches = 0

    for pos_arg, pos_code, class_name in POSITIONS:
        logger.info(f"OP.GG メタデータ取得中: {pos_code} ({pos_arg})...")
        try:
            lane_dict = fetch_position_meta(pos_arg, pos_code, class_name)
            lanes_data[pos_code] = lane_dict
            total_matches += len(lane_dict)
            logger.info(f"  -> {pos_code}: {len(lane_dict)} 体取得")
        except Exception as e:
            logger.error(f"  -> {pos_code} 取得エラー: {e}")
            lanes_data[pos_code] = {}
        time.sleep(0.5)

    jst = timezone(timedelta(hours=9))
    now_jst = datetime.now(jst).isoformat()

    return {
        "source": "OP.GG",
        "sourceUrl": "https://www.op.gg/champions",
        "fetchedAt": now_jst,
        "totalEntries": total_matches,
        "lanes": lanes_data,
    }

def save_to_supabase(meta_data: dict) -> bool:
    """Supabase ktm_settings テーブルに opgg_lane_meta_stats を保存"""
    supa_url = os.environ.get("SUPABASE_URL")
    supa_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

    if not supa_url or not supa_key:
        logger.warning("Supabase接続情報が見つからないため、DB保存をスキップします")
        return False

    url = f"{supa_url.rstrip('/')}/rest/v1/ktm_settings"
    headers = {
        "apikey": supa_key,
        "Authorization": f"Bearer {supa_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    payload = {
        "key": "opgg_lane_meta_stats",
        "value": meta_data,
        "updated_at": meta_data["fetchedAt"],
    }

    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            logger.info(f"Supabase ktm_settings 保存成功: HTTP {resp.status}")
            return True
    except Exception as e:
        logger.error(f"Supabase ktm_settings 保存失敗: {e}")
        return False

def save_to_local_file(meta_data: dict) -> bool:
    """ローカルJSONファイルとして保存（05_PILOT用）"""
    try:
        LOCAL_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(LOCAL_OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(meta_data, f, ensure_ascii=False, indent=2)
        logger.info(f"ローカルキャッシュ保存成功: {LOCAL_OUTPUT_PATH}")
        return True
    except Exception as e:
        logger.error(f"ローカルキャッシュ保存失敗: {e}")
        return False

def collect_and_save():
    """実行エントリーポイント"""
    meta_data = fetch_all_opgg_lane_meta()
    logger.info(f"全レーン収集完了: 総エントリ数 {meta_data['totalEntries']}")
    save_to_local_file(meta_data)
    save_to_supabase(meta_data)
    logger.info("OP.GG メタデータ収集・同期が正常に完了しました")

if __name__ == "__main__":
    collect_and_save()
