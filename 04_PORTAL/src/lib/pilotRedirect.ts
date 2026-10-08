// 個人用画面を05(KTM Pilot)へ移した後も、旧URL(ブックマーク・通知・04内のリンク)から正しく開けるように
// クエリを引き継いで転送する。05は旧ポータルと違うクエリ名を使うため、ここで読み替える(2026-10-08)。
//   辞典: 04 ?select= / ?champ= → 05 ?c=、04 ?scope=health → 05 /admin/dict-health
//   ライブラリ: 04 ?article= → 05 ?id=
export const PILOT_ORIGIN = 'https://ktm-pilot.vercel.app';

type RawParams = Record<string, string | string[] | undefined> | undefined;

export function buildPilotUrl(path: string, params: RawParams, renames: Record<string, string> = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined) continue;
    const key = renames[k] ?? k;
    for (const item of Array.isArray(v) ? v : [v]) qs.append(key, item);
  }
  const s = qs.toString();
  return `${PILOT_ORIGIN}${path}${s ? `?${s}` : ''}`;
}
