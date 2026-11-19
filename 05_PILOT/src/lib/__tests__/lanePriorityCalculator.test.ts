import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateLanePriority, PlayerData } from '../lanePriorityCalculator';

describe('Lane Priority & Power Spike Calculator Tests', () => {
  const basePlayers: PlayerData[] = [
    // Order (味方チーム)
    { championName: 'Aatrox', team: 'ORDER', position: 'TOP', level: 6, kills: 1, deaths: 0, assists: 0, cs: 50 },
    { championName: 'Viego', team: 'ORDER', position: 'JUNGLE', level: 5, kills: 0, deaths: 0, assists: 0, cs: 35 },
    { championName: 'Ahri', team: 'ORDER', position: 'MIDDLE', level: 5, kills: 0, deaths: 0, assists: 0, cs: 40 },
    { championName: 'Jinx', team: 'ORDER', position: 'BOTTOM', level: 4, kills: 0, deaths: 2, assists: 0, cs: 30 },
    { championName: 'Thresh', team: 'ORDER', position: 'UTILITY', level: 3, kills: 0, deaths: 1, assists: 0, cs: 5 },

    // Chaos (敵チーム)
    { championName: 'Darius', team: 'CHAOS', position: 'TOP', level: 5, kills: 0, deaths: 1, assists: 0, cs: 38 },
    { championName: 'LeeSin', team: 'CHAOS', position: 'JUNGLE', level: 5, kills: 1, deaths: 0, assists: 0, cs: 32 },
    { championName: 'Syndra', team: 'CHAOS', position: 'MIDDLE', level: 5, kills: 0, deaths: 0, assists: 0, cs: 42 },
    { championName: 'KaiSa', team: 'CHAOS', position: 'BOTTOM', level: 5, kills: 3, deaths: 0, assists: 0, cs: 45 },
    { championName: 'Nautilus', team: 'CHAOS', position: 'UTILITY', level: 4, kills: 0, deaths: 0, assists: 3, cs: 8 },
  ];

  it('TopがLv6先行＆CS差でally_prioになり、幼虫推奨アドバイスが出ること', () => {
    const report = calculateLanePriority(basePlayers, 'ORDER', 360);
    const top = report.lanes.find((l) => l.lane === 'TOP');
    assert.ok(top);
    assert.equal(top.prio, 'ally_prio');
    assert.ok(top.spike?.includes('Lv6先行'));
    assert.ok(top.advice.includes('幼虫'));
  });

  it('Botが劣勢（CS差負け・被キル）でenemy_prioになり、ガンク狙い目判定になること', () => {
    const report = calculateLanePriority(basePlayers, 'ORDER', 360);
    const bot = report.lanes.find((l) => l.lane === 'BOT');
    assert.ok(bot);
    assert.equal(bot.prio, 'enemy_prio');
    assert.ok(bot.advice.includes('ガンク狙い目'));
  });

  it('敵対面が死亡した時、即座に確定Prio（オブジェクトフリー）になること', () => {
    const deadEnemyPlayers = JSON.parse(JSON.stringify(basePlayers));
    deadEnemyPlayers[5].isDead = true; // Darius is dead

    const report = calculateLanePriority(deadEnemyPlayers, 'ORDER', 360);
    const top = report.lanes.find((l) => l.lane === 'TOP');
    assert.ok(top);
    assert.equal(top.prio, 'ally_prio');
    assert.ok(top.advice.includes('即フリー'));
  });
});
