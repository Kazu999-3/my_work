// 本番の画面が「普通に開けるか」を実際のブラウザ（Playwright / Chromium）で確認するスモークテスト。
//
// 2026-10-16 新設。04 の画面はほぼクライアント側で描画されるため、サーバーが 200 を返しても
// ブラウザ上で例外が出て真っ白・エラー表示になることがある。そこで各ページを実際に開き、
//   1. ページ内で未処理の JavaScript 例外（pageerror）が出ていないか
//   2. Next.js のエラー画面（Application error / client-side exception）が出ていないか
//   3. 同じサイトの API が 5xx を返していないか
//   4. ページ自体の応答が 4xx/5xx でないか（ログインへの転送は正常扱い）
// を見る。05 はほぼ全ページがログイン必須のため、ログイン画面の表示と、各ページがエラーではなく
// ログイン画面へ転送されることだけを確認する（テストにログイン情報は持たせない）。
//
// 失敗時は 04 のエラー受付API経由で Discord #エラーログ へ送り、終了コード1で終わる
// （ワークフローの失敗は毎朝の健康診断でも拾われる）。
//
// 使い方: node scripts/smoke_test.mjs           （PORTAL_BOT_SECRET があれば失敗時に通知）
//        node scripts/smoke_test.mjs --no-notify（通知しない）

import { chromium } from 'playwright';

const PORTAL = (process.env.PORTAL_URL || 'https://my-work-8jbd.vercel.app').replace(/\/$/, '');
const PILOT = (process.env.PILOT_URL || 'https://ktm-pilot.vercel.app').replace(/\/$/, '');
const NO_NOTIFY = process.argv.includes('--no-notify');

// 04: ログイン無しで開ける主要画面（/admin はログインへ転送されるのが正常）
const PORTAL_PAGES = [
  '/', '/balancer', '/casino', '/mentorship', '/guide', '/leaderboard', '/history',
  '/mypage', '/player', '/synergy', '/analyzer', '/ktm-admin', '/lane-guides',
  '/coach', '/champions', '/library', '/login', '/admin',
];
// 05: ログイン画面と、ログイン必須ページの転送
const PILOT_PAGES = ['/login', '/', '/coach', '/library', '/admin/dashboard'];

// ブラウザ側の例外のうち、拡張機能や第三者スクリプト由来でサイトの不具合ではないもの
const IGNORED_PAGE_ERRORS = [/ResizeObserver loop/i];

const ERROR_SCREEN_PATTERNS = [
  /Application error: a client-side exception has occurred/i,
  /Internal Server Error/i,
  /This page could not be found/i,
];

async function checkPage(browser, base, path) {
  const context = await browser.newContext({ locale: 'ja-JP' });
  const page = await context.newPage();
  const problems = [];
  const origin = new URL(base).origin;

  page.on('pageerror', (err) => {
    const msg = String(err?.message || err);
    if (!IGNORED_PAGE_ERRORS.some((re) => re.test(msg))) problems.push(`JS例外: ${msg.slice(0, 200)}`);
  });
  page.on('response', (res) => {
    const url = res.url();
    if (url.startsWith(origin) && url.includes('/api/') && res.status() >= 500) {
      problems.push(`API ${res.status()}: ${url.replace(origin, '')}`);
    }
  });

  try {
    const res = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 45000 });
    const status = res ? res.status() : 0;
    if (status >= 400) problems.push(`ページ応答 ${status}`);
    // クライアント描画の完了とその後の API 呼び出しを少し待つ
    await page.waitForTimeout(2000);
    const text = await page.locator('body').innerText().catch(() => '');
    for (const re of ERROR_SCREEN_PATTERNS) {
      if (re.test(text)) problems.push(`エラー画面: ${re.source}`);
    }
    if (text.trim().length < 20) problems.push('本文がほぼ空（描画失敗の疑い）');
  } catch (e) {
    problems.push(`読み込み失敗: ${String(e?.message || e).split('\n')[0].slice(0, 200)}`);
  } finally {
    await context.close();
  }
  return problems;
}

async function notify(failures) {
  const secret = (process.env.PORTAL_BOT_SECRET || '').trim();
  if (NO_NOTIFY || !secret) {
    console.log(NO_NOTIFY ? '--no-notify のため通知しません' : 'PORTAL_BOT_SECRET 未設定のため通知しません');
    return;
  }
  const lines = failures.map((f) => `- ${f.site}${f.path}: ${f.problems.join(' / ')}`).join('\n');
  try {
    const res = await fetch(`${PORTAL}/api/logs/error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bot-secret': secret },
      body: JSON.stringify({
        app: 'health',
        source: 'CRON',
        path: 'smoke-test',
        message: `本番画面のスモークテストで ${failures.length} ページに異常\n${lines}`.slice(0, 1800),
      }),
    });
    console.log(`#エラーログ へ通知: ${res.status}`);
  } catch (e) {
    // 04 自体が落ちていると通知も届かない。その場合はワークフローの失敗として毎朝の健康診断で拾う
    console.log(`#エラーログ への通知に失敗: ${e?.message || e}`);
  }
}

const browser = await chromium.launch();
const failures = [];
for (const [site, base, pages] of [['04', PORTAL, PORTAL_PAGES], ['05', PILOT, PILOT_PAGES]]) {
  for (const path of pages) {
    const problems = await checkPage(browser, base, path);
    console.log(`${problems.length ? '❌' : '✅'} ${site} ${path}${problems.length ? '  ' + problems.join(' / ') : ''}`);
    if (problems.length) failures.push({ site, path, problems });
  }
}
await browser.close();

if (failures.length) {
  await notify(failures);
  process.exit(1);
}
console.log(`全 ${PORTAL_PAGES.length + PILOT_PAGES.length} ページ正常`);
