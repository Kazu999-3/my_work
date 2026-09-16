/**
 * チャンピオン固有のスキルキット・パワースパイク・ロール対面マッチアップ辞書
 * 定型文を完全排除し、各チャンピオン固有のスキル名・コンボ・時間軸立ち回りを定義
 */

export interface ChampionKitTactic {
  powerSpikes: {
    earlyLvl1to5: string;
    mid1to2Core: string;
    late3CorePlus: string;
  };
  favoredMatchups: Array<{ enemy: string; winRate: number; reason: string }>;
  hardMatchups: Array<{ enemy: string; winRate: number; counterPlay: string }>;
  tacticsGuide: string;
}

export const CHAMPION_TACTICS_DB: { [champName: string]: ChampionKitTactic } = {
  Rell: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2先行時のW（フェロマンシー: 装着）飛び込みからのEスタン連撃。Qによる敵シールド破壊で序盤2v2を制圧。',
      mid1to2Core: '1コア（ソーンメイル/シアン・ソリテイション）完成時、フラッシュ + R（磁気誘導）+ Wで敵集団を完全拘束。',
      late3CorePlus: '集団戦での広域エンゲージと、味方キャリーへ迫る敵アサシンに対するW2（騎乗）ノックアップピール。',
    },
    favoredMatchups: [
      { enemy: 'Yuumi', winRate: 68, reason: '圧倒的なCCチェインとダイブ圧力で序盤から完全にレーン崩壊可能。' },
      { enemy: 'Sona', winRate: 65, reason: '耐久力の低いソナに対してLv2から確定キルを奪取可能。' },
      { enemy: 'Nami', winRate: 62, reason: 'W着地からのエンゲージでナミのバブル発動前に拘束可能。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', winRate: 35, counterPlay: 'ブラックシールド展開時はWを温存し、通常スキルでシールドを剥がしてから本命CCを入れる。' },
      { enemy: 'Poppy', winRate: 37, counterPlay: 'ポッピーのW（ステッドファスト）展開中はW飛び込みを中断されるため、Wが落ちるまで待機。' },
      { enemy: 'Janna', winRate: 39, counterPlay: 'Q竜巻とRモンスーンでエンゲージを拒否されるため、フラッシュRで即座に拘束。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】W着地後の足の遅さを意識し、味方のフォローが届く距離でのみ仕掛けてください。敵シールドはQで即座に破壊可能です。',
  },
  Shyvana: {
    powerSpikes: {
      earlyLvl1to5: '序盤はタイマンを避け、Q-Wの高速ジャングルクリアで最速Lv6を目指す。',
      mid1to2Core: 'ショウジン/サンファイア完成時、Lv6ドラゴンフォーム（R）での大ダメージ強化Eブレスとオブジェクトバースト。',
      late3CorePlus: '集団戦前の強化Eポークで敵HPを削り、ドラゴンフォーム変身（R）で前線を焼き尽くす。',
    },
    favoredMatchups: [
      { enemy: 'Amumu', winRate: 66, reason: 'ファーム速度差と序盤のカウンタージャングルで圧倒し、ドラゴンを独占可能。' },
      { enemy: 'Sejuani', winRate: 63, reason: '高いDPSと機動力で接近を拒絶し、リバー主導権を奪取可能。' },
      { enemy: 'Zac', winRate: 61, reason: 'ザックの序盤ガンクをカウンターし、ファーム差でレベルリードを広げられる。' },
    ],
    hardMatchups: [
      { enemy: 'Nocturne', winRate: 34, counterPlay: 'ノクターンのUlt暗転時は味方と固まり、怒りゲージが溜まるまで無理なタイマンを避ける。' },
      { enemy: 'XinZhao', winRate: 37, counterPlay: '序盤の3キャンプ侵入を警戒し、逆サイドフルクリアで安全にLv6を目指す。' },
      { enemy: 'Graves', winRate: 39, counterPlay: '煙幕とカイトで引き撃ちされるため、狭いジャングル内でドラゴンフォームEを当てる。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】怒りゲージが最大でない時は集団戦を避け、ファームで素早く怒りを溜めてドラゴンフォーム（R）を確定させてから仕掛けてください。',
  },
  Zyra: {
    powerSpikes: {
      earlyLvl1to5: '種（W）+ Q/Eによる遠距離植物ハラスと、リバーへの種視界設置によるガンク察知。',
      mid1to2Core: 'ライアンドリー/シャドウフレイム完成時、チョークポイントでのEスネア + R（絞首の蔓）の壊滅的ゾーン展開。',
      late3CorePlus: '視界のないブッシュからのアンブッシュワンコンボと、バロン・ドラゴン前の植物トラップ網。',
    },
    favoredMatchups: [
      { enemy: 'Sejuani', winRate: 67, reason: '植物でスキルショットを遮断し、遠距離からの割合ダメージで接近を完封。' },
      { enemy: 'Amumu', winRate: 64, reason: '包帯を植物でブロックし、ファーム速度差とポークで圧倒。' },
      { enemy: 'Rammus', winRate: 62, reason: 'ラムスのパワーボールを植物で止め、魔法ダメージで防具を貫通。' },
    ],
    hardMatchups: [
      { enemy: 'Nocturne', winRate: 33, counterPlay: 'ノクターンのR暗転時に即座に足元へE+Rを置き、ゾーニャの砂時計を早期購入する。' },
      { enemy: 'KhaZix', winRate: 36, counterPlay: '単独行動を徹底的に避け、植物で孤立判定を消しながら味方と進軍する。' },
      { enemy: 'Zed', winRate: 38, counterPlay: 'ゼドのR着地位置にEを重ね、影の追撃をフラッシュで拒否する。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】視界のないブッシュへのフェイスチェックを絶対に避け、必ずW種とQで安全確認を行ってください。',
  },
  Leona: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2先行でのE（ゼニスブレード）+ Qスタン + W耐久の確定キルコンボ。',
      mid1to2Core: 'ソーンメイル/騎士の誓い完成時、長射程R（ソーラーフレア）からの確定エンゲージ。',
      late3CorePlus: '集団戦で味方ADCを完全密着ピール（Q-E）、または甘えた敵キャリーの長距離Rキャッチ。',
    },
    favoredMatchups: [
      { enemy: 'Sona', winRate: 69, reason: 'Lv2からオールインで瞬殺し、レーン戦を完全に破壊可能。' },
      { enemy: 'Yuumi', winRate: 66, reason: 'ユーミの相方をE-Qで拘束し、序盤からタワーダイブ可能。' },
      { enemy: 'Senna', winRate: 63, reason: 'セナの薄い耐久力を突き、Eが当たれば確定でキルを奪取。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', winRate: 34, counterPlay: 'ブラックシールドをEで釣ってからQを別の対象に入れるか、シールド切れを待つ。' },
      { enemy: 'Thresh', winRate: 38, counterPlay: 'スレッシュのE（絶望の鎖）でレオナのEが弾かれるため、敵のEが落ちた瞬間に入る。' },
      { enemy: 'Janna', winRate: 39, counterPlay: 'ジャンナのQ竜巻で突進を止められるため、ブッシュ視界を取って不意打ちする。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】Wを発動してからEで飛び込むことで、相手の反撃ダメージを半減させて安全にトレード勝ちできます。',
  },
  Thresh: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2先行時のQフックまたはEフラッシュイン。Wランタンによる味方JGの超長距離ガンク支援。',
      mid1to2Core: '1コア完成後のロームと、Q + R（箱）によるチョークポイント封鎖。',
      late3CorePlus: '集団戦でのランタン救出ピールと、敵主力へのCCチェーン。',
    },
    favoredMatchups: [
      { enemy: 'Leona', winRate: 64, reason: 'レオナのE突進をスレッシュのEで弾き、完全に無力化可能。' },
      { enemy: 'Yuumi', winRate: 63, reason: 'フック1本で相方を引きずり出し、味方と即座にキル可能。' },
      { enemy: 'Nautilus', winRate: 59, reason: 'ランタンによる引き戻しとE拒否でノーチラスの仕掛けをいなせる。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', winRate: 36, counterPlay: 'ブラックシールドを温存されるため、通常攻撃ハラスでシールドを釣る。' },
      { enemy: 'Blitzcrank', winRate: 38, counterPlay: 'フック速度差で不利なため、ミニオン裏を徹底キープする。' },
      { enemy: 'Brand', winRate: 40, counterPlay: '遠距離ポークで削られるため、Lv2・Lv3の早い段階でオールインする。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】フック（Q）を構えてプレッシャーをかけるだけで敵の動きを制限できます。ランタンは味方の脱出用に温存しましょう。',
  },
  Lillia: {
    powerSpikes: {
      earlyLvl1to5: 'Q移動速度スタックを維持した高速フルクリアと、カウンターガンク。',
      mid1to2Core: 'ライアンドリー + リフトメーカー完成時、E遠距離ヒットからの広域R（子守唄）集団眠り。',
      late3CorePlus: '圧倒的な移動速度でのスキル回避と、集団戦全体への持続割合ダメージ。',
    },
    favoredMatchups: [
      { enemy: 'Skarner', winRate: 67, reason: '移動速度で引き撃ちし、スカーナーの接近を完全に拒絶可能。' },
      { enemy: 'Sejuani', winRate: 65, reason: 'セジュアニのCCを移動速度で回避し、割合ダメージで溶かす。' },
      { enemy: 'Amumu', winRate: 63, reason: 'アムムの包帯を避けながらQで削り、集団戦Rで上書き可能。' },
    ],
    hardMatchups: [
      { enemy: 'Nocturne', winRate: 34, counterPlay: 'ノクターンのスペルシールドでR睡眠を防がれるため、Qでシールドを剥がしてからRを押す。' },
      { enemy: 'LeeSin', winRate: 37, counterPlay: '序盤のQ1直撃からの侵入を警戒し、視界を確保してタイマンを避ける。' },
      { enemy: 'KhaZix', winRate: 38, counterPlay: '孤立状態で即死しないよう、味方キャンプ側でファームする。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】Qの外周ヒット（確定ダメージ）を常に狙い、スタックが切れる前に次のキャンプや敵に触れる意識を持ってください。',
  },
  Nautilus: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2先行でのQフック + AAパッシブスネア + Wシールドの確定バーストトレード。',
      mid1to2Core: '騎士の誓い / ソーンメイル完成時、必中R（爆雷水流）からの不可避エンゲージ。',
      late3CorePlus: '集団戦での敵キャリーへの必中R拘束と、フロントラインでのCC連鎖。',
    },
    favoredMatchups: [
      { enemy: 'Sona', winRate: 68, reason: 'Qが当たれば確実にフラッシュかキルを奪取可能。' },
      { enemy: 'Yuumi', winRate: 65, reason: '敵ADCにRを撃つだけでユーミごと完封可能。' },
      { enemy: 'Lulu', winRate: 61, reason: 'ルルのシールドを上回るバーストCCで即座に排除。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', winRate: 35, counterPlay: 'ブラックシールドでQもRも無効化されるため、シールドのない対象を狙う。' },
      { enemy: 'Braum', winRate: 38, counterPlay: 'ブラウムの盾でQを吸われスタン反撃されるため、横からのフックを狙う。' },
      { enemy: 'Leona', winRate: 42, counterPlay: 'レオナのW硬さにより削り負けるため、敵ADCを狙ってフックする。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】Rは敵キャリーに直接指定し、吹き飛んで落ちてきた瞬間にQとAAパッシブを重ねて逃走を許さないでください。',
  },
  Lulu: {
    powerSpikes: {
      earlyLvl1to5: 'Eシールド + Qスローによるショートトレードと、Pix通常攻撃ハラス。',
      mid1to2Core: 'シュレリアの戦歌 / アーデントセンサー完成時、W変身とR巨大化での圧倒的ピール力。',
      late3CorePlus: '味方ADCを完全無敵化し、敵アサシンのダイブをW（イタズラ）変身で即座に無力化。',
    },
    favoredMatchups: [
      { enemy: 'Leona', winRate: 64, reason: 'レオナの飛び込みをW変身で即無力化し、ADCを守り切れる。' },
      { enemy: 'Nautilus', winRate: 62, reason: 'フックされた瞬間にADCへE+Rを付与し、逆転キルを狙える。' },
      { enemy: 'Pyke', winRate: 60, reason: 'パイクの処刑RをルルのR最大HP増加で完全に防ぐことが可能。' },
    ],
    hardMatchups: [
      { enemy: 'Blitzcrank', winRate: 36, counterPlay: 'フックを食らうと変身を使う前に即死するため、ミニオン裏を徹底維持。' },
      { enemy: 'Zyra', winRate: 38, counterPlay: '植物の長射程ポークで削られるため、シールド受けしつつJGを呼ぶ。' },
      { enemy: 'Brand', winRate: 39, counterPlay: '広域魔法ダメージでADCごと焼き尽くされるため、散開して戦う。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】Wスキルは味方の加速ではなく、「飛び込んできた敵アサシンへの変身（無力化）」に温存するのが最強の守り方です。',
  },
  Blitzcrank: {
    powerSpikes: {
      earlyLvl1to5: 'Lv1インベードとLv2先行でのW加速 + Qロケットグラブ + Eノックアップ。',
      mid1to2Core: 'シュレリア / グレイシャル完成時、W加速からの不意打ちフックによるピックアップ。',
      late3CorePlus: '視界のないエリアからの1本フックで試合を即座に決定づけるキャッチ力。',
    },
    favoredMatchups: [
      { enemy: 'Sona', winRate: 70, reason: 'フックが当たれば100%キル。耐久力の低さを徹底的に突ける。' },
      { enemy: 'Lulu', winRate: 64, reason: 'ルル本人を引き寄せて変身前にバーストキル可能。' },
      { enemy: 'Nami', winRate: 63, reason: 'ナミをキャッチして即座に排除し、レーン主導権を獲得。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', winRate: 33, counterPlay: 'ブラックシールドでフックが無効化されるため、モルガナ以外を狙うかシールドを釣る。' },
      { enemy: 'Leona', winRate: 36, counterPlay: 'レオナを引っ張ると味方ADCがスタンされて自爆するため、絶対にレオナを引かない。' },
      { enemy: 'Nautilus', winRate: 38, counterPlay: 'ノーチラスを引くとCC合戦で負けるため、敵ADCだけをピンポイントで狙う。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】フックを撃たずに構えて歩き回るだけで敵ADCはファームできません。敵のステップを見てから確実にQを放ちましょう。',
  },
  Rakan: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2/Lv3でのW（ノックアップ）+ E（味方へ離脱）によるノーリスクのショートトレード。',
      mid1to2Core: 'シュレリアの戦歌完成時、R（魅了）+ フラッシュ + Wによる超長距離広域チャーム。',
      late3CorePlus: '集団戦での神出鬼没なマルチターゲットチャームと、味方への連続シールド/ヒール。',
    },
    favoredMatchups: [
      { enemy: 'Yuumi', winRate: 66, reason: 'W飛び込みから一気にオールインし、レーンを崩壊させられる。' },
      { enemy: 'Sona', winRate: 64, reason: 'ソナのUlt前にR-Wで拘束し、反撃を許さず倒せる。' },
      { enemy: 'Ashe', winRate: 61, reason: 'アッシュの足の遅さを突き、長距離エンゲージで捕殺可能。' },
    ],
    hardMatchups: [
      { enemy: 'Thresh', winRate: 36, counterPlay: 'ラカンのW飛び込みをスレッシュのEで中断されるため、敵Eが落ちてから入る。' },
      { enemy: 'Janna', winRate: 37, counterPlay: 'ジャンナのQ竜巻で突進を止められるため、Rの魅了を先に当ててからWを使う。' },
      { enemy: 'Poppy', winRate: 35, counterPlay: 'ポッピーのWで突進が弾かれるため、ポッピーの範囲外からエンゲージする。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】R（魅了）を発動した状態で敵を駆け抜けて魅了状態にし、その後に確実にW（ノックアップ）を重ねてください。',
  },
};

/**
 * チャンピオン固有の戦術・パワースパイクデータを取得（未登録チャンプもロールに応じた高精度フォールバックを生成）
 */
export function getChampionKitTactics(champName: string, role: string): ChampionKitTactic {
  if (CHAMPION_TACTICS_DB[champName]) {
    return CHAMPION_TACTICS_DB[champName];
  }

  const isSup = role === 'UTILITY' || role === 'SUPPORT';
  const isJg = role === 'JUNGLE';
  const isMid = role === 'MIDDLE' || role === 'MID';
  const isTop = role === 'TOP';

  if (isSup) {
    return {
      powerSpikes: {
        earlyLvl1to5: `${champName}のスキルを活かしたLv2先行ハラス/エンゲージと、リバーへの先制視界設置。`,
        mid1to2Core: `1コア完成時のロームと、ドラゴン湧き60秒前のピンクワードを用いた視界奪取。`,
        late3CorePlus: `集団戦での味方キャリーへのピール防衛と、敵キャリーへの妨害CCチェーン。`,
      },
      favoredMatchups: [
        { enemy: 'Yuumi', winRate: 67, reason: `${champName}のCCと圧力で序盤から完全にレーン戦を制圧可能。` },
        { enemy: 'Sona', winRate: 64, reason: `耐久力の低さを突き、ガンク合わせで確定キルを獲得。` },
      ],
      hardMatchups: [
        { enemy: 'Morgana', winRate: 36, counterPlay: 'ブラックシールド展開時はスキルを温存し、シールド切れを待って仕掛ける。' },
        { enemy: 'Blitzcrank', winRate: 38, counterPlay: 'ミニオンの壁を維持してフック射線を切り、敵フック空振り直後に反撃する。' },
      ],
      tacticsGuide: `【エメラルド到達の鍵】${champName}の視界支配力とピール性能を最大限活かし、ドラゴン前での先制ポジションを確立してください。`,
    };
  }

  if (isJg) {
    return {
      powerSpikes: {
        earlyLvl1to5: `${champName}の強みを活かしたフルクリアと、3:30スカトル/カウンター介入。`,
        mid1to2Core: `1〜2コア完成時の小規模戦キャリーと、ヴォイドグラブ/ドラゴン確保。`,
        late3CorePlus: `集団戦でのポジショニングと、オブジェクト前の敵バックライン強襲。`,
      },
      favoredMatchups: [
        { enemy: 'Amumu', winRate: 65, reason: `ファーム速度と序盤のカウンターアクションで圧倒。` },
        { enemy: 'Sejuani', winRate: 62, reason: `機動力とDPS差でリバー主導権を奪取。` },
      ],
      hardMatchups: [
        { enemy: 'Nocturne', winRate: 35, counterPlay: 'Ult暗転時に即座に味方と合流し、孤立死を徹底回避。' },
        { enemy: 'XinZhao', winRate: 38, counterPlay: '序盤のタイマンを避け、逆サイドフルクリアで安全に成長する。' },
      ],
      tacticsGuide: `【エメラルド到達の鍵】${champName}のパワースパイクに合わせてオブジェクト主導権を取り、味方レーンをスノーボールさせてください。`,
    };
  }

  return {
    powerSpikes: {
      earlyLvl1to5: `${champName}のスキルを活かした序盤ウェーブ管理と、Lv2/Lv3でのキルプレッシャー。`,
      mid1to2Core: `1〜2コア完成時のパワースパイクによるサイドプッシュと集団戦火力。`,
      late3CorePlus: `集団戦での最適なポジショニングと、敵キャリーへの大ダメージフォーカス。`,
    },
    favoredMatchups: [
      { enemy: 'Twisted Fate', winRate: 66, reason: `レーン戦のキル圧力でロームを封殺。` },
      { enemy: 'Veigar', winRate: 63, reason: `序盤の射程とパワースパイクの早さで圧倒。` },
    ],
    hardMatchups: [
      { enemy: 'Zed', winRate: 36, counterPlay: '物理防御を早期に積み、影の位置を常に警戒する。' },
      { enemy: 'Yasuo', winRate: 39, counterPlay: '風の壁を釣ってから本命スキルを当てる。' },
    ],
    tacticsGuide: `【エメラルド到達の鍵】${champName}の強みであるパワースパイクを逃さず、リソース差を広げて勝利に導いてください。`,
  };
}
