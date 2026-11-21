import catalogData from '../data/reference_items_catalog.json';

export interface ReferenceItem {
  code: string;
  title: string;
  author: string;
  url: string;
  category: string;
  summary: string;
  content: string;
}

const catalog: ReferenceItem[] = catalogData as ReferenceItem[];

const KEYWORDS_MAP: { test: RegExp; terms: string[] }[] = [
  { test: /(ダイブ|タワーダイブ)/i, terms: ['ダイブ', 'タワー'] },
  { test: /(バロン|ナッシャー)/i, terms: ['バロン'] },
  { test: /(ドラゴン|ドラ|ソウル)/i, terms: ['ドラゴン', 'ドラ', 'ソウル'] },
  { test: /(抑制器|インヒビ|インヒビター)/i, terms: ['抑制器', 'インヒビター'] },
  { test: /(リコール|ゴールド|買い物|アイテム|所持金|シャットダウン|1000|1000g)/i, terms: ['リコール', 'ゴールド', 'アイテム', '1000', 'シャットダウン', '雪だるま', '握っ'] },
  { test: /(フリーズ|プッシュ|ウェーブ|ミニオン|スロープッシュ)/i, terms: ['ウェーブ', 'フリーズ', 'ミニオン', 'プッシュ'] },
  { test: /(ローム|ロテ|寄|寄り)/i, terms: ['ローム', 'ロテート', '寄'] },
  { test: /(インベード|カウンター|荒らし)/i, terms: ['インベード', 'カウンタージャングル'] },
  { test: /(クリア|周回|ルート|ラプター|スマイト|初動|序盤|5分)/i, terms: ['クリア', '周回', 'ルート', 'ラプター', 'スマイト', '5分', '最初'] },
  { test: /(視界|ワード|デワード|レンズ|ピンク)/i, terms: ['視界', 'ワード', 'レンズ'] },
  { test: /(集団戦|ポジショニング|エンゲージ|ピール)/i, terms: ['集団戦', 'ポジショニング', 'エンゲージ'] },
  { test: /(ザイラ|Zyra)/i, terms: ['ザイラ'] },
  { test: /(モルガナ|Morgana)/i, terms: ['モルガナ'] },
  { test: /(リリア|Lillia)/i, terms: ['リリア'] },
  { test: /(ジャーヴァン|J4|Jarvan)/i, terms: ['J4', 'ジャーヴァン'] },
  { test: /(ダリウス|Darius)/i, terms: ['ダリウス'] },
  { test: /(エイトロックス|Aatrox)/i, terms: ['エイトロックス'] },
  { test: /(リニア|直線)/i, terms: ['リニア', '直線'] },
  { test: /(ペット|召喚)/i, terms: ['ペット'] },
  { test: /(ターン)/i, terms: ['ターン'] },
  { test: /(チーター)/i, terms: ['チーター'] },
  { test: /(スカトル|蟹|カニ)/i, terms: ['スカトル', 'カニ'] },
  { test: /(キル後|キル)/i, terms: ['キル'] },
];

/**
 * 質問文、レーン、使用チャンピオン等に基づいて、
 * データベース正本（全149件のreference_items）から関連度の高い戦術アイテムを検索・抽出する
 */
export function searchReferenceItems(
  query: string,
  lane?: string,
  myChampion?: string,
  enemyChampion?: string,
  limit: number = 4
): ReferenceItem[] {
  const fullText = `${query || ''} ${lane || ''} ${myChampion || ''} ${enemyChampion || ''}`.toLowerCase();

  // 1. 抽出した検索語
  const searchTerms = new Set<string>();
  KEYWORDS_MAP.forEach((k) => {
    if (k.test.test(fullText)) {
      k.terms.forEach((t) => searchTerms.add(t.toLowerCase()));
    }
  });

  // レーンに応じた基本語
  const normalizedLane = (lane || '').toUpperCase();
  if (normalizedLane === 'JG' || normalizedLane === 'JUNGLE') {
    searchTerms.add('jg');
    searchTerms.add('ジャングル');
  } else if (normalizedLane === 'MID') {
    searchTerms.add('mid');
    searchTerms.add('ミッド');
  } else if (normalizedLane === 'TOP') {
    searchTerms.add('top');
    searchTerms.add('トップ');
  } else if (normalizedLane === 'BOT' || normalizedLane === 'ADC') {
    searchTerms.add('bot');
    searchTerms.add('ボット');
  } else if (normalizedLane === 'SUP' || normalizedLane === 'SUPPORT') {
    searchTerms.add('sup');
    searchTerms.add('サポート');
  }

  // 質問文の日本語単語（2文字以上）や英数字（3文字以上）も検索語に追加
  const words = (query || '').match(/([a-zA-Z0-9]{3,}|[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{2,})/g) || [];
  words.slice(0, 8).forEach((w) => searchTerms.add(w.toLowerCase()));

  // 2. スコアリング
  const scored = catalog.map((item) => {
    let score = 0;
    const targetTitle = item.title.toLowerCase();
    const targetSummary = item.summary.toLowerCase();
    const targetContent = item.content.toLowerCase();

    // 検索語との一致度スコア
    searchTerms.forEach((term) => {
      let matchedInItem = false;
      if (targetTitle.includes(term)) {
        score += 8;
        matchedInItem = true;
      }
      if (targetSummary.includes(term)) {
        score += 4;
        matchedInItem = true;
      }
      if (targetContent.includes(term)) {
        score += 2;
        matchedInItem = true;
      }
      // タイトルと本文両方にマッチした場合はシナジーボーナス
      if (matchedInItem && targetTitle.includes(term) && targetContent.includes(term)) {
        score += 3;
      }
    });

    // 質問文に直接コード番号（例: D39 や F1）が含まれる場合は最優先ヒット
    const upperQuery = (query || '').toUpperCase();
    if (upperQuery.includes(item.code)) {
      score += 100;
    }

    return { item, score };
  });

  // スコア順にソートし、スコア > 0 の上位を返す
  const results = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);

  return results;
}

export interface TacticalInsight {
  code: string;
  badge: string;
  title: string;
  hint: string;
  type: 'gold' | 'timing' | 'matchup' | 'macro';
}

/**
 * 試合中のリアルタイム実測データ（秒数、所持ゴールド、レーン、対面チャンプ等）に基づいて、
 * 今この瞬間に最も意識すべき戦術アイテム（1件）を0msでリアルタイム抽出する（HUD RAGエンジン）
 */
export function getLiveTacticalInsight(params: {
  gameTimeSec?: number;
  currentGold?: number;
  lane?: string;
  myChampion?: string;
  enemyChampion?: string;
}): TacticalInsight | null {
  const sec = params.gameTimeSec || 0;
  const gold = params.currentGold || 0;

  // 1. 所持金が 1000G を超えている（シャットダウン・即リコール原則）
  if (gold >= 1000) {
    return {
      code: 'D40',
      badge: '💰 1000G突破',
      title: '即リコール・アイテム化原則',
      hint: `${gold.toLocaleString()}G保持中。キャノン押し切り後に帰還してパワースパイク化を！`,
      type: 'gold',
    };
  }

  // 2. 03:00〜03:45（序盤5分支配論・スカトル同期）
  if (sec >= 180 && sec <= 225) {
    return {
      code: 'D5',
      badge: '⏱️ 03:15スカトル',
      title: '序盤5分支配論 ＆ カニ同期',
      hint: 'レーンPrioが無い側のカニは無理に争わず逆サイドへ！敵JGの位置を確認。',
      type: 'timing',
    };
  }

  // 3. 07:30〜08:30（ヴォイドグラブ・ヘラルド前）
  if (sec >= 450 && sec <= 510) {
    return {
      code: 'D14',
      badge: '👾 08:00グラブ',
      title: 'ヴォイドグラブ戦術 ＆ トップPrio',
      hint: 'TOP/MIDを押し込み、川の視界を先手で確保してグラブ争奪戦へ合流！',
      type: 'timing',
    };
  }

  // 4. 13:20〜14:00（タワープレート消滅カウントダウン）
  if (sec >= 800 && sec <= 840) {
    return {
      code: 'D45',
      badge: '🛡️ 14:00プレート消滅',
      title: 'タワープレート消滅カウントダウン',
      hint: '残りプレートを削るか、欲張らず安全に帰還して中盤オブジェクトに備えるか判断！',
      type: 'timing',
    };
  }

  // 5. 19:30〜20:30（バロン出現・視界セットアップ原則）
  if (sec >= 1170 && sec <= 1230) {
    return {
      code: 'D37',
      badge: '🐉 20:00バロン出現',
      title: 'バロン前視界セットアップ ＆ 抑制器管理',
      hint: '出現30秒前に視界をセット。不用意な単独プッシュでキャッチされないこと！',
      type: 'macro',
    };
  }

  // 6. 対面やレーンに基づく定常マッチアップ知見
  if (params.myChampion || params.enemyChampion) {
    const matched = searchReferenceItems(
      `${params.myChampion || ''} ${params.enemyChampion || ''}`,
      params.lane,
      params.myChampion,
      params.enemyChampion,
      1
    );
    if (matched[0]) {
      return {
        code: matched[0].code,
        badge: `⚔️ vs ${params.enemyChampion || params.lane || '対面'}`,
        title: matched[0].title,
        hint: matched[0].summary.slice(0, 60) + (matched[0].summary.length > 60 ? '…' : ''),
        type: 'matchup',
      };
    }
  }

  return null;
}
