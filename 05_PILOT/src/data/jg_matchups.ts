export interface MatchupAdvice {
  myChampId: string;
  myChampName: string;
  rating: 'favored' | 'even' | 'unfavored'; // favored: 有利(+1), even: 五分(0), unfavored: 不利(-1)
  headline: string;
  keyRule: string;
  powerSpikeAdvantage: 'early' | 'mid' | 'late' | 'even';
}

export interface EnemyJgProfile {
  id: string;
  name: string;
  archetype: string;
  dangerLevel: 'S' | 'A' | 'B' | 'C'; // 序盤の危険度
  invadeRisk: string;
  clearStyle: string;
  coreWeakness: string; // 共通の対面対策（相手を腐らせる方法）
  adviceList: MatchupAdvice[];
}

export const JG_MATCHUP_PROFILES: Record<string, EnemyJgProfile> = {
  LeeSin: {
    id: 'LeeSin',
    name: 'リー・シン',
    archetype: 'アサシン',
    dangerLevel: 'S',
    invadeRisk: '極高 (Lv2/3インベード)',
    clearStyle: '3キャンプ最速ガンク (2:15) または 2:45スカトル前着・2:55争奪',
    coreWeakness: '序盤にキルを取れないと後半急速に失速する。Lv3リバー衝突を避け、逆サイドでリソース差をつければ中盤以降無力化できる。',
    adviceList: [
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'favored',
        headline: 'ガンク先へのカウンターEと集団戦拘束で完封',
        keyRule: '序盤のタイマンは絶対拒否。Leeのガンク先へEで飛んで救助し、後半の集団戦スケールで勝つ。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Vi',
        myChampName: 'ヴァイ',
        rating: 'favored',
        headline: 'QのノックバックでLeeのQ2を遮断し、Rで確定キャッチ',
        keyRule: 'LeeがQ2で突っ込んできた瞬間に自分のQをチャージして迎撃する。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Viego',
        myChampName: 'ヴィエゴ',
        rating: 'even',
        headline: 'Lv3タイマンは回避し、フルクリア先行からの集団戦リセット狙い',
        keyRule: 'スカトルでの1v1はLee有利。逆回りフルクリアでゴールド先行し、Lv6以降の2v2で勝負する。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'even',
        headline: 'W（スペルシールド）でLeeのQ2またはRを無効化',
        keyRule: 'LeeのQ2突進タイミングでWを合わせればダメージを無効化しつつASバフで殴り勝てる。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Elise',
        myChampName: 'エリス',
        rating: 'even',
        headline: '先手スタンとE（蜘蛛の糸）でのLeeQ2スカシ勝負',
        keyRule: '超序盤のガンクスピード勝負。蜘蛛EでLeeのQ2やタワー下ダメージを完全に透かす。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Karthus',
        myChampName: 'カーサス',
        rating: 'unfavored',
        headline: '序盤インベード即死の危険大。逆サイド徹底回避が必須',
        keyRule: 'Leeが侵入してくる側に絶対に歩かない。視界を置いて逆サイドフルクリアを徹底する。',
        powerSpikeAdvantage: 'late'
      }
    ]
  },
  Viego: {
    id: 'Viego',
    name: 'ヴィエゴ',
    archetype: 'スカーミッシャー',
    dangerLevel: 'B',
    invadeRisk: '中 (スカトル衝突)',
    clearStyle: '最速2:45〜2:50フルクリア ➔ 2:55スカトル先着',
    coreWeakness: 'ハードCCに極めて脆く、集団戦で最初の1キル（リセット）を取らせなければ何もできずに溶ける。',
    adviceList: [
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'favored',
        headline: '序盤の圧倒的タイマン火力とインベードで叩き潰す',
        keyRule: 'Viegoがフルクリアしている間にLv3インベードを仕掛けるか、スカトル前で先制攻撃。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Vi',
        myChampName: 'ヴァイ',
        rating: 'favored',
        headline: 'Rの確定ロックオンでViegoにリセットを取らせず即死させる',
        keyRule: '集団戦でViegoが前線に入った瞬間にRを叩き込み、味方フォーカスで蒸発させる。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'favored',
        headline: 'WでViegoのWスタンを無効化し、Eの恐怖で殴り勝つ',
        keyRule: '1v1ではViegoのWをシールドで防げば絶対に負けない。暗黒状態からの奇襲が刺さる。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'even',
        headline: 'CCチェインで固めるが、Viegoが育っていると溶かされるリスク',
        keyRule: 'タイマンは避け、味方キャリーと共闘してCCで拘束し続ける。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Elise',
        myChampName: 'エリス',
        rating: 'favored',
        headline: '序盤ダイブとEスタンでViegoが育つ前にゲームを終わらせる',
        keyRule: 'Viegoが1コア完成する15分前までにサイドレーンを破壊し尽くす。',
        powerSpikeAdvantage: 'early'
      }
    ]
  },
  Nocturne: {
    id: 'Nocturne',
    name: 'ノクターン',
    archetype: 'アサシン',
    dangerLevel: 'B',
    invadeRisk: '低 (自陣フルクリア)',
    clearStyle: '最速2:45フルクリア ➔ Lv6までファーム最優先',
    coreWeakness: 'Lv6前のガンク圧力がほぼゼロ。Lv6ウルトのCD中は集団戦への介入が弱い。',
    adviceList: [
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'favored',
        headline: 'Lv6になる前にレーンを破壊し、主導権を完全掌握',
        keyRule: 'NocturneがLv6を目指して黙々と狩っている間に、Lv3ガンクとインベードで差を広げる。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Elise',
        myChampName: 'エリス',
        rating: 'favored',
        headline: '序盤ダイブでゲームを終わらせ、Lv6のプレッシャーを無効化',
        keyRule: 'NocturneのWシールドを小蜘蛛かQで剥がしてからEスタンを入れる。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'even',
        headline: '暗黒Rの飛び込み先へEとRでカウンターエンゲージ',
        keyRule: 'Nocturneが味方キャリーに飛んできた着地点へカウンターCCを重ねて守り切る。',
        powerSpikeAdvantage: 'late'
      },
      {
        myChampId: 'Viego',
        myChampName: 'ヴィエゴ',
        rating: 'unfavored',
        headline: '1v1タイマンはNocturneのE恐怖とASバフに押し切られやすい',
        keyRule: '単独でのリバー遭遇戦は避ける。集団戦で味方の援護がある状況でのみ戦う。',
        powerSpikeAdvantage: 'late'
      }
    ]
  },
  Zac: {
    id: 'Zac',
    name: 'ザック',
    archetype: 'タンク',
    dangerLevel: 'C',
    invadeRisk: '極低 (序盤虚弱)',
    clearStyle: 'フルクリア または Lv4以降の壁越えガンク',
    coreWeakness: '序盤（Lv1〜4）のタイマン火力が極めて低く、インベードされるとキャンプを奪われやすい。',
    adviceList: [
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'favored',
        headline: '序盤インベードでZacのジャングルを荒らし尽くす',
        keyRule: 'Zacの青バフ・赤バフに侵入し、パッシブの細胞分裂を序盤に吐かせて完封する。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Viego',
        myChampName: 'ヴィエゴ',
        rating: 'favored',
        headline: '王剣の割合ダメージとDPSでZacを溶かし、細胞を安全に処理',
        keyRule: '破滅の王剣完成後はZacとの殴り合いで負けない。集団戦で前線から削る。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Elise',
        myChampName: 'エリス',
        rating: 'favored',
        headline: '序盤のカウンタージャングルとダイブでZacが育つ暇を与えない',
        keyRule: 'Zacのキャンプを奪い、レーンを序盤から壊して試合を15分で終わらせる。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'even',
        headline: 'ファーム速度勝負。ZacのEエンゲージに注意してサイドを荒らす',
        keyRule: 'Zacがガンクした逆サイドのタワーや中立を高速で奪うクロストレードを徹底。',
        powerSpikeAdvantage: 'mid'
      }
    ]
  },
  JarvanIV: {
    id: 'JarvanIV',
    name: 'ジャーヴァンIV',
    archetype: 'ブルーザー',
    dangerLevel: 'S',
    invadeRisk: '高 (赤・青荒らし)',
    clearStyle: 'Lv2/Lv3 即ガンク型 (EQノックアップ)',
    coreWeakness: 'EQコンボを外した瞬間にスキルがなくなりカカシになる。ブリンク持ちに対してR檻が機能しにくい。',
    adviceList: [
      {
        myChampId: 'Viego',
        myChampName: 'ヴィエゴ',
        rating: 'even',
        headline: 'EQをかわして追撃、R檻は自力フラッシュかRで脱出',
        keyRule: 'J4のEQコンボを横にステップして回避できれば、その後の殴り合いは100%勝てる。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'favored',
        headline: 'J4のガンク先へのカウンターEとR檻越えエンゲージ',
        keyRule: 'J4のR檻の中へZacのEで飛び込めば敵全体をまとめて拘束できる。',
        powerSpikeAdvantage: 'late'
      },
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'favored',
        headline: 'WでEQノックアップを完全無効化し、恐怖で捕獲',
        keyRule: 'J4の旗（E）が見えた瞬間にWを構えれば、Qの突進をシールドで防ぎつつカウンター可能。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'even',
        headline: '初動3分のガンク合戦。機動力とWシールドでJ4を翻弄',
        keyRule: 'Wで味方に飛んでJ4のEQを回避。R檻もワードジャンプで簡単に飛び越えられる。',
        powerSpikeAdvantage: 'early'
      }
    ]
  },
  Shaco: {
    id: 'Shaco',
    name: 'シャコ',
    archetype: 'アサシン',
    dangerLevel: 'S',
    invadeRisk: '極高 (Lv2/3インベード)',
    clearStyle: 'Wボックス設置最速Lv2 ➔ 即座に敵バフへインベード',
    coreWeakness: 'オラクルレンズ（赤トリ）とピンクワードでステルスを看破されると脆い。集団戦での影響力が極めて低い。',
    adviceList: [
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'favored',
        headline: 'QとEのステルス看破（真の視界）でShacoの存在意義を消滅させる',
        keyRule: 'Shacoが消えたら即座にEを叩くか、Qを当ててステルスを無力化。赤トリ常備。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Vi',
        myChampName: 'ヴァイ',
        rating: 'favored',
        headline: 'Rの確定追尾で分身・ステルスを無視して本体を叩き潰す',
        keyRule: 'Shaco本体を特定してRを撃てば、消えても確実に追尾して拘束できる。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'even',
        headline: 'Wでボックス恐怖を無効化、暗黒RでShacoの分身を混乱させる',
        keyRule: 'ボックスを踏みそうになったらW。ファームを止めずにLv6を急ぐ。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'even',
        headline: '序盤の赤インベードを警戒し、逆スタートで安全確保',
        keyRule: 'Lv1で自陣ブッシュにワードを置き、Shacoのインベードルートを完全に避ける。',
        powerSpikeAdvantage: 'late'
      }
    ]
  },
  Karthus: {
    id: 'Karthus',
    name: 'カーサス',
    archetype: 'ファーム型',
    dangerLevel: 'C',
    invadeRisk: '低 (自陣フルクリア)',
    clearStyle: '最速2:40フルクリア ➔ スカトル無視で即リコール・周回継続',
    coreWeakness: '序盤のインベード耐性が皆無。接近されるとQを当てるのが困難で簡単にキルできる。',
    adviceList: [
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'favored',
        headline: 'Lv3インベードでKarthusの森を住処にし、連続キル',
        keyRule: 'Karthusの2周目キャンプに待ち伏せ。接近して殴り合えば100%勝てる。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'favored',
        headline: '暗黒RでKarthusを孤立暗殺、WでKarthusのR（鎮魂歌）を完全無効化',
        keyRule: 'KarthusがRを詠唱したら落ち着いてWを発動。ダメージを0に抑えられる。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Elise',
        myChampName: 'エリス',
        rating: 'favored',
        headline: 'Lv3ダイブと森荒らしでKarthusがスケールする前に終わらせる',
        keyRule: 'Karthusのキャンプを奪い、死後パッシブの範囲外へ蜘蛛Eで退避する。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Viego',
        myChampName: 'ヴィエゴ',
        rating: 'favored',
        headline: '侵入してキルを奪い、Karthusに憑依して敵レーンへRを撃ち込む',
        keyRule: '1v1で圧倒できるため、スカトル前や敵森で積極的に遭遇戦を仕掛ける。',
        powerSpikeAdvantage: 'mid'
      }
    ]
  },
  Vi: {
    id: 'Vi',
    name: 'ヴァイ',
    archetype: 'ブルーザー',
    dangerLevel: 'A',
    invadeRisk: '中 (スカトル衝突)',
    clearStyle: 'フルクリア または Lv3ガンク',
    coreWeakness: 'Qを外すとエンゲージ手段がRしかなくなり、味方が追いつけない位置で孤立しやすい。',
    adviceList: [
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'favored',
        headline: 'WでViのQまたはRを弾き、殴り合いで粉砕',
        keyRule: 'ViのQチャージを見てWを貼るか、R着弾直前にWを合わせればノックアップを無効化できる。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'favored',
        headline: 'Viが味方キャリーにRを入れた瞬間へカウンターCCで保護',
        keyRule: 'ViがRで突っ込んできたら、その着地点にZacのQ/Rを入れて味方を守り切る。',
        powerSpikeAdvantage: 'late'
      },
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'even',
        headline: 'ViのQをWシールドやステップで回避し、R蹴りで引き剥がす',
        keyRule: 'ViのQをかわした瞬間に反撃。接近されてもR（竜の怒り）で壁へ蹴り飛ばす。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Viego',
        myChampName: 'ヴィエゴ',
        rating: 'unfavored',
        headline: 'Viの確定Rロックオンでフォーカスされやすく、リセットが阻まれる',
        keyRule: 'ViがRを使うのを確認するまで集団戦には後入りする。1v1は避ける。',
        powerSpikeAdvantage: 'late'
      }
    ]
  },
  Elise: {
    id: 'Elise',
    name: 'エリス',
    archetype: 'アサシン',
    dangerLevel: 'S',
    invadeRisk: '高 (赤・青荒らし)',
    clearStyle: '3キャンプ最速Lv3 (2:15) ➔ 2:20〜2:30 タワーダイブ',
    coreWeakness: '集団戦の正面衝突が極めて弱い。序盤のダイブをカウンターガンクで防がれると失速する。',
    adviceList: [
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'favored',
        headline: 'Wでコクーン（Eスタン）を完全ブロックし、恐怖で捕殺',
        keyRule: 'Eliseの唯一の拘束手段であるEをWで防げば、殴り合いで100%勝てる。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'favored',
        headline: 'Eliseのダイブ先へTPやEでカウンター。後半スケールで圧倒',
        keyRule: 'Eliseがダイブしようとしているレーンへ先回りして待機。中盤以降はZacの独壇場。',
        powerSpikeAdvantage: 'late'
      },
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'even',
        headline: '序盤の最速ガンク・ダイブ対決。スタン回避が勝敗の分かれ目',
        keyRule: 'Eliseの人型E（コクーン）を横ステップで回避できればLeeSinの勝利。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Viego',
        myChampName: 'ヴィエゴ',
        rating: 'unfavored',
        headline: '序盤ダイブでレーンを破壊されやすく、1v1バーストも高い',
        keyRule: '序盤のEliseとは戦わない。逆サイドのタワー下ダイブ警戒ピンを味方に出す。',
        powerSpikeAdvantage: 'late'
      }
    ]
  },
  Lillia: {
    id: 'Lillia',
    name: 'リリア',
    archetype: 'スカーミッシャー',
    dangerLevel: 'C',
    invadeRisk: '低 (自陣フルクリア)',
    clearStyle: '最速2:45フルクリア ➔ スピードで敵森荒らし',
    coreWeakness: 'ポイント＆クリックの確定CCやバーストアサシンに捕まると一瞬で溶ける。',
    adviceList: [
      {
        myChampId: 'Vi',
        myChampName: 'ヴァイ',
        rating: 'favored',
        headline: 'Rの不可避ロックオンで超機動力を強制停止させて即死',
        keyRule: 'Lilliaが足を速くしてカイトしてきても、ViのRなら絶対に逃げられない。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'favored',
        headline: '序盤インベードとRインセックキックでカイトを許さず粉砕',
        keyRule: '序盤の虚弱なLilliaを自陣森で捕まえてキル。集団戦はRで味方に蹴り込む。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'favored',
        headline: '暗黒Rで追撃し、WでLilliaのR（子守唄）を完全ブロック',
        keyRule: 'Lilliaの眠り付与に合わせてWを発動すればスタンを無効化できる。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'unfavored',
        headline: 'Lilliaの割合ダメージと高機動カイトに弄ばれやすい',
        keyRule: 'Zacのスキルがかわされやすい。味方に確定CC持ちがいる時のみ戦う。',
        powerSpikeAdvantage: 'even'
      }
    ]
  },
  MasterYi: {
    id: 'MasterYi',
    name: 'マスター・イー',
    archetype: 'アサシン',
    dangerLevel: 'C',
    invadeRisk: '低 (自陣フルクリア)',
    clearStyle: 'フルクリア ➔ Lv6までファーム最優先',
    coreWeakness: 'ハードCC（スタン、ノックアップ、サプレッション）に極めて弱く、フォーカスされると一瞬で溶ける。',
    adviceList: [
      {
        myChampId: 'Vi',
        myChampName: 'ヴァイ',
        rating: 'favored',
        headline: 'Rの確定CCでYiのQ後に確実に捕獲し、味方フォーカスで即死',
        keyRule: 'YiがQを使った直後にRを叩き込む。逃げも無敵も許さず完封。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'favored',
        headline: 'Q/E/RのCC連鎖でYiを動かさず拘束し続ける',
        keyRule: 'YiがQから出てきた瞬間にCCを重ねる。育つ前に序盤ガンクでレーン差をつける。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'favored',
        headline: '序盤インベードでYiのファームを完全破壊し、Rで突き放す',
        keyRule: 'YiがLv6になる前に森を荒らし尽くす。Yiのウルトに対してRで蹴り飛ばす。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'even',
        headline: 'Eの恐怖が入れば勝てるが、YiがQで恐怖を回避すると不利',
        keyRule: 'YiのQ後にEをかける。序盤の遭遇戦でキルを取って先行する。',
        powerSpikeAdvantage: 'mid'
      }
    ]
  },
  Evelynn: {
    id: 'Evelynn',
    name: 'エヴリン',
    archetype: 'アサシン',
    dangerLevel: 'C',
    invadeRisk: '低 (自陣フルクリア)',
    clearStyle: '最速2:45フルクリア ➔ Lv6まで自陣周回',
    coreWeakness: 'Lv6前のステルスがない間は極めて弱い。序盤インベードとコントロールワードで森を照らされると無力化。',
    adviceList: [
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'favored',
        headline: '序盤インベードで虐殺し、Q/Eの真の視界でステルス看破',
        keyRule: 'Lv3でEvelynnの森に侵入してキル。ピンクワードを敵森の出口に配置。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Vi',
        myChampName: 'ヴァイ',
        rating: 'favored',
        headline: 'RロックオンでEvelynnのRエスケープ前にワンコンボで溶かす',
        keyRule: 'Evelynnが見えた瞬間にRでエンゲージ。ハート魅了に合わせてQで反撃。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'favored',
        headline: 'Wでハート魅了を完全無効化し、暗黒Rで追撃',
        keyRule: 'ハートが満タンになった瞬間にWを貼れば魅了を弾いて一方的に殴り勝てる。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'even',
        headline: 'コントロールワード徹底と中盤集団戦のCCで完封',
        keyRule: 'レーン横のブッシュにピンクワードを常備。集団戦でEvelynnが飛び込む隙を与えない。',
        powerSpikeAdvantage: 'late'
      }
    ]
  },
  Graves: {
    id: 'Graves',
    name: 'グレイブス',
    archetype: 'スカーミッシャー',
    dangerLevel: 'A',
    invadeRisk: '高 (赤・青荒らし)',
    clearStyle: '高ヘルスフルクリア または カウンターインベード',
    coreWeakness: 'AP魔法ダメージと長射程CCに弱い。AD相手には硬いが、APバーストには一瞬で沈む。',
    adviceList: [
      {
        myChampId: 'Elise',
        myChampName: 'エリス',
        rating: 'favored',
        headline: 'APバーストとEスタンでGravesのアーマーパッシブを貫通即死',
        keyRule: 'GravesのEスタックは魔法防御を上げない。EliseのAPコンボが直撃すれば即死。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'favored',
        headline: 'AP魔法ダメージと理不尽なCCチェーンでGravesを行動不能に',
        keyRule: 'Gravesの射程外からEでエンゲージ。煙幕（W）に惑わされずCCを繋げる。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Vi',
        myChampName: 'ヴァイ',
        rating: 'even',
        headline: 'Wのアーマー破壊で対抗。煙幕を避けつつRでロック',
        keyRule: 'Gravesの煙幕で視界を奪われないように注意し、Rで確実に拘束する。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'even',
        headline: '純粋なフィジカル対決。GravesのEスタックが溜まる前にバースト',
        keyRule: '戦闘が長引くとGravesのアーマーが上がって不利。序盤の奇襲ワンコンボで削る。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Viego',
        myChampName: 'ヴィエゴ',
        rating: 'unfavored',
        headline: 'Gravesの高いアーマーと煙幕により、正面殴り合いで不利になりやすい',
        keyRule: '1v1の正面衝突は避ける。Gravesのスキルが味方に吐かれた後の後入りを徹底。',
        powerSpikeAdvantage: 'late'
      }
    ]
  },
  XinZhao: {
    id: 'XinZhao',
    name: 'シン・ジャオ',
    archetype: 'ブルーザー',
    dangerLevel: 'S',
    invadeRisk: '高 (赤・青荒らし)',
    clearStyle: 'Lv3即ガンク または スカトル先制攻撃',
    coreWeakness: 'ブリンクがEの飛び込みのみで逃げ性能が皆無。入った後に引けないため、フォーカスされると死ぬ。',
    adviceList: [
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'favored',
        headline: 'Xinのガンク先へカウンターE。Xinの逃げ場を無くして包囲殲滅',
        keyRule: 'Xinは一度入ると逃げられない。味方タワー下に引き込んでZacのQ/Rで固定する。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Vi',
        myChampName: 'ヴァイ',
        rating: 'favored',
        headline: 'XinのE突進をQノックバックで弾き、Rで完封',
        keyRule: 'Xinが飛び込んできた瞬間にQを当てる。1v1でもシールドとアーマー破壊で有利。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'even',
        headline: '3分リバーのタイマン勝負。R蹴りでXinのR円外へ弾き飛ばす',
        keyRule: 'XinのQ3ノックアップをWでかわす。XinのR円外から攻撃するか、Rで蹴り離す。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Viego',
        myChampName: 'ヴィエゴ',
        rating: 'even',
        headline: 'Lv3タイマンは回避し、中盤以降の集団戦リセットで逆転',
        keyRule: '序盤のスカトル1v1はXin有利。逆サイドを回って装備差をつけ、中盤で勝つ。',
        powerSpikeAdvantage: 'mid'
      }
    ]
  },
  Kindred: {
    id: 'Kindred',
    name: 'キンドレッド',
    archetype: 'マークスマン',
    dangerLevel: 'A',
    invadeRisk: '高 (マーク発生キャンプ荒らし)',
    clearStyle: '3キャンプ ➔ マーク付きスカトル/キャンプ侵入',
    coreWeakness: 'マークの出現位置が敵味方双方に可視化される。マークを先回りして管理されるとスケールできない。',
    adviceList: [
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'favored',
        headline: 'R蹴りでKindredのR（羊の加護）範囲外へ蹴り出して即死させる',
        keyRule: 'Kindredが死に際にRを撃ったら、即座にR（竜の怒り）でエリア外へ蹴り飛ばしてトドメ。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Vi',
        myChampName: 'ヴァイ',
        rating: 'favored',
        headline: 'QとRの確定バーストでKindredにRを撃たせる間もなく即死',
        keyRule: 'ブッシュ待ち伏せからワンコンボで溶かす。マークキャンプに先回りして待機。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'favored',
        headline: '暗黒Rで視界を奪い、KindredのR外から接近して恐怖で捕縛',
        keyRule: 'WでKindredのEスロウを無効化。マークが出たキャンプを先取りする。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Zac',
        myChampName: 'ザック',
        rating: 'even',
        headline: 'RでKindredを羊の加護エリア外へ押し出す技術が重要',
        keyRule: 'KindredのR範囲内でZacのRをバウンドさせ、Kindredをエリア外に押し出す。',
        powerSpikeAdvantage: 'mid'
      }
    ]
  },
  Sejuani: {
    id: 'Sejuani',
    name: 'セジュアニ',
    archetype: 'タンク',
    dangerLevel: 'C',
    invadeRisk: '低 (自陣フルクリア)',
    clearStyle: 'フルクリア または Lv3ガンク',
    coreWeakness: '序盤のタイマン火力が低く、メレー味方がいないとEのスタンスタックが溜まりにくい。',
    adviceList: [
      {
        myChampId: 'Viego',
        myChampName: 'ヴィエゴ',
        rating: 'favored',
        headline: '破滅の王剣の割合ダメージでSejuaniを溶かし、憑依して敵を拘束',
        keyRule: 'Sejuaniのパッシブ氷アーマーを小突いて剥がしてからコンボを叩き込む。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'LeeSin',
        myChampName: 'リー・シン',
        rating: 'favored',
        headline: '序盤インベードで森を奪い尽くし、リバー主導権を完全掌握',
        keyRule: 'Sejuaniのジャングルに侵入してキル。SejuaniのRをWやフラッシュでかわす。',
        powerSpikeAdvantage: 'early'
      },
      {
        myChampId: 'Nocturne',
        myChampName: 'ノクターン',
        rating: 'favored',
        headline: 'WでSejuaniのR（氷河の牢獄）を完全無効化',
        keyRule: 'Sejuaniが投げてくる氷の投げ縄（R）にWを合わせれば気絶せず逆にチャンス。',
        powerSpikeAdvantage: 'mid'
      },
      {
        myChampId: 'Elise',
        myChampName: 'エリス',
        rating: 'favored',
        headline: '蜘蛛Qの現在HP割合ダメージと序盤ダイブでSejuaniが育つ前に破壊',
        keyRule: '序盤からサイドレーンを荒らして試合を決める。蜘蛛EでSejuaniのCCを透かす。',
        powerSpikeAdvantage: 'early'
      }
    ]
  }
};
