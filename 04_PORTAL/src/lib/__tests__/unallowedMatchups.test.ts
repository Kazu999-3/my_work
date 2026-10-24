import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectUnallowedHigherMatchups, applyManualSwap } from '../balancer/teams';

test('detectUnallowedHigherMatchups: MMR差200以上で下位側がallowHigher=falseの場合、警告を検出する', () => {
  const teamBlue = [
    { name: 'PlayerA', currentRole: 'ADC', mmr: 1199, allowHigher: false }
  ];
  const teamRed = [
    { name: 'PlayerB', currentRole: 'ADC', mmr: 1645, allowHigher: true }
  ];

  const matchups = detectUnallowedHigherMatchups(teamBlue, teamRed);
  assert.equal(matchups.length, 1);
  assert.equal(matchups[0].role, 'ADC');
  assert.equal(matchups[0].weakerName, 'PlayerA');
  assert.equal(matchups[0].strongerName, 'PlayerB');
  assert.equal(matchups[0].diff, 446);
});

test('detectUnallowedHigherMatchups: 下位側がallowHigher=true（挑戦）の場合、警告は出ない', () => {
  const teamBlue = [
    { name: 'PlayerA', currentRole: 'ADC', mmr: 1199, allowHigher: true }
  ];
  const teamRed = [
    { name: 'PlayerB', currentRole: 'ADC', mmr: 1645, allowHigher: true }
  ];

  const matchups = detectUnallowedHigherMatchups(teamBlue, teamRed);
  assert.equal(matchups.length, 0);
});

test('detectUnallowedHigherMatchups: MMR差が200未満の場合、警告は出ない', () => {
  const teamBlue = [
    { name: 'PlayerA', currentRole: 'ADC', mmr: 1400, allowHigher: false }
  ];
  const teamRed = [
    { name: 'PlayerB', currentRole: 'ADC', mmr: 1550, allowHigher: false }
  ];

  const matchups = detectUnallowedHigherMatchups(teamBlue, teamRed);
  assert.equal(matchups.length, 0);
});

test('applyManualSwap: メンバー入れ替え後にunallowedHigherMatchupsがリアルタイムに再計算される', () => {
  const balanceResult = {
    teamBlue: [
      { name: 'Atu', currentRole: 'ADC', mmr: 1199, allowHigher: false },
      { name: 'TopBlue', currentRole: 'TOP', mmr: 1600, allowHigher: true },
    ],
    teamRed: [
      { name: 'Konpe', currentRole: 'ADC', mmr: 1645, allowHigher: true },
      { name: 'TopRed', currentRole: 'TOP', mmr: 1200, allowHigher: false },
    ],
    spectators: [],
    unallowedHigherMatchups: [
      { role: 'ADC', weakerName: 'Atu', weakerMmr: 1199, strongerName: 'Konpe', strongerMmr: 1645, diff: 446 }
    ]
  };

  const players = [
    { name: 'Atu', mmr: 1199, allow_higher: false },
    { name: 'Konpe', mmr: 1645, allow_higher: true },
    { name: 'TopBlue', mmr: 1600, allow_higher: true },
    { name: 'TopRed', mmr: 1200, allow_higher: false },
  ];

  // Atu と TopBlue のレーンをスワップして、AtuをTOP(1199 vs TopRed 1200: 差1)にする
  const swapped = applyManualSwap(balanceResult, players, 'teamBlue', 'TOP', 'Atu');
  assert.ok(swapped);

  // TOPの対面は Atu (1199) vs TopRed (1200) で差1のため警告なし
  // ADCの対面は TopBlue (1600) vs Konpe (1645) で差45のため警告なし
  // 結果として unallowedHigherMatchups は空配列になるべき！
  assert.equal(swapped.unallowedHigherMatchups.length, 0);
});
