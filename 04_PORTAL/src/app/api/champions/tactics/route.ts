import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { normalizeChampionName } from '../../../../lib/championNames';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const championParam = searchParams.get('champion');
    if (!championParam) {
      return NextResponse.json({ error: 'championパラメータが必要です' }, { status: 400 });
    }

    const roleParam = searchParams.get('role');
    const role = roleParam && roleParam !== 'GLOBAL' ? roleParam.toLowerCase() : '';

    const champion = normalizeChampionName(championParam);
    const repoRoot = path.resolve(process.cwd(), '..');
    const tacticsDir = path.join(repoRoot, '01_INTEL', 'tactics');

    // ロール特化バイブル（例: zyra_sup_tactics_bible.md）があれば優先、なければ通常バイブル
    let filePath = role ? path.join(tacticsDir, `${champion.toLowerCase()}_${role}_tactics_bible.md`) : '';
    if (!filePath || !fs.existsSync(filePath)) {
      filePath = path.join(tacticsDir, `${champion.toLowerCase()}_tactics_bible.md`);
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        success: true,
        champion,
        exists: false,
        rawContent: '',
        matchups: [],
        traps: [],
      });
    }

    const rawContent = fs.readFileSync(filePath, 'utf-8');

    // 罠アイテム・没理由のパース
    const traps: string[] = [];
    const trapMatch = rawContent.match(/## (?:🚫|⚠️)[^\n]*[\s\S]*?(?=\n##\s+|$)/);
    if (trapMatch) {
      const trapLines = trapMatch[0].split('\n');
      for (const line of trapLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- **') || trimmed.startsWith('- ❌') || trimmed.startsWith('- 🚫')) {
          traps.push(trimmed.replace(/^[-*]\s*/, ''));
        }
      }
    }

    // 対面実戦ログのパース
    const matchups: Array<{ enemy: string; result: string; learning: string; date?: string; trap?: string }> = [];
    const matchupSections = rawContent.split(/### ⚔️ vs\s+/);
    for (let i = 1; i < matchupSections.length; i++) {
      const sec = matchupSections[i];
      const lines = sec.split('\n');
      const titleLine = lines[0].trim();
      const enemyMatch = titleLine.match(/^([A-Za-z0-9_]+)/);
      const enemy = enemyMatch ? enemyMatch[1] : 'Unknown';
      const dateMatch = titleLine.match(/記録日:\s*(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : undefined;

      let result = 'WIN';
      let learning = '';
      let trap = '';

      for (const l of lines.slice(1)) {
        const tr = l.trim();
        if (tr.includes('結果**:')) {
          result = tr.includes('敗北') || tr.includes('LOSS') ? 'LOSS' : 'WIN';
        } else if (tr.startsWith('- **実戦から得た重要手順') || tr.startsWith('- **重要手順')) {
          // 次のインデント行などを取得
        } else if (tr.startsWith('- ') && !tr.includes('結果**:') && !learning) {
          learning = tr.replace(/^[-*]\s*/, '');
        } else if (tr.startsWith('- **避けるべき罠') || tr.startsWith('- 罠:')) {
          trap = tr.replace(/^[-*]\s*/, '');
        }
      }

      matchups.push({
        enemy,
        result,
        learning: learning || titleLine,
        date,
        trap,
      });
    }

    // 🎥 プロ実演アクションクリップのパース
    const videoClips: Array<{ timestamp: string; url: string; title: string; macro?: string; why: string; how: string; rejected: string }> = [];
    const clipSections = rawContent.split(/###\s+🕒\s+\[/);
    for (let i = 1; i < clipSections.length; i++) {
      const sec = clipSections[i];
      const match = sec.match(/^(\d{2}:\d{2})\]\((https?:\/\/[^\)]+)\)\s*-\s*([^\n]+)/);
      if (match) {
        const timestamp = match[1];
        const url = match[2];
        const title = match[3].trim();

        let macro = '';
        let why = '';
        let how = '';
        let rejected = '';

        const macroMatch = sec.match(/(?:マクロ・状況判断|\*\*Macro\*\*)[*:\s]+([^\n]+)/i);
        if (macroMatch) macro = macroMatch[1].replace(/^[*\-\s]+/, '').trim();

        const whyMatch = sec.match(/(?:判断の理由|\*\*Why\*\*)[*:\s]+([^\n]+)/i);
        if (whyMatch) why = whyMatch[1].replace(/^[*\-\s]+/, '').trim();

        const howMatch = sec.match(/(?:ミクロ・操作のコツ|\*\*How\*\*)[*:\s]+([^\n]+)/i);
        if (howMatch) how = howMatch[1].replace(/^[*\-\s]+/, '').trim();

        const rejMatch = sec.match(/(?:避けるべき罠・没理由|\*\*Rejected\*\*)[*:\s]+([^\n]+)/i);
        if (rejMatch) rejected = rejMatch[1].replace(/^[*\-\s]+/, '').trim();

        videoClips.push({ timestamp, url, title, macro, why, how, rejected });
      }
    }

    return NextResponse.json({
      success: true,
      champion,
      exists: true,
      rawContent,
      matchups,
      traps,
      videoClips,
    });
  } catch (err: any) {
    console.error('[api/champions/tactics] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
