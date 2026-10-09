import { getRoster, resolveRosterChampion, getChampionNameJa, type RosterChampion } from './championRoster';

export interface MatchupInfo {
  isMatchup: boolean;
  myChampion: string | null;       // 英語ID (例: 'Corki')
  myChampionJa: string | null;     // 日本語名 (例: 'コーキ')
  enemyChampion: string | null;    // 英語ID (例: 'Tryndamere')
  enemyChampionJa: string | null;  // 日本語名 (例: 'トリンダメア')
  label: string | null;            // バッジ用表示文字列 (例: 'vs トリンダメア')
}

/**
 * テキスト中からチャンピオン（英語IDまたは日本語名）を貪欲に探索する
 */
function findChampionInText(text: string, roster: RosterChampion[]): RosterChampion | null {
  const clean = text.trim();
  if (!clean) return null;

  // 1. 完全一致
  const exact = roster.find(
    (c) => c.name.toLowerCase() === clean.toLowerCase() || c.id.toLowerCase() === clean.toLowerCase()
  );
  if (exact) return exact;

  // 2. 部分一致（長い名前優先）
  const sorted = [...roster].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) {
    if (clean.includes(c.name)) return c;
  }
  for (const c of sorted) {
    const rx = new RegExp(`\\b${c.id}\\b`, 'i');
    if (rx.test(clean)) return c;
  }

  return null;
}

/**
 * タイトル・タグ・指定チャンピオンから対面（VS）情報を検出する
 */
export async function detectArticleMatchup(params: {
  title?: string | null;
  content?: string | null;
  tags?: string[] | null;
  champion?: string | null;
}): Promise<MatchupInfo> {
  const title = String(params.title || '');
  const tags = Array.isArray(params.tags) ? params.tags : [];
  const articleChamp = String(params.champion || '').trim();

  const emptyResult: MatchupInfo = {
    isMatchup: false,
    myChampion: null,
    myChampionJa: null,
    enemyChampion: null,
    enemyChampionJa: null,
    label: null,
  };

  const roster = await getRoster().catch(() => []);
  if (roster.length === 0) return emptyResult;

  // 記事に登録された自チャンピオン（あれば）
  let myChampId: string | null = null;
  if (articleChamp && articleChamp !== 'Unknown' && articleChamp !== 'null') {
    myChampId = await resolveRosterChampion(articleChamp.split(/[,、/]/)[0]);
  }

  // 1. "A vs B" パターン (例: "コーキ vs トリンダメア", "Lee Sin vs Naafiri")
  const vsMatch = title.match(/([^\s【\[(]+?)\s*(?:vs\.?|VS\.?|Vs\.?)\s*([^\s】\])\s:：,，!！]+)/i);
  if (vsMatch) {
    const leftText = vsMatch[1].replace(/^[【\[(]+/, '').trim();
    const rightText = vsMatch[2].replace(/[】\])!\?！？]+$/, '').trim();

    const leftChamp = findChampionInText(leftText, roster);
    const rightChamp = findChampionInText(rightText, roster);

    if (leftChamp && rightChamp && leftChamp.id !== rightChamp.id) {
      // 左右両方がチャンピオン
      const my = myChampId === rightChamp.id ? rightChamp : leftChamp;
      const enemy = my.id === leftChamp.id ? rightChamp : leftChamp;
      return {
        isMatchup: true,
        myChampion: my.id,
        myChampionJa: my.name,
        enemyChampion: enemy.id,
        enemyChampionJa: enemy.name,
        label: `vs ${enemy.name}`,
      };
    } else if (rightChamp) {
      // 右側だけがチャンピオン (例: "ジャングル攻略 vs Sylas", "(vs Kindred)")
      const enemy = rightChamp;
      const myId = myChampId || (leftChamp ? leftChamp.id : null);
      const myJa = myId ? await getChampionNameJa(myId) : null;
      return {
        isMatchup: true,
        myChampion: myId,
        myChampionJa: myJa,
        enemyChampion: enemy.id,
        enemyChampionJa: enemy.name,
        label: `vs ${enemy.name}`,
      };
    }
  }

  // 2. "対面〇〇" / "対〇〇" / "〇〇対策" / "How to fight 〇〇" パターン
  const taiMatch = title.match(/(?:対面|対|fight\s+)([A-Za-z\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+)/i)
    || title.match(/([A-Za-z\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+?)(?:対策|攻略ガイド|戦術)/i);
  if (taiMatch) {
    const enemyCandidate = findChampionInText(taiMatch[1], roster);
    if (enemyCandidate) {
      const isCounterGuide = /対策|how\s+to\s+fight/i.test(title);
      const enemy = enemyCandidate;
      // 対策ガイドの場合、記事の champion がそのキャラ自身なら相手として扱う
      const myId = (isCounterGuide && myChampId === enemy.id) ? null : myChampId;
      const myJa = myId ? await getChampionNameJa(myId) : null;
      return {
        isMatchup: true,
        myChampion: myId,
        myChampionJa: myJa,
        enemyChampion: enemy.id,
        enemyChampionJa: enemy.name,
        label: `vs ${enemy.name}`,
      };
    }
  }

  // 3. 自チャンピオンが確定している状態で、タイトル中から別のチャンピオンを探す
  if (myChampId) {
    const sorted = [...roster].filter((c) => c.id !== myChampId).sort((a, b) => b.name.length - a.name.length);
    for (const c of sorted) {
      // タイトルに相手の名前または英語IDが含まれ、かつ「対面」や「vs」等のキーワードがあるか
      const hasEnemy = title.includes(c.name) || new RegExp(`\\b${c.id}\\b`, 'i').test(title);
      const hasMatchupKeyword = /vs|対面|対決|対策|マッチアップ/i.test(title) || tags.some((t) => /vs|対面/i.test(t));
      if (hasEnemy && hasMatchupKeyword) {
        const myJa = await getChampionNameJa(myChampId);
        return {
          isMatchup: true,
          myChampion: myChampId,
          myChampionJa: myJa,
          enemyChampion: c.id,
          enemyChampionJa: c.name,
          label: `vs ${c.name}`,
        };
      }
    }
  }

  return emptyResult;
}
