#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
production_health_report.py - 本番の毎朝の健康診断（2026-10-04 新設）

【なぜ作ったか】
2026-10-04 の点検で「止まっているのに誰も気づかない」状態が次々に見つかった。
  - DBバックアップが 9/22〜10/04 の12日間、毎日失敗（パスワード不一致）
  - 辞典の統合が統合済みの記事を3時間おきに統合し直していた
  - 動画解析が文字起こしの時間切れで40分ごとに強制終了を繰り返していた
  - Sovereign DB Sync が鍵の未登録で毎日「成功」扱いのまま何もしていなかった
  - 公開キーで師弟データを誰でも書き換えられるRLSポリシーが残っていた
どれも記録（DB・GitHub Actions）を見れば初日に分かるものだったため、毎朝それを実測して知らせる。

【方針】
- 実測値だけで判定し、数字をそのまま出す（推測で「正常」と書かない。.claude/rules/llm-health.md）
- 結果は毎朝必ず admin_notifications（05/04の通知ベル）へ出す。異常が無くても出すので、
  「通知が来ない＝この健康診断自体が止まった」と気づける
- 異常(FAIL)があれば GitHub Issue を立てる（同じIssueが開いていれば追記）
- 保守: 変更履歴(knowledge_revisions)の間引きも同じ実行で行う（--no-maintenance で無効化）

GitHub Actions(.github/workflows/health-report.yml) から毎朝実行する。
必要な環境変数: DATABASE_URL, GITHUB_TOKEN, GITHUB_REPOSITORY
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

import psycopg

OK, WARN, FAIL = "OK", "WARN", "FAIL"
ICON = {OK: "✅", WARN: "⚠️", FAIL: "🚨"}
JST = timezone(timedelta(hours=9))
LOCAL_DAEMON_HEARTBEAT_ID = "00000000-0000-0000-0000-000000000005"
DB_LIMIT_MB = 500  # Supabase 無料プランの上限

# 失敗していないかを見る定期ワークフロー（ファイル名: 表示名）
WATCHED_WORKFLOWS = {
    "ktm-cloud-worker.yml": "辞典統合・動画発掘",
    "soloq-coach-poll.yml": "ソロQ自動振り返り",
    "soloq-history-sync.yml": "ソロQ戦績同期",
    "edge-cloud-worker.yml": "クラウドワーカー",
    "youtube-monitor.yml": "YouTube新着監視",
    "patch-watchdog.yml": "パッチ番犬",
    "migrate.yml": "マイグレーション自動適用",
    "sentinel.yml": "Sentinel",
    "champ-dict-update.yml": "辞典一括更新(週次)",
    "lane-role-update.yml": "レーン所属更新(週次)",
    "riot-jungle-timing-update.yml": "JG周回タイム更新(週次)",
}
# 「成功」扱いでも、ログにこの文言があれば実際には何もしていない（鍵の未登録など）。
# 2026-10-04: sync.yml（Sovereign DB Sync）が「同期スキップ」のまま毎日成功していたのを検出→ユーザー判断で削除。
# 同じ型の黙ったスキップを持つワークフローが見つかったら、ここへ { "ファイル名": "ログの文言" } で追加する。
SILENT_SKIP_MARKERS = {}


class Report:
    def __init__(self):
        self.items = []

    def add(self, status, title, detail):
        self.items.append((status, title, detail))

    @property
    def worst(self):
        if any(s == FAIL for s, _, _ in self.items):
            return FAIL
        if any(s == WARN for s, _, _ in self.items):
            return WARN
        return OK

    def counts(self):
        return {k: sum(1 for s, _, _ in self.items if s == k) for k in (FAIL, WARN, OK)}

    def markdown(self):
        order = {FAIL: 0, WARN: 1, OK: 2}
        lines = []
        for s, t, d in sorted(self.items, key=lambda x: order[x[0]]):
            lines.append(f"- {ICON[s]} **{t}**: {d}")
        return "\n".join(lines)


# ---------------------------------------------------------------- GitHub
def gh_get(path):
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "Kazu999-3/my_work")
    req = urllib.request.Request(f"https://api.github.com/repos/{repo}{path}")
    req.add_header("Accept", "application/vnd.github+json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode())


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def gh_get_text(path):
    """ログ系APIはストレージ(Azure Blob)の署名付きURLへ302で転送される。標準の転送処理は
    GitHubの認証ヘッダーを転送先にも付けて拒否されるため、転送先へは認証なしで取りに行く。"""
    token = os.environ.get("GITHUB_TOKEN", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "Kazu999-3/my_work")
    req = urllib.request.Request(f"https://api.github.com/repos/{repo}{path}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        with opener.open(req, timeout=60) as res:
            return res.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        if e.code not in (301, 302, 303, 307, 308):
            raise
        location = e.headers.get("Location")
    with urllib.request.urlopen(location, timeout=60) as res:
        return res.read().decode("utf-8", errors="replace")


def parse_ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def fmt_age(dt):
    if dt is None:
        return "記録なし"
    sec = (datetime.now(timezone.utc) - dt).total_seconds()
    if sec < 3600:
        return f"{int(sec // 60)}分前"
    if sec < 86400:
        return f"{sec / 3600:.1f}時間前"
    return f"{sec / 86400:.1f}日前"


def check_backup(r: Report):
    runs = gh_get("/actions/workflows/db-backup.yml/runs?per_page=30&status=completed").get("workflow_runs", [])
    success = [x for x in runs if x.get("conclusion") == "success"]
    last_ok = parse_ts(success[0]["created_at"]) if success else None
    fails = 0
    for x in runs:
        if x.get("conclusion") == "success":
            break
        fails += 1
    if last_ok and datetime.now(timezone.utc) - last_ok <= timedelta(hours=30):
        r.add(OK, "DBバックアップ", f"最終成功 {fmt_age(last_ok)}")
    else:
        r.add(FAIL, "DBバックアップ",
              f"最終成功 {fmt_age(last_ok)}・その後の失敗 {fails}回。バックアップは30日で失効するため要対応"
              "（よくある原因: Secrets の DATABASE_URL のパスワード不一致）")


def check_workflows(r: Report):
    problems, checked = [], 0
    for wf, label in WATCHED_WORKFLOWS.items():
        try:
            runs = gh_get(f"/actions/workflows/{wf}/runs?per_page=5&status=completed").get("workflow_runs", [])
        except Exception as e:
            problems.append(f"{label}: 実行履歴を取得できず（{e}）")
            continue
        if not runs:
            continue
        checked += 1
        latest = runs[0]
        if latest.get("conclusion") not in ("success", "skipped"):
            problems.append(f"{label}: 直近の実行が {latest.get('conclusion')}（{fmt_age(parse_ts(latest['created_at']))}）")
            continue
        marker = SILENT_SKIP_MARKERS.get(wf)
        if marker:
            # 実行単位のログはzipで返るため、ジョブ単位のログAPI（テキスト）で読む
            try:
                jobs = gh_get(f"/actions/runs/{latest['id']}/jobs").get("jobs", [])
                log = "".join(gh_get_text(f"/actions/jobs/{j['id']}/logs") for j in jobs)
            except Exception as e:
                # 読めなかったことを黙って「問題なし」にしない
                problems.append(f"{label}: ログを読めず「何もしていない」かを判定できない（{e}）")
                continue
            if marker in log:
                problems.append(f"{label}: 「成功」だがログに「{marker}」＝実際には何もしていない")
    if problems:
        r.add(FAIL, f"定期ワークフロー（{checked}本を確認）", " / ".join(problems))
    else:
        r.add(OK, f"定期ワークフロー（{checked}本を確認）", "直近の実行はすべて成功")


# ---------------------------------------------------------------- DB
def q1(cur, sql, params=None):
    cur.execute(sql, params or ())
    return cur.fetchone()


def check_pc_daemon(r: Report, cur):
    row = q1(cur, "select updated_at, payload->>'status' from edge_tasks where id = %s", (LOCAL_DAEMON_HEARTBEAT_ID,))
    last = row[0] if row else None
    if last and datetime.now(timezone.utc) - last <= timedelta(hours=6):
        r.add(OK, "PCデーモン", f"最終ハートビート {fmt_age(last)}（{row[1] or '状態不明'}）")
    else:
        r.add(WARN, "PCデーモン",
              f"最終ハートビート {fmt_age(last)}。PCが止まっているか、デーモンが落ちている（動画解析が止まる）")


def check_edge_tasks(r: Report, cur):
    cur.execute("""
        select task_type,
               count(*) filter (where status = 'failed') failed,
               count(*) filter (where status = 'completed') done
        from edge_tasks
        where created_at > now() - interval '24 hours'
          and id not in ('00000000-0000-0000-0000-000000000000', %s)
        group by task_type
    """, (LOCAL_DAEMON_HEARTBEAT_ID,))
    rows = cur.fetchall()
    failed = [(t, f, d) for t, f, d in rows if f > 0]
    total_f = sum(f for _, f, _ in rows)
    total_d = sum(d for _, _, d in rows)
    if not failed:
        r.add(OK, "タスク実行（24時間）", f"完了 {total_d}件・失敗 0件")
        return
    latest = q1(cur, """
        select task_type, left(coalesce(error_message, ''), 120) from edge_tasks
        where status = 'failed' and created_at > now() - interval '24 hours'
        order by updated_at desc limit 1
    """)
    detail = ", ".join(f"{t} {f}件" for t, f, _ in failed)
    status = FAIL if total_f >= 3 else WARN
    r.add(status, "タスク実行（24時間）",
          f"完了 {total_d}件・失敗 {total_f}件（{detail}）。最新の失敗: {latest[0]}「{latest[1]}」")


def check_youtube_queue(r: Report, cur):
    pending, done48 = q1(cur, """
        select count(*) filter (where status = 'pending'),
               count(*) filter (where status = 'completed' and updated_at > now() - interval '48 hours')
        from youtube_queue
    """)
    if pending > 0 and done48 == 0:
        r.add(WARN, "動画解析キュー", f"待ち {pending}本だが、48時間で1本も完了していない")
    else:
        r.add(OK, "動画解析キュー", f"待ち {pending}本・48時間の完了 {done48}本")


def check_integration_backlog(r: Report, cur):
    backlog, pending_review = q1(cur, """
        select count(*) filter (where review_status = 'approved'
                                  and coalesce(champion, '') not in ('', 'Unknown', 'UNKNOWN', 'GENERAL', 'null')
                                  and (tags is null or not (tags @> '{__DELETED__}' or tags @> '{__INTEGRATED__}'))
                                  and created_at < now() - interval '6 hours'),
               count(*) filter (where review_status = 'pending')
        from personal_knowledge
    """)
    if backlog > 0:
        r.add(WARN, "辞典への統合", f"承認済みで未統合の記事 {backlog}件（6時間以上前のもの）。dict-sync が動いていない可能性")
    else:
        r.add(OK, "辞典への統合", f"未統合の承認済み記事 0件・承認待ち {pending_review}件")


def check_soloq_coach(r: Report, cur):
    newest_game, newest_analysis = q1(cur, """
        select (select max(game_start_timestamp) from soloq_match_history),
               (select max(created_at) from coach_analyses)
    """)
    if newest_game and newest_analysis and newest_game - newest_analysis > timedelta(days=1):
        r.add(WARN, "ソロQ自動振り返り",
              f"最新の試合({fmt_age(newest_game)})より自動振り返り({fmt_age(newest_analysis)})が1日以上古い")
    else:
        r.add(OK, "ソロQ自動振り返り", f"最新の試合 {fmt_age(newest_game)}・最新の振り返り {fmt_age(newest_analysis)}")


# pg_cron（migration 93）で動かしている定期呼び出し。消えた・止まった・呼び出し先がエラーを返す、を検知する。
# 2026-10-07: 6月に手で登録された pg_cron 2本が毎回「0件」「見つからない」を返したまま数か月誰にも気づかれていなかった。
EXPECTED_CRON_JOBS = ("poll-soloq-coach", "dispatch-edge-cloud-worker")


def check_pg_cron(r: Report, cur):
    cur.execute("select jobname, active from cron.job")
    jobs = dict(cur.fetchall())
    missing = [j for j in EXPECTED_CRON_JOBS if not jobs.get(j)]
    failed_runs, last_fail = q1(cur, """
        select count(*) filter (where d.status <> 'succeeded'),
               max(left(d.return_message, 120)) filter (where d.status <> 'succeeded')
        from cron.job_run_details d
        where d.start_time > now() - interval '24 hours'
    """)
    # pg_net の応答は約6時間しか残らないため、残っている分で判定する
    bad_http, total_http, sample = q1(cur, """
        select count(*) filter (where status_code is null or status_code >= 300),
               count(*),
               max(coalesce(status_code::text, 'timeout') || ' ' || left(coalesce(content::text, error_msg, ''), 80))
                 filter (where status_code is null or status_code >= 300)
        from net._http_response
    """)
    problems = []
    if missing:
        problems.append(f"登録が無い・停止中: {', '.join(missing)}")
    if failed_runs:
        problems.append(f"24時間の実行失敗 {failed_runs}件（{last_fail}）")
    if bad_http:
        problems.append(f"呼び出し先がエラー {bad_http}/{total_http}件（{sample}）")
    if problems:
        r.add(WARN, "DBの定期実行（pg_cron）", " / ".join(problems))
    else:
        r.add(OK, "DBの定期実行（pg_cron）", f"{len(EXPECTED_CRON_JOBS)}本とも稼働・直近の呼び出し {total_http}件すべて正常")


def check_db_size(r: Report, cur):
    size_mb = q1(cur, "select pg_database_size(current_database()) / 1048576.0")[0]
    rev_mb = q1(cur, "select pg_total_relation_size('public.knowledge_revisions') / 1048576.0")[0]
    pct = size_mb / DB_LIMIT_MB * 100
    status = FAIL if pct >= 90 else WARN if pct >= 70 else OK
    r.add(status, "DB容量", f"{size_mb:.0f}MB / {DB_LIMIT_MB}MB（{pct:.0f}%）・うち変更履歴 {rev_mb:.0f}MB")


def check_rls_regressions(r: Report, cur):
    # 2026-10-04 に撤去した「誰でも書ける」「ログイン済みなら許可」のポリシーが再び入っていないか
    cur.execute("""
        select tablename || ':' || policyname from pg_policies
        where schemaname = 'public'
          and (roles::text like '%%authenticated%%'
               or (roles::text in ('{public}', '{anon}') and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')))
    """)
    rows = [x[0] for x in cur.fetchall()]
    if rows:
        r.add(FAIL, "RLS（書き込みの穴）",
              f"公開キー/自己登録ユーザーが書き込めるポリシーが {len(rows)}個: {', '.join(rows[:6])}"
              "（サーバーはサービスロールで書くので通常は不要。migration 86/87 参照）")
    else:
        r.add(OK, "RLS（書き込みの穴）", "公開キー・ログイン済みロール向けの書き込みポリシー 0個")


# ---------------------------------------------------------------- 保守
def prune_revisions(r: Report, cur, keep_per_target=5, older_than_days=90):
    """変更履歴は変更のたびに本文全体の前後を保存するため容量を食う。
    90日を過ぎたものは、対象(target_type, target_key, field)ごとに最新 keep_per_target 件だけ残して消す。"""
    cur.execute("""
        with ranked as (
          select id, row_number() over (partition by target_type, target_key, field order by created_at desc) rn
          from knowledge_revisions
        )
        delete from knowledge_revisions k
        using ranked
        where k.id = ranked.id and ranked.rn > %s and k.created_at < now() - make_interval(days => %s)
    """, (keep_per_target, older_than_days))
    deleted = cur.rowcount
    r.add(OK, "保守: 変更履歴の間引き",
          f"{older_than_days}日超・対象ごとに最新{keep_per_target}件を残して {deleted}件を削除")


# ---------------------------------------------------------------- 出力
def notify(cur, report: Report):
    c = report.counts()
    head = {OK: "✅ 異常なし", WARN: f"⚠️ 注意 {c[WARN]}件", FAIL: f"🚨 異常 {c[FAIL]}件"}[report.worst]
    title = f"🩺 毎朝の健康診断: {head}"
    cur.execute(
        "insert into admin_notifications (type, title, body, url, data) values (%s, %s, %s, %s, %s)",
        ("system_health", title, report.markdown().replace("**", "")[:4000], "/admin/dashboard",
         json.dumps({"counts": c, "worst": report.worst}, ensure_ascii=False)),
    )
    return title


def send_fail_to_error_log(report: Report):
    """異常(FAIL)がある時だけ、04のエラー受付API経由で Discord の #エラーログ へ送る。
    このワークフローはDiscordの鍵を持たないため04経由にしている（2026-10-08: 失敗の集約先を #エラーログ に統一）。"""
    if report.worst != FAIL:
        return
    portal = os.environ.get("PORTAL_URL", "https://my-work-8jbd.vercel.app").rstrip("/")
    body = json.dumps({
        "app": "health",
        "source": "CRON",
        "message": "毎朝の健康診断で異常を検知\n" + report.markdown().replace("**", "")[:1500],
        "path": "health-report",
    }).encode()
    secret = os.environ.get("PORTAL_BOT_SECRET", "").strip()
    if not secret:
        print("PORTAL_BOT_SECRET 未設定のため #エラーログ へは送りません")
        return
    req = urllib.request.Request(f"{portal}/api/logs/error", data=body, method="POST",
                                 headers={"Content-Type": "application/json", "x-bot-secret": secret})
    try:
        urllib.request.urlopen(req, timeout=20)
    except Exception as e:
        print(f"#エラーログ への送信に失敗: {e}")


def open_issue(report: Report):
    """FAIL があれば GitHub Issue を立てる（同じタイトルが開いていれば追記）"""
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not token or not repo:
        return
    title = "🩺 毎朝の健康診断で異常があります"
    body = report.markdown() + f"\n\n（{datetime.now(JST):%Y-%m-%d %H:%M} JST）"

    def call(method, path, payload=None):
        req = urllib.request.Request(f"https://api.github.com/repos/{repo}{path}", method=method,
                                     data=json.dumps(payload).encode() if payload else None)
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Accept", "application/vnd.github+json")
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode() or "{}")

    issues = call("GET", "/issues?state=open&per_page=50")
    existing = next((i for i in issues if i.get("title") == title and "pull_request" not in i), None)
    if existing:
        call("POST", f"/issues/{existing['number']}/comments", {"body": body})
    else:
        call("POST", "/issues", {"title": title, "body": body})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-maintenance", action="store_true", help="変更履歴の間引きをしない")
    ap.add_argument("--dry-run", action="store_true", help="通知・Issue・削除を行わず結果だけ表示する")
    args = ap.parse_args()

    report = Report()
    for fn in (check_backup, check_workflows):
        try:
            fn(report)
        except Exception as e:
            report.add(WARN, fn.__name__, f"確認自体に失敗: {e}")

    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=False) as conn:
        with conn.cursor() as cur:
            for fn in (check_pc_daemon, check_edge_tasks, check_youtube_queue, check_integration_backlog,
                       check_soloq_coach, check_pg_cron, check_db_size, check_rls_regressions):
                try:
                    fn(report, cur)
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    report.add(WARN, fn.__name__, f"確認自体に失敗: {e}")
            if not args.no_maintenance and not args.dry_run:
                try:
                    prune_revisions(report, cur)
                    conn.commit()
                except Exception as e:
                    conn.rollback()
                    report.add(WARN, "保守: 変更履歴の間引き", f"失敗: {e}")
            if not args.dry_run:
                title = notify(cur, report)
                conn.commit()
                print(f"通知: {title}")

    md = report.markdown()
    print(md)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(f"## 🩺 毎朝の健康診断\n\n{md}\n")
    if report.worst == FAIL and not args.dry_run:
        send_fail_to_error_log(report)
        try:
            open_issue(report)
        except Exception as e:
            print(f"Issueの作成に失敗: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
