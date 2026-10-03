// チャンピオンの特性・戦闘スタイル分類とビルドプリセット生成
import { translateItem } from './itemTranslator';

export type ChampionArchetype = 'ap_mage' | 'ap_assassin' | 'ad_assassin' | 'ad_fighter' | 'tank' | 'marksman' | 'enchanter';

export function detectChampionArchetype(
  champId: string,
  tags: string[] = [],
  info?: { attack?: number; defense?: number; magic?: number },
  buildRunesText: string = '',
  role?: string
): ChampionArchetype {
  const id = champId.toLowerCase();
  const text = (buildRunesText || '').toLowerCase();
  const normalizedRole = (role || '').toUpperCase();

  // ロールが明示指定されている場合の優先適正化
  if (normalizedRole === 'SUP') {
    const ENCHANTERS = ['lulu', 'nami', 'janna', 'soraka', 'sona', 'milio', 'yuumi', 'renataglasc', 'taric'];
    if (ENCHANTERS.includes(id) || (tags.includes('Support') && (info?.magic || 0) >= (info?.attack || 0))) {
      return 'enchanter';
    }
    const SUP_TANKS = ['leona', 'nautilus', 'alistar', 'braum', 'rell', 'thresh', 'blitzcrank', 'tahmkench', 'poppy', 'maokai'];
    if (SUP_TANKS.includes(id) || tags.includes('Tank')) {
      return 'tank';
    }
    if (['zyra', 'brand', 'lux', 'velkoz', 'xerath', 'morgana', 'swain'].includes(id)) {
      return 'ap_mage';
    }
    if (id === 'senna' || id === 'pyke') {
      return id === 'senna' ? 'marksman' : 'ad_assassin';
    }
  }

  if (normalizedRole === 'BOT' || normalizedRole === 'ADC') {
    if (!['karthus', 'swain', 'veigar', 'seraphine', 'ziggs'].includes(id)) {
      return 'marksman';
    }
  }

  // 1. AP明示チャンピオン
  const AP_CHAMPS = [
    'zyra', 'lillia', 'karthus', 'evelynn', 'elise', 'nidalee', 'taliyah', 'fiddlesticks',
    'brand', 'morgana', 'cassiopeia', 'orianna', 'syndra', 'veigar', 'viktor', 'xerath',
    'lux', 'vex', 'aurora', 'anivia', 'ahri', 'velkoz', 'zoe', 'hwei', 'swain', 'vladimir',
    'heimerdinger', 'teemo', 'rumble', 'kennen', 'ekko', 'diana', 'kassadin', 'leblanc', 'fizz'
  ];
  if (AP_CHAMPS.includes(id)) {
    if (['ekko', 'diana', 'kassadin', 'leblanc', 'fizz', 'evelynn'].includes(id)) return 'ap_assassin';
    return 'ap_mage';
  }

  // 2. 特殊・ハイブリッド判定
  if (id === 'shyvana') {
    if (text.includes('ショウジン') || text.includes('タイタン')) return 'ad_fighter';
    return 'ap_mage';
  }

  // 3. マークスマン (ADC / レンジドAD)
  if (tags.includes('Marksman') || ['graves', 'kindred', 'quinn', 'senna', 'akshan'].includes(id)) {
    return 'marksman';
  }

  // 4. アサシン
  if (tags.includes('Assassin') || ['khazix', 'rengar', 'talon', 'zed', 'kayn', 'qiyana', 'naafiri', 'pyke'].includes(id)) {
    return 'ad_assassin';
  }

  // 5. タンク
  const PURE_TANKS = [
    'amumu', 'rammus', 'sejuani', 'zac', 'maokai', 'malphite', 'ornn', 'sion',
    'nunu', 'rell', 'leona', 'nautilus', 'alistar', 'braum', 'tahmkench', 'poppy',
    'ksante', 'chogath', 'drmundo', 'shen'
  ];
  if (PURE_TANKS.includes(id) || (tags.includes('Tank') && !tags.includes('Fighter'))) {
    return 'tank';
  }

  // 6. サポート / エンチャンター
  if (tags.includes('Support') && (info?.magic || 0) > (info?.attack || 0)) {
    const ENCHANTERS = ['lulu', 'nami', 'janna', 'soraka', 'sona', 'milio', 'yuumi', 'renataglasc'];
    if (ENCHANTERS.includes(id)) return 'enchanter';
  }

  // 7. メイジタグ
  if (tags.includes('Mage')) {
    return 'ap_mage';
  }

  // 8. デフォルトは ADファイター (Fighter)
  return 'ad_fighter';
}

export interface PresetBuildResult {
  firstCore: string;
  firstCoreDesc: string;
  coreSpike: string;
  coreSpikeDesc: string;
  runes: string;
  runesDesc: string;
}

export function getPresetBuildDetails(
  archetype: ChampionArchetype,
  preset: 'standard' | 'tank' | 'burst',
  trendItems: string[] = [],
  trendKeystone: string = '',
  customDict?: Record<string, string>,
  champId?: string
): PresetBuildResult {
  const items = (trendItems || []).map((it) => translateItem(it, customDict));
  const id = (champId || '').toLowerCase();

  switch (archetype) {
    case 'ap_mage': {
      const first = items[0] || 'ライアンドリーの苦悶';
      const second = items[1] || 'シャドウフレイム';
      const third = items[2] || 'ゾーニャの砂時計';
      const keystone = trendKeystone || '電撃 / 秘術の彗星';

      if (preset === 'standard') {
        return {
          firstCore: `${first}`,
          firstCoreDesc: '持続バーンと最大ヘルス削りで中立・レーン主導権掌握',
          coreSpike: `${second} ➔ ${third}`,
          coreSpikeDesc: '魔法貫通と瞬間火力でパワースパイク早期到達',
          runes: keystone,
          runesDesc: '電撃（瞬間処刑）または 彗星（ポーク・継続削り）',
        };
      }
      if (preset === 'tank') {
        return {
          firstCore: 'ライアンドリーの苦悶 (持続割合DMG)',
          firstCoreDesc: '最大HP割合バーンで前衛タンクの高耐久を溶かす',
          coreSpike: 'クリプトブルーム / ヴォイド ➔ リフトメーカー',
          coreSpikeDesc: '割合MR貫通と真のダメージ蓄積でタンクを溶解',
          runes: '秘術の彗星 / 征服者 + 切り崩し',
          runesDesc: '切り崩し（Cut Down）で高HP対象へのダメージ底上げ',
        };
      }
      return {
        firstCore: `${first}`,
        firstCoreDesc: '初手火力を確保しつつ防御コアへ繋ぐ',
        coreSpike: 'ゾーニャの砂時計 ➔ バンシーヴェール',
        coreSpikeDesc: '停滞（無敵）とスペルシールドで即死ワンコンを完全無力化',
        runes: `${keystone} + ボーンアーマー`,
        runesDesc: '不屈/ボーンアーマーでアサシンの飛び込みを耐える',
      };
    }

    case 'ap_assassin': {
      const first = items[0] || 'リッチベイン / ロケットベルト';
      const second = items[1] || 'シャドウフレイム';
      const third = items[2] || 'ゾーニャの砂時計';
      const keystone = trendKeystone || '電撃 (Electrocute)';

      if (preset === 'standard') {
        return {
          firstCore: `${first}`,
          firstCoreDesc: '接近性能と追加APバーストで即座にキルライン到達',
          coreSpike: `${second} ➔ ${third}`,
          coreSpikeDesc: '集団戦でキャリーを瞬殺しつつ無敵で安全離脱',
          runes: `${keystone}`,
          runesDesc: 'サドンインパクト / 目玉コレクター / 執拗な賞金首狩り',
        };
      }
      if (preset === 'tank') {
        return {
          firstCore: 'ライアンドリーの苦悶 / ナッシャートゥース',
          firstCoreDesc: '割合ダメージと継続殴りで高耐久前衛に対抗',
          coreSpike: 'ヴォイドスタッフ ➔ リフトメーカー',
          coreSpikeDesc: '割合貫通で硬い前衛を削り切る',
          runes: '征服者 / 電撃 + 切り崩し',
          runesDesc: '長期戦でのダメージ持続とスタック蓄積',
        };
      }
      return {
        firstCore: `${first}`,
        firstCoreDesc: '初手火力を維持しながら生存率を引き上げる',
        coreSpike: 'ゾーニャの砂時計 ➔ バンシーヴェール',
        coreSpikeDesc: 'ターゲット不可・無敵で敵の集中砲火を回避',
        runes: `${keystone} + ボーンアーマー`,
        runesDesc: '反撃の隙を作らせずにカウンターキル',
      };
    }

    case 'ad_assassin': {
      const first = items[0] || '妖夢の霊剣 / ヒュドリスの貪食者';
      const second = items[1] || 'オポチュニティー';
      const third = items[2] || 'セリルの怨恨';
      const keystone = trendKeystone || '電撃 / 征服者';

      if (preset === 'standard') {
        return {
          firstCore: `${first}`,
          firstCoreDesc: '高い脅威とMS加速で孤立ターゲットを最速アサシン',
          coreSpike: `${second} ➔ ${third}`,
          coreSpikeDesc: '脅威値とスロー付き貫通で集団戦のキル回収',
          runes: `${keystone}`,
          runesDesc: 'サドンインパクト / 目玉コレクター / 至極の賞金首狩り',
        };
      }
      if (preset === 'tank') {
        return {
          firstCore: '赤月の刃 / 黒斧 (Black Cleaver)',
          firstCoreDesc: '脅威ではなく割合ダメージとAR低下で前衛を崩す',
          coreSpike: 'セリルの怨恨 ➔ デスダンス',
          coreSpikeDesc: '多段ヒットによるAR破砕で殴り合いを制す',
          runes: '征服者 (Conqueror) + 切り崩し',
          runesDesc: 'スタック維持で硬い相手との殴り合いを優位に展開',
        };
      }
      return {
        firstCore: 'エッジオブナイト (スペルシールド)',
        firstCoreDesc: '敵の初動CC・バーストスキルを無効化して生存',
        coreSpike: 'デスダンス ➔ マルモティウスの胃袋',
        coreSpikeDesc: '出血遅延と魔法シールドで即死ワンコンを回避',
        runes: `${keystone} + 不撓不屈`,
        runesDesc: '行動妨害耐性を高めて集中砲火からの脱出を確保',
      };
    }

    case 'tank': {
      const first = items[0] || 'サンファイアイージス / バミシンダー';
      const second = items[1] || '終わりなき絶望';
      const third = items[2] || 'ソーンメイル / ケストレル';
      const keystone = trendKeystone || 'アフターショック';

      if (preset === 'standard') {
        return {
          firstCore: `${first}`,
          firstCoreDesc: '周囲炎上による高速中立処理と最速集団戦エンゲージ',
          coreSpike: `${second} ➔ ${third}`,
          coreSpikeDesc: '持続回復と属性防御で最前線を維持',
          runes: `${keystone} (Aftershock)`,
          runesDesc: '生命の泉 / 心身調整 / 超成長',
        };
      }
      if (preset === 'tank') {
        return {
          firstCore: '悲愴の仮面 / サンファイアイージス',
          firstCoreDesc: '割合ダメージオーラで泥仕合の殴り合いを制する',
          coreSpike: 'アビサルマスク ➔ 終わりなき絶望',
          coreSpikeDesc: '周囲MR低下オーラで味方APと連携しタンクを破壊',
          runes: '不死者の握撃 / アフターショック',
          runesDesc: '長期戦での最大HP無限増加とサステイン',
        };
      }
      return {
        firstCore: 'アナセマチェイン / ソーンメイル',
        firstCoreDesc: '敵の最も育ったキャリーを指名し被ダメージを30%カット',
        coreSpike: '変幻自在のジャック＝ショー ➔ ガーゴイル',
        coreSpikeDesc: '戦闘継続でAR/MRが急増、バーストを完全に吸収',
        runes: 'アフターショック + 気迫 + ボーンアーマー',
        runesDesc: 'CCを受けた瞬間の防御力急上昇で即死を完全に阻止',
      };
    }

    case 'marksman': {
      const first = items[0] || 'クラーケンスレイヤー / コレクター';
      const second = items[1] || 'インフィニティエッジ';
      const third = items[2] || 'ドミニクリガード';
      const keystone = trendKeystone || 'プレスアタック / フリート';

      if (preset === 'standard') {
        return {
          firstCore: `${first}`,
          firstCoreDesc: 'DPS最大化とクリティカル・脅威による早期パワースパイク',
          coreSpike: `${second} ➔ ${third}`,
          coreSpikeDesc: 'クリティカル確定ヒットで後衛を一瞬で融解',
          runes: `${keystone}`,
          runesDesc: '凱旋 / 迅速 / 最期の慈悲',
        };
      }
      if (preset === 'tank') {
        const isOnhit = ['kogmaw', 'vayne', 'varus', 'kaisa'].includes(id);
        if (isOnhit) {
          return {
            firstCore: 'ルインドキング・ブレード (王剣)',
            firstCoreDesc: '現在HP割合ダメージ＋MS奪取で巨体タンクをカイト',
            coreSpike: 'グインソー・レイジブレード ➔ テルミヌス',
            coreSpikeDesc: '通常攻撃2回発動とAR/MR両貫通でどんな硬い前衛も溶かす',
            runes: 'リーサルテンポ / プレスアタック + 切り崩し',
            runesDesc: '切り崩し（Cut Down）と手数で最大HP差を突破',
          };
        }
        return {
          firstCore: 'クラーケンスレイヤー / ボルク (王剣)',
          firstCoreDesc: '現在HP割合物理ダメージで前衛を削り倒す',
          coreSpike: 'ドミニクリガード ➔ モータルリマインダー',
          coreSpikeDesc: '割合AR貫通＋重症付与で回復タンクを撃破',
          runes: 'プレスアタック + 切り崩し',
          runesDesc: '切り崩し（Cut Down）で最大HP差ボーナスを獲得',
        };
      }
      return {
        firstCore: 'イモータルシールドボウ',
        firstCoreDesc: 'ライフライン（低HP時シールド）でアサシンの急襲を耐える',
        coreSpike: 'マルモティウスの胃袋 ➔ デスダンス / 守護天使',
        coreSpikeDesc: '防御ハイブリッド構成で生存しつつDPSを維持',
        runes: 'フリートフットワーク + 過剰成長',
        runesDesc: '移動速度増加と回復で間合いを保ち即死を回避',
      };
    }

    case 'enchanter': {
      const first = items[0] || '月石の再生器';
      const second = items[1] || 'リデンプション';
      const third = items[2] || 'シュレリアの戦歌';
      const keystone = trendKeystone || '召喚: エアリー';

      if (preset === 'standard') {
        return {
          firstCore: `${first}`,
          firstCoreDesc: '連鎖回復・シールド増幅で味方キャリーの生存力を最大化',
          coreSpike: `${second} ➔ ${third}`,
          coreSpikeDesc: '広範囲回復と味方全員のMS加速で集団戦を支配',
          runes: `${keystone} (Summon Aery)`,
          runesDesc: 'マナフローバンド / 至高 / 強まる嵐',
        };
      }
      if (preset === 'tank') {
        return {
          firstCore: '帝国の指令 (Imperial Mandate)',
          firstCoreDesc: 'CC付与時に味方の追加魔法ダメージをトリガー',
          coreSpike: 'モレロノミコン ➔ シュレリアの戦歌',
          coreSpikeDesc: '重症とカイト支援で前衛タンクを寄せ付けない',
          runes: 'エアリー + 追風',
          runesDesc: '味方の機動力を高めてタンクをアウトレンジから完封',
        };
      }
      return {
        firstCore: 'ソラリのロケット (Locket)',
        firstCoreDesc: '敵の飛び込みに合わせて味方全体に即時シールドを展開',
        coreSpike: 'ミカエルの祝福 ➔ 騎士の誓い',
        coreSpikeDesc: '敵のハードCCを即時解除し、受けるダメージを肩代わり',
        runes: 'ガーディアン (Guardian) + ボーンアーマー',
        runesDesc: '被弾時の自動シールドでアサシンのワンコンを無効化',
      };
    }

    case 'ad_fighter':
    default: {
      const first = items[0] || '赤月の刃 / サンダードスカイ';
      const second = items[1] || 'ショウジンの矛';
      const third = items[2] || 'デスダンス / ステラック';
      const keystone = trendKeystone || '征服者 (Conqueror)';

      if (preset === 'standard') {
        return {
          firstCore: `${first}`,
          firstCoreDesc: 'ダメージ最大化とタイマン主導権・パワースパイク早期到達',
          coreSpike: `${second} ➔ ${third}`,
          coreSpikeDesc: 'スキル回転率と集団戦での継戦サステインを両立',
          runes: `${keystone}`,
          runesDesc: '凱旋 / 迅速 / 背水の陣',
        };
      }
      if (preset === 'tank') {
        const isOnhitFighter = ['masteryi', 'belveth', 'warwick', 'briar'].includes(id);
        if (isOnhitFighter) {
          return {
            firstCore: 'ルインドキング・ブレード (王剣)',
            firstCoreDesc: '現在HP割合ダメージ＋通常攻撃毎の確定・魔法ダメージでタンクを圧倒',
            coreSpike: 'グインソー・レイジブレード ➔ タイタン・ハイドラ / テルミヌス',
            coreSpikeDesc: 'オンヒット効果2回発動と割合貫通で秒殺',
            runes: '征服者 / リーサルテンポ + 切り崩し',
            runesDesc: '切り崩し（Cut Down）とスタック最大化で超耐久前衛を溶かす',
          };
        }
        return {
          firstCore: '黒斧 (Black Cleaver)',
          firstCoreDesc: '多段スキルヒットによるAR破砕＆MS加速で前衛を圧倒',
          coreSpike: 'サンダードスカイ ➔ セリルの怨恨 / ボルク',
          coreSpikeDesc: '割合貫通とクリティカル回復で高耐久タンクを粉砕',
          runes: '征服者 + 切り崩し / 背水の陣',
          runesDesc: '長期戦での攻撃力ブーストと最大HP差ダメージ獲得',
        };
      }
      return {
        firstCore: 'ステラックの篭手 / サンダードスカイ',
        firstCoreDesc: '大ダメージ被弾時のライフラインシールドで即死回避',
        coreSpike: 'デスダンス ➔ マルモティウスの胃袋 / 精霊の容貌',
        coreSpikeDesc: '被ダメージ出血遅延とキル関与時回復で反撃',
        runes: '征服者 / 不死者の握撃 + 不撓不屈',
        runesDesc: 'テナシティ（行動妨害耐性）を高めてCCチェインから脱出',
      };
    }
  }
}
