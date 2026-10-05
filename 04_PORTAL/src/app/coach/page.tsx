import { redirect } from 'next/navigation';

// パーソナルコーチは新鋭戦術パイロット(05: KTM Pilot)へ完全移行済み。
// クエリパラメータ(?tab=... / ?champion=... 等)を保持して05へ安全に転送する。
export default async function CoachRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = params
    ? new URLSearchParams(
        Object.entries(params).flatMap(([k, v]) =>
          Array.isArray(v) ? v.map((item) => [k, item]) : v !== undefined ? [[k, v]] : []
        )
      ).toString()
    : '';

  redirect(`https://ktm-pilot.vercel.app/coach${qs ? `?${qs}` : ''}`);
}
