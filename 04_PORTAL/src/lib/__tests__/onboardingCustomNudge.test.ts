import test from 'node:test';
import assert from 'node:assert/strict';
import { isCustomNudgeMessage } from '../onboardingChannels';

test('isCustomNudgeMessage: 定期カスタムの案内・対面募集を正しく検知する', () => {
  // 一斉連絡の定型文
  const msg1 = '<@408278454283272192>\n👋 **10/24（土）21:00から週末の定期カスタムです！**\n今週末、もりっく（もり）さん【SILVER】が【SUP】でエントリーしてくれています！対面で勝負してみませんか？⚔️\n👉 https://discord.com/channels/1485636149379858567/1528646515533287497/1562300364815081557';
  assert.equal(isCustomNudgeMessage(msg1), true);

  const msg2 = '👋 **週末の定期カスタム（毎週土日 21:00〜）のお誘いです！**\n現在【MID】の対面枠を特に募集中です！⚔️';
  assert.equal(isCustomNudgeMessage(msg2), true);

  const msg3 = '🙌 この前はカスタムに来てくれてありがとうございました！\n次は **10/24（土）21:00から週末の定期カスタム**があります';
  assert.equal(isCustomNudgeMessage(msg3), true);
});

test('isCustomNudgeMessage: カスタム募集以外のやり取り（会話・お見合い便・ウェルカム挨拶）は除外しない（false）', () => {
  // 通常の相談返信
  const normalReply = 'これでどうでしょう...？';
  assert.equal(isCustomNudgeMessage(normalReply), false);

  // お見合い成立便
  const omiaiMsg = '<@298840213986476032> 🎉 **【お見合い成立！】** 双方がマッチングを希望しました！';
  assert.equal(isCustomNudgeMessage(omiaiMsg), false);

  // 初期ウェルカム挨拶
  const welcomeMsg = '👋 **<@488691896437178378> さん、KTMサーバーへようこそ！** 名簿への登録が完了しました✨\n🚀 **次の一歩: 週末の定期カスタム（毎週土日 21:00〜）に参加する**';
  assert.equal(isCustomNudgeMessage(welcomeMsg), false);
});
