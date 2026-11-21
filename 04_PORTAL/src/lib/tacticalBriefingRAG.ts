/**
 * バランサー 試合前戦術ブリーフィング RAG エンジン
 * 
 * チーム分け結果（青・赤の各レーンMMR、格差、ロール）を瞬時に分析し、
 * 戦術バイブル（D原則：スカトル、グラブ、1000Gリコール等）に基づいた
 * 「試合前30秒で共有すべき勝ち筋と激突区間」を生成する。
 */

export interface TacticalBriefing {
  overview: {
    statusText: string;
    dominantSide: 'BLUE' | 'RED' | 'EVEN';
    mmrDiff: number;
    favoredReason: string;
  };
  keyMatchup: {
    role: string;
    label: string;
    bluePlayer: string;
    redPlayer: string;
    mmrDiff: number;
    tacticalNote: string;
    bibleCode: string;
  };
  blueWinCondition: {
    phase: string;
    title: string;
    strategy: string;
    bibleCode: string;
  };
  redWinCondition: {
    phase: string;
    title: string;
    strategy: string;
    bibleCode: string;
  };
}

export function generatePreMatchBriefing(result: {
  teamBlue?: any[];
  teamRed?: any[];
  teamBlueMMR?: number;
  teamRedMMR?: number;
  mmrDiff?: number;
}): TacticalBriefing | null {
  if (!result || !result.teamBlue || !result.teamRed) return null;

  const blue = result.teamBlue;
  const red = result.teamRed;

  const blueAvg = result.teamBlueMMR || Math.round(blue.reduce((acc, p) => acc + (p.mmr || 1200), 0) / (blue.length || 1));
  const redAvg = result.teamRedMMR || Math.round(red.reduce((acc, p) => acc + (p.mmr || 1200), 0) / (red.length || 1));
  const diff = result.mmrDiff !== undefined ? result.mmrDiff : Math.abs(blueAvg - redAvg);

  const dominantSide: 'BLUE' | 'RED' | 'EVEN' =
    diff <= 30 ? 'EVEN' : blueAvg > redAvg ? 'BLUE' : 'RED';

  const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  const getPlayerRole = (p: any) => p?.currentRole || p?.role || p?.assignedRole || null;

  // レーンごとの対面格差を計算
  let maxDiffRole = 'MID';
  let maxDiff = -1;
  let maxDiffBlueP: any = null;
  let maxDiffRedP: any = null;

  roles.forEach((r, idx) => {
    const bp = blue.find((p: any) => getPlayerRole(p) === r) || blue[idx];
    const rp = red.find((p: any) => getPlayerRole(p) === r) || red[idx];
    if (bp && rp) {
      const d = Math.abs((bp.mmr || 1200) - (rp.mmr || 1200));
      if (d > maxDiff) {
        maxDiff = d;
        maxDiffRole = r;
        maxDiffBlueP = bp;
        maxDiffRedP = rp;
      }
    }
  });

  // キーマッチアップの戦術注記
  let matchupNote = '両者互角の激戦区。ジャングラーの介入タイミングがレーンの命運を握る。';
  let matchupBible = 'D5';
  if (maxDiffRole === 'TOP') {
    matchupNote = `トップのMMR差(${maxDiff}点)が最大の焦点。有利側はフリーズとスノーボール、不利側はガンク受けの徹底が必要。`;
    matchupBible = 'D14';
  } else if (maxDiffRole === 'JG') {
    matchupNote = `ジャングル対決。3:15スカトルおよび8:00グラブでの視界取りとパス取りの駆け引きが勝敗直結。`;
    matchupBible = 'D5';
  } else if (maxDiffRole === 'MID') {
    matchupNote = `ミッド主導権争い。ローム速度とサイドレーン介入の早さが両サイドのタワー耐久に直結。`;
    matchupBible = 'D45';
  } else if (maxDiffRole === 'ADC' || maxDiffRole === 'SUP') {
    matchupNote = `ボットレーンの2v2。ドラゴン前のリコール管理とLv2/Lv6先行時の仕掛けがゲームを動かす。`;
    matchupBible = 'D40';
  }

  // 青・赤の勝ち筋ロジック
  const blueJgMidAdv = ((blue.find(p => getPlayerRole(p) === 'JG')?.mmr || 1200) + (blue.find(p => getPlayerRole(p) === 'MID')?.mmr || 1200)) >=
    ((red.find(p => getPlayerRole(p) === 'JG')?.mmr || 1200) + (red.find(p => getPlayerRole(p) === 'MID')?.mmr || 1200));

  const blueWinCond = blueJgMidAdv
    ? {
        phase: '序盤〜中盤 (0-14分)',
        title: 'ミッド・ジャングル先行スノーボール',
        strategy: '3:15スカトルと08:00ヴォイドグラブを最優先確保し、ミッドのプッシュ主導権から14分前のタワープレート破壊でゴールド差を築く。',
        bibleCode: 'D5 / D14',
      }
    : {
        phase: '中盤〜終盤 (15分以降)',
        title: 'ドラゴン主導権と集団戦エンゲージ',
        strategy: '無理な個人チェイスを避け、D40の1000G即リコールでアイテム差を作ってからドラゴン前の視界制圧で集団戦を制す。',
        bibleCode: 'D40 / D37',
      };

  const redWinCond = !blueJgMidAdv
    ? {
        phase: '序盤〜中盤 (0-14分)',
        title: '積極的オブジェクトコントロール',
        strategy: 'ジャングルの周回アドバンテージを活かし、対面カウンタージャングルとグラブ奪取で青のパワースパイクを封殺する。',
        bibleCode: 'D5 / D14',
      }
    : {
        phase: '中盤〜終盤 (15分以降)',
        title: '耐えてパワースパイク一閃・逆転集団戦',
        strategy: '序盤の局所戦は無理に乗らず、タワー下でCSを拾い1000Gリコールを徹底。2コア完成後のバロン・ドラゴン決戦に賭ける。',
        bibleCode: 'D40 / D45',
      };

  const overviewText =
    dominantSide === 'EVEN'
      ? '両チームの戦力差は極めて僅差（黄金比マッチ）。マクロの判断とオブジェクト前のコール精度が勝敗を分けます。'
      : dominantSide === 'BLUE'
      ? `BlueチームがMMR優勢(+${diff})。個々のレーン戦主導権からオブジェクトへ繋ぐ展開が期待されます。`
      : `RedチームがMMR優勢(+${diff})。手堅い試合運びでBlueの攻めをいなし、スケール勝ちを狙える布陣です。`;

  return {
    overview: {
      statusText: dominantSide === 'EVEN' ? '⚖️ 互角マッチ' : dominantSide === 'BLUE' ? '🟦 Blue有利' : '🟥 Red有利',
      dominantSide,
      mmrDiff: diff,
      favoredReason: overviewText,
    },
    keyMatchup: {
      role: maxDiffRole,
      label: `${maxDiffRole}レーン激突区間`,
      bluePlayer: maxDiffBlueP?.name || 'Blue側',
      redPlayer: maxDiffRedP?.name || 'Red側',
      mmrDiff: maxDiff,
      tacticalNote: matchupNote,
      bibleCode: matchupBible,
    },
    blueWinCondition: blueWinCond,
    redWinCondition: redWinCond,
  };
}
