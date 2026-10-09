import { redirect } from 'next/navigation';
import { buildPilotUrl } from '../../lib/pilotRedirect';

// パーソナルコーチは新鋭戦術パイロット(05: KTM Pilot)へ完全移行済み。クエリを保持して05へ転送する。
export default async function CoachRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(buildPilotUrl('/coach', await searchParams));
}
