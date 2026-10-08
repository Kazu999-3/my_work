import { redirect } from 'next/navigation';
import { buildPilotUrl } from '@/lib/pilotRedirect';

// チャンピオン辞典は新鋭戦術パイロット(05: KTM Pilot)へ完全移行済み。
// 旧クエリ(?select= / ?champ=)は05の ?c= へ読み替える。
// 旧ポータルで辞典ページ内のタブだった ?scope= は、05では別の管理画面になっているのでそちらへ送る。
export default async function ChampionsRedirect({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params?.scope === 'health') redirect(buildPilotUrl('/admin/dict-health', {}));
  if (params?.scope === 'knowledge') {
    redirect(buildPilotUrl(params.tab === 'video' ? '/admin/youtube' : '/admin/review', {}));
  }
  const { scope: _scope, ...rest } = params ?? {};
  redirect(buildPilotUrl('', rest, { select: 'c', champ: 'c' }));
}
