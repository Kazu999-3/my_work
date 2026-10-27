#!/usr/bin/env node
/**
 * compile_note_drafts.mjs
 * 02_FACTORY/01_DRAFTS/note/ 配下の Markdown ドラフトをパースし、
 * 05_PILOT/public/data/note_drafts.json へ事前生成してスマホPWAでの超速描画を実現する。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PILOT_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PILOT_ROOT, '..');
const DRAFTS_DIR = path.join(REPO_ROOT, '02_FACTORY', '01_DRAFTS', 'note');
const OUT_FILE = path.join(PILOT_ROOT, 'public', 'data', 'note_drafts.json');

export function compileNoteDrafts() {
  console.log('📝 note ドラフトの事前コンパイル中...');

  if (!fs.existsSync(DRAFTS_DIR)) {
    console.log(`⚠️ ドラフトディレクトリが見つかりません: ${DRAFTS_DIR}`);
    if (!fs.existsSync(path.dirname(OUT_FILE))) {
      fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    }
    fs.writeFileSync(OUT_FILE, JSON.stringify({ drafts: [], updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    return;
  }

  const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.md'));
  const drafts = [];

  for (const filename of files) {
    const filePath = path.join(DRAFTS_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf8');

    // フロントマターの簡易パース
    let meta = {};
    let body = content;
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

    if (match) {
      const yamlStr = match[1];
      body = match[2];
      for (const line of yamlStr.split('\n')) {
        const m = line.match(/^\s*([\w_]+)\s*:\s*(.*)?\s*$/);
        if (m) {
          let val = m[2] ? m[2].trim() : '';
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          meta[m[1]] = val;
        }
      }
    }

    // タイトル抽出（フロントマターまたは先頭の # 見出し）
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = meta.title || (titleMatch ? titleMatch[1].trim() : filename.replace(/\.md$/, ''));

    // 目次（H2, H3見出し）の抽出
    const headings = [];
    const headingMatches = body.matchAll(/^(#{2,3})\s+(.+)$/gm);
    for (const hm of headingMatches) {
      headings.push({
        level: hm[1].length,
        text: hm[2].trim(),
      });
    }

    drafts.push({
      id: filename.replace(/\.md$/, ''),
      filename,
      title,
      meta,
      charCount: body.length,
      headings,
      content: body,
      updatedAt: fs.statSync(filePath).mtime.toISOString(),
    });
  }

  // 更新日順にソート
  drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (!fs.existsSync(path.dirname(OUT_FILE))) {
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify({ drafts, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  console.log(`✅ ${drafts.length} 件の note ドラフトをコンパイル完了: ${OUT_FILE}`);
}

// 直接実行された場合
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  compileNoteDrafts();
}
