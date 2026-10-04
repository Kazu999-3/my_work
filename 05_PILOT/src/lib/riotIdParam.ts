// 「誰の戦績を見るか」を決める共通処理。2026-10-04
//
// 旧ポータルの試合前系API（play-recommendation / heatmap / history-sync / analyze）は
// Riot ID を環境変数 RIOT_GAME_NAME / RIOT_TAG_LINE からだけ取っていた。05の他のタブ（テンポ・試合後・試合中）は
// 画面で入力して端末に保存した Riot ID（localStorage 'coach_riot_id'）を渡す方式なので、それに揃える。
// 画面から渡されなかった時だけ環境変数を使う（GitHub Actions の定期同期など、画面を持たない呼び出し用）。
export function getRiotId(req: Request, body?: any): { gameName: string; tagLine: string } | null {
  const fromQuery = new URL(req.url).searchParams.get('riotId') || '';
  const raw = String(body?.riotId || fromQuery || '').trim();
  if (raw.includes('#')) {
    const [gameName, tagLine] = raw.split('#');
    if (gameName.trim() && tagLine.trim()) return { gameName: gameName.trim(), tagLine: tagLine.trim() };
  }
  const gameName = process.env.RIOT_GAME_NAME;
  const tagLine = process.env.RIOT_TAG_LINE;
  return gameName && tagLine ? { gameName, tagLine } : null;
}

export const RIOT_ID_REQUIRED_MESSAGE = 'Riot ID（名前#タグ）を入力してください。';
