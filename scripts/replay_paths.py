# リプレイのミニマップから10人の秒単位の移動経路を読み取る（2026-10-21 試作をまとめたもの）
#
# 使い方:  python replay_paths.py JP1_608006396 [--minutes 10] [--eval] [--skip-capture] [--upload]
#
# 前提:
#  - LoL クライアントが起動していて、その試合のリプレイがダウンロード済み（同じパッチのみ再生できる）
#  - game.cfg の [General] EnableReplayApi=1、画面 1920x1080 枠なし、MinimapScale=3.0、キャンプのタイマー非表示
#    （ミニマップの位置と大きさをこの設定で測ってある: CALIB）
#  - 撮影中はゲームを一番手前に出す（画面をそのまま撮るため、上に別のウィンドウがあると写り込む）
#
# 方式（試作で精度を測って決めたもの）:
#  - ミニマップのアイコンはスキンに関係なく DDragon の通常の顔。顔の一致＋チーム色の縁で点数を付ける
#  - マップ全体から探すと重なりやタワー・ショップに飛ぶので、Riot API の1分ごとの正解位置を起点に、
#    前向きと後ろ向きの両方から「近くだけ」を探して追いかけ、確かな方を採る
#  - 動かない背景（全体の中央値）でも点数が出る場所は減点する（青の泉のショップのアイコン対策）
#  - デスは試合の記録から時刻が分かるので泉へ移す。8秒以上見失ったら、リコールを疑って泉の周りも探す
import argparse, ctypes, io, json, os, re, ssl, sys, time, urllib.request
import numpy as np
import cv2
from PIL import Image, ImageGrab

BASE = os.path.dirname(os.path.abspath(__file__))
CROP = (1630, 790, 1920, 1080)                          # 画面上のミニマップを含む範囲
CALIB = ((57.86, -1271.94), (-58.64, 16230.35))          # 切り抜き画像の px → 試合の座標（x, y それぞれ 傾き・切片）
FOUNTAIN = {100: (400, 400), 200: (14400, 14400)}
SPEED_UNITS = 400 * 1.5                                  # 1秒に動ける最大距離（移動速度400の1.5倍）
THR = 0.55                                               # 近くを探すときの合格点
THR_FOUNTAIN = 0.85                                      # 泉へ乗り換えるときの合格点
LOST_RECALL = 8                                          # 何秒見失ったら泉も探すか（リコールの詠唱時間）

ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE


def load_env():
    env = {}
    for line in open("D:/my_work/04_PORTAL/.env.local", encoding="utf-8"):
        m = re.match(r"^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$", line)
        if m:
            env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return env


def http(url, data=None, headers=None, method=None, local=False, timeout=30):
    h = {"User-Agent": "Mozilla/5.0 (KTM replay paths)"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, context=ctx if local else None, timeout=timeout) as r:
        return r.read()


def replay(path, body=None):
    raw = http(f"https://127.0.0.1:2999{path}", data=json.dumps(body).encode() if body is not None else None,
               headers={"Content-Type": "application/json"}, method="POST" if body is not None else "GET", local=True, timeout=15)
    return json.loads(raw or b"{}")


def lcu(method, path, body=None):
    lock = open("C:/Riot Games/League of Legends/lockfile", encoding="utf-8").read().split(":")
    import base64
    auth = base64.b64encode(f"riot:{lock[3]}".encode()).decode()
    return http(f"https://127.0.0.1:{lock[2]}{path}", data=json.dumps(body).encode() if body is not None else None,
                headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"}, method=method, local=True)


# ---------------------------------------------------------------- 1) 試合データ
def fetch_match(match_id, work, key):
    def cached(name, url):
        p = os.path.join(work, name)
        if not os.path.exists(p):
            open(p, "wb").write(http(url))
        return open(p, "rb").read()
    match = json.loads(cached("match.json", f"https://asia.api.riotgames.com/lol/match/v5/matches/{match_id}?api_key={key}"))
    tl = json.loads(cached("timeline.json", f"https://asia.api.riotgames.com/lol/match/v5/matches/{match_id}/timeline?api_key={key}"))
    ver = json.loads(http("https://ddragon.leagueoflegends.com/api/versions.json"))[0]
    players = {p["participantId"]: p for p in match["info"]["participants"]}
    icons = {}
    os.makedirs(os.path.join(BASE, "icons"), exist_ok=True)
    for pid, p in players.items():
        ip = os.path.join(BASE, "icons", f"{p['championName']}.png")
        if not os.path.exists(ip):
            open(ip, "wb").write(http(f"https://ddragon.leagueoflegends.com/cdn/{ver}/img/champion/{p['championName']}.png"))
        icons[pid] = cv2.cvtColor(np.array(Image.open(ip).convert("RGB")), cv2.COLOR_RGB2BGR)
    return match, tl, players, icons


# ---------------------------------------------------------------- 2) リプレイを開く
def open_replay(game_id, players):
    want = sorted(p["championName"].lower() for p in players.values())
    def loaded():
        try:
            pl = json.loads(http("https://127.0.0.1:2999/liveclientdata/playerlist", local=True, timeout=5))
            # rawChampionName は "game_character_displayname_Qiyana" や "Character_Aatrox_Name" の形
            got = sorted(re.sub(r"^(game_character_displayname_|Character_)|_Name$", "", x.get("rawChampionName", "")).lower() for x in pl)
            # 変身で名前が変わるチャンピオンがいる（メガナー = GnarBig など）ので、10人中8人以上一致で同じ試合とみなす
            common = sum(min(got.count(n), want.count(n)) for n in set(want))
            return common >= len(want) - 2, len(pl)
        except Exception:
            return False, 0
    ok, n = loaded()
    if ok:
        return loaded
    if n:
        os.system('taskkill /IM "League of Legends.exe" /F >NUL 2>&1')
    # 閉じた直後は「開く」を受け付けないことがあるので、ゲームが立ち上がらなければ頼み直す
    started = False
    for attempt in range(4):
        time.sleep(10)
        try:
            lcu("POST", f"/lol-replays/v1/rofls/{game_id}/watch", {"componentType": "replay-button_match-history"})
        except Exception as e:
            print("リプレイを開く依頼に失敗:", e, flush=True)
            continue
        for _ in range(20):
            time.sleep(3)
            if os.popen('tasklist /FI "IMAGENAME eq League of Legends.exe"').read().count("League of Legends.exe"):
                started = True
                break
        if started:
            break
    if not started:
        raise SystemExit("リプレイが起動しませんでした")
    for _ in range(100):
        time.sleep(3)
        try:
            if "length" in replay("/replay/playback"):
                break
        except Exception:
            pass
    time.sleep(5)
    ok, _ = loaded()
    if not ok:
        # 2026-10-21: 別の試合のリプレイが開いたまま15分ぶん撮ってしまったことがあるため、警告で済ませず止める
        raise SystemExit("開いたリプレイの顔ぶれが試合データと一致しません。別の試合が開いている可能性があるので止めます")
    return loaded


# ---------------------------------------------------------------- 3) 撮影（1分ごとのファイルに分けて保存）
def capture(work, end_sec, speed=4.0):
    replay("/replay/render", {"fogOfWar": False, "interfaceAnnounce": False, "interfaceChat": False, "interfaceFrames": False,
                              "interfaceKillCallouts": False, "interfaceReplay": False, "interfaceScoreboard": False,
                              "interfaceTimeline": False, "interfaceTarget": False, "interfaceNeutralTimers": False,
                              "banners": False, "interfaceMinimap": True})
    u = ctypes.windll.user32
    prev = u.GetForegroundWindow(); game = u.FindWindowW(None, "League of Legends (TM) Client")
    def front(h):
        u.keybd_event(0x12, 0, 0, 0); u.keybd_event(0x12, 0, 2, 0)
        u.ShowWindow(h, 9); u.SetForegroundWindow(h)
    replay("/replay/playback", {"time": 0, "paused": True, "speed": speed})
    time.sleep(4)
    front(game); time.sleep(1.5)
    buf, tbuf, cur, bad = [], [], 0, 0
    def flush(m):
        if buf:
            np.savez_compressed(os.path.join(work, f"chunk_{m:03d}.npz"), frames=np.array(buf), times=np.array(tbuf))
    replay("/replay/playback", {"paused": False, "speed": speed})
    try:
        while True:
            t0 = replay("/replay/playback")["time"]
            im = np.array(ImageGrab.grab(bbox=CROP))
            t1 = replay("/replay/playback")["time"]
            if u.GetForegroundWindow() != game:
                bad += 1; front(game); continue
            t = (t0 + t1) / 2
            m = int(t // 60)
            if m != cur:
                flush(cur); buf, tbuf, cur = [], [], m
            buf.append(cv2.cvtColor(im, cv2.COLOR_RGB2BGR)); tbuf.append(t)
            if t1 >= end_sec:
                break
    finally:
        flush(cur)
        replay("/replay/playback", {"paused": True, "speed": 1.0})
        front(prev)
    print(f"撮影: 0〜{int(end_sec)}秒 / 別のウィンドウが手前に来て捨てた枚数 {bad}")


# ---------------------------------------------------------------- 4) 追跡
class Tracker:
    def __init__(self, work, tl, players, icons):
        self.work, self.tl, self.players = work, tl, players
        (self.ax, self.ay) = CALIB
        S = 14870 / self.ax[0]
        self.R = int(round(S * 0.052)); self.INNER = int(round(self.R * 0.75)); size = self.INNER * 2 + 1
        self.mask = np.zeros((size, size), np.uint8); cv2.circle(self.mask, (self.INNER, self.INNER), self.INNER, 255, -1)
        self.tmpl = {}
        for pid, ic in icons.items():
            h = ic.shape[0]; m = int(h * 0.08)
            self.tmpl[pid] = cv2.resize(ic[m:h - m, m:h - m], (size, size), interpolation=cv2.INTER_AREA)
        self.ann = np.zeros((2 * self.R + 5, 2 * self.R + 5), np.float32)
        cv2.circle(self.ann, (self.R + 2, self.R + 2), self.R, 1, 2); self.ann /= self.ann.sum()
        self.speed_px = SPEED_UNITS / self.ax[0]
        self.fr_px = 2200 / self.ax[0]
        self.ML = int(np.ceil(self.ax[1] / -self.ax[0])); self.MT = int(np.ceil((self.ay[1] - 14980) / -self.ay[0]))
        self.MR = int((14870 - self.ax[1]) / self.ax[0]); self.MB = int((0 - self.ay[1]) / self.ay[0])
        self.deaths = {pid: [] for pid in players}
        for f in tl["info"]["frames"]:
            for ev in f.get("events", []):
                if ev.get("type") == "CHAMPION_KILL" and ev["victimId"] in self.deaths:
                    self.deaths[ev["victimId"]].append(ev["timestamp"] / 1000)
        self.chunks = sorted(f for f in os.listdir(work) if f.startswith("chunk_"))
        self._build_background()

    def to_px(self, x, y):
        return (x - self.ax[1]) / self.ax[0], (y - self.ay[1]) / self.ay[0]

    def to_game(self, px, py):
        return float(np.polyval(self.ax, px)), float(np.polyval(self.ay, py))

    def rings(self, fr):
        hsv = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV); sat = hsv[:, :, 1] > 110; h = hsv[:, :, 0]
        b = ((h >= 92) & (h <= 122) & sat).astype(np.float32); r = (((h <= 8) | (h >= 170)) & sat).astype(np.float32)
        return {100: cv2.filter2D(b, -1, self.ann), 200: cv2.filter2D(r, -1, self.ann)}

    def _score_full(self, fr, ring, pid):
        r = np.nan_to_num(cv2.matchTemplate(fr, self.tmpl[pid], cv2.TM_CCOEFF_NORMED, mask=self.mask), nan=-1, posinf=-1, neginf=-1)
        full = np.full(fr.shape[:2], -1, np.float32); I = self.INNER
        full[I:I + r.shape[0], I:I + r.shape[1]] = r
        return full + 0.6 * ring

    def _build_background(self):
        samples = []
        for c in self.chunks:
            d = np.load(os.path.join(self.work, c)); samples.extend(d["frames"][::10])
        bg = np.median(np.array(samples), axis=0).astype(np.uint8)
        rings = self.rings(bg)
        self.bg_sc = {pid: self._score_full(bg, rings[p["teamId"]], pid) for pid, p in self.players.items()}

    def load_range(self, t0, t1):
        frames, times = [], []
        for m in range(max(0, int(t0 // 60) - 1), int(t1 // 60) + 2):
            p = os.path.join(self.work, f"chunk_{m:03d}.npz")
            if os.path.exists(p):
                d = np.load(p)
                for f, t in zip(d["frames"], d["times"]):
                    if t0 <= t <= t1:
                        frames.append(f); times.append(float(t))
        order = np.argsort(times)
        return [frames[i] for i in order], [times[i] for i in order]

    def local_best(self, fr, ring, pid, cx, cy, W):
        I = self.INNER; size = I * 2 + 1
        x0 = max(self.ML - I, int(cx) - W - I); y0 = max(self.MT - I, int(cy) - W - I)
        x1 = min(self.MR + I + 1, int(cx) + W + I + 1); y1 = min(self.MB + I + 1, int(cy) + W + I + 1)
        win = fr[y0:y1, x0:x1]
        if win.shape[0] < size or win.shape[1] < size:
            return cx, cy, -1
        res = np.nan_to_num(cv2.matchTemplate(win, self.tmpl[pid], cv2.TM_CCOEFF_NORMED, mask=self.mask), nan=-1, posinf=-1, neginf=-1)
        sl = (slice(y0 + I, y0 + I + res.shape[0]), slice(x0 + I, x0 + I + res.shape[1]))
        sc = res + 0.6 * ring[sl] - 0.8 * np.maximum(0, self.bg_sc[pid][sl] - 0.4)
        yy, xx = np.mgrid[0:sc.shape[0], 0:sc.shape[1]]
        sc = sc - 0.01 * np.hypot(xx + x0 + I - cx, yy + y0 + I - cy)
        _, s, _, loc = cv2.minMaxLoc(sc)
        return loc[0] + x0 + I, loc[1] + y0 + I, s

    def in_fountain(self, team, cx, cy):
        fx, fy = self.to_px(*FOUNTAIN[team])
        return np.hypot(cx - fx, cy - fy) < self.fr_px

    def run(self, frames, rings, times, pid, start_xy, t_anchor, direction):
        team = self.players[pid]["teamId"]
        cx, cy = self.to_px(*start_xy); last_t = t_anchor; out = {}
        order = range(len(frames)) if direction > 0 else range(len(frames) - 1, -1, -1)
        for i in order:
            t = times[i]
            if any(min(last_t, t) < d <= max(last_t, t) for d in self.deaths[pid]):
                if direction > 0:
                    cx, cy = self.to_px(*FOUNTAIN[team]); last_t = t
                    out[i] = (cx, cy, 0.0); continue
                break
            W = int(np.ceil(max(3, abs(t - last_t) * self.speed_px)))
            nx, ny, s = self.local_best(frames[i], rings[i][team], pid, cx, cy, W)
            jumped_in = self.in_fountain(team, nx, ny) and not self.in_fountain(team, cx, cy) and abs(t - last_t) < 6
            if s >= THR and not jumped_in:
                cx, cy, last_t = nx, ny, t
            elif abs(t - last_t) >= LOST_RECALL:
                fx, fy = self.to_px(*FOUNTAIN[team])
                gx, gy, gs = self.local_best(frames[i], rings[i][team], pid, fx, fy, int(self.fr_px))
                if gs >= THR_FOUNTAIN:
                    cx, cy, last_t = gx, gy, t
            out[i] = (cx, cy, abs(t - last_t))
        return out

    def track(self, anchors_min):
        """anchors_min の分の正解位置を起点に全員を追う。返り値: {pid: [(t, x, y, 見失ってからの秒数)]}（試合の座標）"""
        fr_meta = self.tl["info"]["frames"]
        res = {pid: [] for pid in self.players}
        for a, b in zip(anchors_min, anchors_min[1:]):
            ta = fr_meta[a]["timestamp"] / 1000; tb = fr_meta[b]["timestamp"] / 1000
            frames, times = self.load_range(ta, tb)
            if not frames:
                continue
            rings = [self.rings(f) for f in frames]
            for pid in self.players:
                pa = fr_meta[a]["participantFrames"][str(pid)]["position"]; pb = fr_meta[b]["participantFrames"][str(pid)]["position"]
                fw = self.run(frames, rings, times, pid, (pa["x"], pa["y"]), ta, +1)
                bw = self.run(frames, rings, times, pid, (pb["x"], pb["y"]), tb, -1)
                team = self.players[pid]["teamId"]
                for i in range(len(frames)):
                    f, g = fw.get(i), bw.get(i)
                    if f is None and g is None:
                        continue
                    if f is None or g is None:
                        v = f or g
                    else:
                        fin, gin = self.in_fountain(team, f[0], f[1]), self.in_fountain(team, g[0], g[1])
                        if np.hypot(f[0] - g[0], f[1] - g[1]) > 15 and fin != gin:
                            v = g if fin else f
                        else:
                            v = f if f[2] <= g[2] else g
                    gx, gy = self.to_game(v[0], v[1])
                    res[pid].append((times[i], gx, gy, v[2]))
        return res


# ---------------------------------------------------------------- 5) 精度の測定
def evaluate(tr, tl, players, anchors):
    def nearest(lst, t, before=False):
        c = [p for p in lst if (p[0] < t if before else True)]
        return min(c, key=lambda p: abs(p[0] - t)) if c else None
    mins, evs = [], []
    last_min = max(anchors)
    for m in range(1, last_min + 1):
        if m in anchors:
            continue
        tm = tl["info"]["frames"][m]["timestamp"] / 1000
        for pid in players:
            p = nearest(tr[pid], tm)
            if p is None or abs(p[0] - tm) > 1.5:
                continue
            q = tl["info"]["frames"][m]["participantFrames"][str(pid)]["position"]
            mins.append(np.hypot(p[1] - q["x"], p[2] - q["y"]))
    for f in tl["info"]["frames"]:
        for ev in f.get("events", []):
            if ev.get("type") != "CHAMPION_KILL" or ev["timestamp"] / 1000 > last_min * 60:
                continue
            t = ev["timestamp"] / 1000; pos = ev["position"]
            for pid in [ev["killerId"], ev["victimId"]] + ev.get("assistingParticipantIds", []):
                p = nearest(tr.get(pid, []), t, before=(pid == ev["victimId"]))
                if p is None or abs(p[0] - t) > 1.5:
                    continue
                evs.append(np.hypot(p[1] - pos["x"], p[2] - pos["y"]))
    out = {}
    for label, e in (("間の分の正解", mins), ("キル等の場所", evs)):
        e = np.array(e)
        if len(e):
            print(f"  {label}: {len(e)}件 中央値{int(np.median(e))} 500以内{np.mean(e <= 500) * 100:.0f}% 1000以内{np.mean(e <= 1000) * 100:.0f}%")
            out[label] = {"n": int(len(e)), "median": int(np.median(e)), "within500": round(float(np.mean(e <= 500)), 3), "within1000": round(float(np.mean(e <= 1000)), 3)}
    return out


# ---------------------------------------------------------------- 6) 書き出し
def export(tr, match, players, work, match_id, end_sec, quality):
    out_players = []
    for pid, p in sorted(players.items()):
        pts, last = [], -9
        for t, x, y, lost in sorted(tr[pid]):
            if t - last >= 1.0:                   # 1秒おきに間引く
                pts.append([round(t, 1), int(x), int(y), int(min(lost, 99))])
                last = t
        out_players.append({
            "participantId": pid, "teamId": p["teamId"], "championName": p["championName"],
            "riotId": f"{p.get('riotIdGameName', '')}#{p.get('riotIdTagline', '')}", "position": p.get("teamPosition") or "",
            "points": pts,
        })
    data = {"version": 1, "matchId": match_id, "gameVersion": match["info"]["gameVersion"], "durationSec": int(match["info"]["gameDuration"]),
            "coveredSec": int(end_sec), "quality": quality, "players": out_players}
    p = os.path.join(work, "paths.json")
    json.dump(data, open(p, "w", encoding="utf-8"), ensure_ascii=False)
    print("書き出し:", p, f"{os.path.getsize(p) // 1024}KB")
    return data


def upload(data, env):
    url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + "/rest/v1/replay_paths?on_conflict=match_id"
    body = json.dumps([{"match_id": data["matchId"], "game_version": data["gameVersion"], "duration_sec": data["durationSec"],
                        "covered_sec": data["coveredSec"], "quality": data["quality"], "data": data}]).encode()
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    # 新形式のキーは、ブラウザのような User-Agent（Mozilla…）付きの通信を拒否する（401）ので、専用の名前にする
    headers = {"apikey": key, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal",
               "User-Agent": "ktm-replay-paths/1.0"}
    if not key.startswith("sb_"):
        headers["Authorization"] = f"Bearer {key}"   # 旧形式（JWT）のキーだけ Authorization にも入れる。新形式は入れると拒否される
    http(url, data=body, method="POST", timeout=60, headers=headers)
    print("アップロード完了:", data["matchId"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("match_id")
    ap.add_argument("--minutes", type=float, default=0, help="0 なら試合の最後まで")
    ap.add_argument("--eval", action="store_true", help="正解位置を2分おきだけ使い、間の分で精度を測る")
    ap.add_argument("--skip-capture", action="store_true")
    ap.add_argument("--upload", action="store_true")
    a = ap.parse_args()
    env = load_env()
    work = os.path.join(BASE, "matches", a.match_id); os.makedirs(work, exist_ok=True)
    match, tl, players, icons = fetch_match(a.match_id, work, env["RIOT_API_KEY"])
    n_frames = len(tl["info"]["frames"])
    last_min = n_frames - 1 if not a.minutes else min(n_frames - 1, int(a.minutes))
    end_sec = min(match["info"]["gameDuration"], tl["info"]["frames"][last_min]["timestamp"] / 1000 + 1)
    if not a.skip_capture:
        # リプレイは同じパッチのクライアントでしか開けない（2026-10-21、16.21 に上がった直後に 16.20 の試合を開こうとして別の試合が開いた）
        client = json.loads(lcu("GET", "/lol-patch/v1/game-version"))
        mv = ".".join(match["info"]["gameVersion"].split(".")[:2]); cv = ".".join(client.split(".")[:2])
        if mv != cv:
            raise SystemExit(f"この試合はパッチ {mv}、クライアントは {cv} なのでリプレイを開けません")
        for f in os.listdir(work):
            if f.startswith("chunk_"):
                os.remove(os.path.join(work, f))   # 前回の撮影の残り（別の試合の可能性もある）を混ぜない
        loaded = open_replay(int(a.match_id.split("_")[1]), players)
        capture(work, end_sec)
        if not loaded()[0]:
            raise SystemExit("撮影中にリプレイが別の試合に切り替わりました。撮り直してください")
    t0 = time.time()
    trk = Tracker(work, tl, players, icons)
    quality = {}
    if a.eval:
        anchors = list(range(0, last_min + 1, 2))
        print("精度（正解位置は2分おき）:")
        quality = evaluate(trk.track(anchors), tl, players, anchors)
    anchors = list(range(0, last_min + 1))
    tr = trk.track(anchors)
    if not a.eval:
        print("精度（正解位置は毎分。キル等の場所だけで測る）:")
    q2 = evaluate(tr, tl, players, anchors)
    quality = {"heldOut": quality, "allAnchors": q2}
    print(f"追跡にかかった時間 {int(time.time() - t0)}秒")
    data = export(tr, match, players, work, a.match_id, end_sec, quality)
    if a.upload:
        upload(data, env)


if __name__ == "__main__":
    main()
