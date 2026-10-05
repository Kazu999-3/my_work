import { redirect } from 'next/navigation';

// 攻略ライブラリは新鋭戦術パイロット(05: KTM Pilot)へ完全移行済み。
// クエリパラメータを保持して05へ安全に転送する。
export default async function LibraryRedirect({
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

  redirect(`https://ktm-pilot.vercel.app/library${qs ? `?${qs}` : ''}`);
}
