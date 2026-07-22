# ============================================================
# クラウドワーカーの結果を Discord に通知する共通ヘルパー。
#
# ローカル常駐デーモンが送っていた「解析完了」等の通知は、クラウド移行後
# 途切れていた。youtube_worker / prospector / scout がこれを呼び、
# 「何をどれだけ処理したか」を1通にまとめて送る。
#
# 環境変数 DISCORD_WEBHOOK が無ければ、何もせず静かに戻る
# （通知が無くても本体の処理は成立するため、失敗させない）。
# ============================================================
import json
import os
import urllib.request


def notify(title, lines=None, color=0x5865F2):
    """
    Discord へ Embed を1件送る。

    title: 見出し
    lines: 本文にする文字列のリスト（None可）
    color: Embed左端の色
    """
    webhook = os.environ.get("DISCORD_WEBHOOK", "").strip()
    if not webhook:
        return  # 未設定なら黙って何もしない

    description = "\n".join(lines) if lines else ""
    # Discordのdescription上限は4096文字。超えたら切り詰める。
    if len(description) > 3900:
        description = description[:3900] + "\n…(以下省略)"

    payload = {
        "embeds": [{
            "title": title[:256],
            "description": description,
            "color": color,
        }]
    }
    try:
        req = urllib.request.Request(
            webhook,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        # 通知の失敗で本処理を止めない
        print(f"[notify] Discord通知に失敗: {e}")


# 見た目を揃えるための色
COLOR_OK = 0x2ECC71      # 緑: 正常完了
COLOR_INFO = 0x5865F2    # 青: 情報
COLOR_WARN = 0xE67E22    # 橙: 一部失敗・注意
