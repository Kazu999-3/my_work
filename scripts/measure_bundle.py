#!/usr/bin/env python
"""各ページが初回に読み込む JS 量を本番で実測する。

    python scripts/measure_bundle.py            # 主要ページを計測
    python scripts/measure_bundle.py --breakdown # 共通chunk / ページ固有chunk に分解

なぜ必要か:
  Next.js 16 (turbopack) は `npm run build` でルート別の "First Load JS" を
  出力しない。そのため「どのページが重いか」を知る手段が無く、推測で
  最適化を始めてしまいがちだった（2026-09-22 時点で実際に2回、推測が実測に否定された）。
  ここでは本番が実際に配信するHTMLから <script src> を拾い、実バイト数を合計する。

⚠️ 読み取り方の注意:
  **ソースファイルのサイズとバンドルサイズは比例しない。**
  balancer/page.tsx はソース176KBだが固有バンドルは400KB（差は依存の分）。
  ファイルを複数に分割しても import され続ける限りバンドルは減らない。
  減らせるのは `next/dynamic` + `ssr:false` で遅延読込にしたときだけ。
"""
import argparse
import concurrent.futures as cf
import re
import sys

import requests

BASE = 'https://my-work-8jbd.vercel.app'
PAGES = ['/', '/balancer', '/champions', '/analyzer', '/casino',
         '/ktm-admin', '/leaderboard', '/synergy', '/mentorship', '/coach']

sess = requests.Session()
sess.headers['User-Agent'] = 'Mozilla/5.0 bundle-audit'


def script_srcs(path):
    """ページHTMLから読み込まれる JS の URL 一覧を取り出す"""
    html = sess.get(BASE + path, timeout=60).text
    srcs = set(re.findall(r'src="(/_next/static/[^"]+\.js)"', html))
    srcs |= set(re.findall(r'"(/_next/static/chunks/[^"]+\.js)"', html))
    return srcs


def size_of(url):
    try:
        r = sess.get(BASE + url, timeout=40)
        return len(r.content) if r.status_code == 200 else 0
    except Exception:
        return 0


def sizes_of(urls):
    with cf.ThreadPoolExecutor(max_workers=12) as ex:
        return dict(zip(urls, ex.map(size_of, urls)))


def measure_pages():
    print('%-16s %12s %9s' % ('ページ', '初回JS', 'chunk数'))
    print('-' * 42)
    rows = []
    for p in PAGES:
        try:
            srcs = script_srcs(p)
        except Exception as e:
            print('%-16s %12s   %s' % (p, '-', str(e)[:40]))
            continue
        if not srcs:
            print('%-16s %12s   %s' % (p, '-', 'scriptが見つからない'))
            continue
        total = sum(sizes_of(srcs).values())
        rows.append((total, p))
        print('%-16s %9.0f KB %7d' % (p, total / 1024, len(srcs)))
    print('-' * 42)
    if rows:
        rows.sort(reverse=True)
        print('最大: %s (%.0f KB) / 最小: %s (%.0f KB)'
              % (rows[0][1], rows[0][0] / 1024, rows[-1][1], rows[-1][0] / 1024))
    return rows


def breakdown():
    """全ページ共通のchunk（＝全ページが必ず払うコスト）と、特定ページ固有の分を分ける"""
    home = script_srcs('/')
    heavy = script_srcs('/balancer')
    coach = script_srcs('/coach')

    shared = home & heavy & coach
    sz = sizes_of(shared)
    print('■ 全ページ共通の chunk %d 本 = %.0f KB（全ページが必ず払う）'
          % (len(shared), sum(sz.values()) / 1024))
    for u, s in sorted(sz.items(), key=lambda kv: -kv[1])[:8]:
        print('    %8.0f KB  %s' % (s / 1024, u.split('/')[-1]))

    print()
    only = heavy - home
    sz2 = sizes_of(only)
    print('■ /balancer 固有の chunk %d 本 = %.0f KB'
          % (len(only), sum(sz2.values()) / 1024))
    for u, s in sorted(sz2.items(), key=lambda kv: -kv[1]):
        print('    %8.0f KB  %s' % (s / 1024, u.split('/')[-1]))

    print()
    print('※ 共通分を削ると全ページに効く。ここが最大の梃子。')
    print('※ ページ固有分は next/dynamic での遅延読込でしか減らない。')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--breakdown', action='store_true',
                    help='共通chunkとページ固有chunkに分解して表示する')
    ap.add_argument('--base', default=BASE, help='計測対象のベースURL')
    args = ap.parse_args()
    BASE = args.base
    try:
        if args.breakdown:
            breakdown()
        else:
            measure_pages()
    except KeyboardInterrupt:
        sys.exit(130)
