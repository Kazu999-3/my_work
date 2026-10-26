import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchNewsField, filterEntertainerCandidates, sanitizeEntertainer, MatchNewsArticle } from '../matchNews';

test('buildMatchNewsField: 芸人枠が含まれている場合、正しくDiscordフィールドに反映される', () => {
  const article: MatchNewsArticle = {
    headline: '大熱戦の末にBLUEが逆転勝利！',
    subheadline: '一進一退の攻防を制したのは怒涛の連携',
    lead: '息をのむ激闘が繰り広げられた。',
    mvp: {
      name: 'PlayerMVP',
      champion: 'Ahri',
      kda: '12/2/8',
      role: 'MID',
      comment: '圧巻のキャリー力でチームを勝利に導いた'
    },
    fighterOfTheMatch: {
      name: 'PlayerFighter',
      champion: 'Aatrox',
      kda: '6/4/3',
      role: 'TOP',
      comment: '敗軍の中で孤軍奮闘し最後まで抗った'
    },
    entertainer: {
      name: 'PlayerEntertainer',
      champion: 'Yasuo',
      kda: '1/11/4',
      role: 'MID',
      comment: '怒涛の特攻で戦場を大いに沸かせ、敵も味方もハラハラさせた！'
    },
    turningPoint: 'バロン前での集団戦で一気に形勢逆転',
    keyMatchup: 'MIDの対面勝負',
    sideStory: 'サポートの視界確保が光った'
  };

  const field = buildMatchNewsField(article);
  assert.ok(field.name.includes('大熱戦の末にBLUEが逆転勝利！'));
  assert.ok(field.value.includes('本日のMVP'));
  assert.ok(field.value.includes('敢闘賞(敗軍の将)'));
  assert.ok(field.value.includes('🎭 **本日の芸人枠**: **PlayerEntertainer**'));
  assert.ok(field.value.includes('怒涛の特攻で戦場を大いに沸かせ、敵も味方もハラハラさせた！'));
});

test('buildMatchNewsField: 芸人枠がない場合でも安全にフィールドが組み立てられる', () => {
  const article: MatchNewsArticle = {
    headline: 'BLUE勝利',
    subheadline: '快勝',
    lead: 'リード文',
    mvp: {
      name: 'PlayerMVP',
      kda: '10/0/5',
      role: 'ADC',
      comment: 'ノーデスキャリー'
    },
    turningPoint: 'ドラゴン戦',
    keyMatchup: 'BOT対決',
    sideStory: 'JGのガンク'
  };

  const field = buildMatchNewsField(article);
  assert.ok(field.value.includes('本日のMVP'));
  assert.ok(!field.value.includes('芸人枠'));
});

test('filterEntertainerCandidates: 初参加者(isFirstTime: true または totalGames <= 1)を芸人枠候補から完全除外する', () => {
  const participants = [
    { name: 'VeteranA', totalGames: 45, isFirstTime: false },
    { name: 'VeteranB', totalGames: 12, isFirstTime: false },
    { name: 'NewbieFirst', totalGames: 0, isFirstTime: true },
    { name: 'NewbieDayOne', totalGames: 1, isFirstTime: false },
    { name: 'WinnerMVP', totalGames: 30, isFirstTime: false },
  ];

  const candidates = filterEntertainerCandidates(participants, 'WinnerMVP');

  const names = candidates.map((c) => c.name);
  assert.deepEqual(names, ['VeteranA', 'VeteranB']);
  assert.ok(!names.includes('NewbieFirst'), '初参加フラグ持ちが除外されること');
  assert.ok(!names.includes('NewbieDayOne'), '通算1戦以下の新人が除外されること');
  assert.ok(!names.includes('WinnerMVP'), 'MVP勝者が除外されること');
});

test('sanitizeEntertainer: AIが誤って初参加者を芸人枠に出力しても二重防波堤で削除される', () => {
  const participants = [
    { name: 'VeteranA', totalGames: 20 },
    { name: 'Newbie', totalGames: 0, isFirstTime: true },
  ];

  const article: Partial<MatchNewsArticle> = {
    headline: '速報',
    entertainer: {
      name: 'Newbie',
      champion: 'Teemo',
      kda: '0/10/0',
      role: 'TOP',
      comment: '初参加でデス量産',
    },
  };

  sanitizeEntertainer(article, participants, true);
  assert.strictEqual(article.entertainer, undefined, '初参加者が芸人枠だった場合はキーが削除されること');
});

test('sanitizeEntertainer: 候補者ゼロ(hasValidCandidates: false)の場合は芸人枠が削除される', () => {
  const participants = [
    { name: 'SoloVeteran', totalGames: 20 },
  ];

  const article: Partial<MatchNewsArticle> = {
    headline: '速報',
    entertainer: {
      name: 'SoloVeteran',
      champion: 'Garen',
      kda: '2/8/1',
      role: 'TOP',
      comment: '味方の胃に穴を開けた',
    },
  };

  sanitizeEntertainer(article, participants, false);
  assert.strictEqual(article.entertainer, undefined, '有効候補がいない場合は削除されること');
});
