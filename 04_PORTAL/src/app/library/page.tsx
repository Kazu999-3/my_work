import { redirect } from 'next/navigation';
import { buildPilotUrl } from '@/lib/pilotRedirect';

// 攻略ライブラリは新鋭戦術パイロット(05: KTM Pilot)へ完全移行済み。
// 旧クエリ ?article= は05の ?id= へ読み替える。
export default async function LibraryRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(buildPilotUrl('/library', await searchParams, { article: 'id' }));
}
