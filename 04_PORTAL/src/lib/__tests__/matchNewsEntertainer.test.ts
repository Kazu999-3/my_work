import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchNewsField, MatchNewsArticle } from '../matchNews';

test('buildMatchNewsField: 芸人枠（チーム揺らした大賞）が含まれている場合、正しくDiscordフィールドに反映される', () => {
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
  assert.ok(field.value.includes('🎭 **本日の芸人枠（チーム揺らした大賞）**: **PlayerEntertainer**'));
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
