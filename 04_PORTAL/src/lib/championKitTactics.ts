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
  // ★ winRate は根拠のない手書き値で、UIにも表示されていなかったため2026-09-22に削除した。
  favoredMatchups: Array<{ enemy: string; reason: string }>;
  hardMatchups: Array<{ enemy: string; counterPlay: string }>;
  tacticsGuide: string;
}

export const CHAMPION_TACTICS_DB: { [champName: string]: ChampionKitTactic } = {
  // ----------------------------------------------------
  // 🛡️ サポート (SUPPORT)
  // ----------------------------------------------------
  Rell: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2先行時のW（フェロマンシー: 装着）飛び込みからのEスタン連撃。Qによる敵シールド破壊で序盤2v2を制圧。',
      mid1to2Core: '1コア（ソーンメイル/シアン・ソリテイション）完成時、フラッシュ + R（磁気誘導）+ Wで敵集団を完全拘束。',
      late3CorePlus: '集団戦での広域エンゲージと、味方キャリーへ迫る敵アサシンに対するW2（騎乗）ノックアップピール。',
    },
    favoredMatchups: [
      { enemy: 'Yuumi', reason: '圧倒的なCCチェインとダイブ圧力で序盤から完全にレーン崩壊可能。' },
      { enemy: 'Sona', reason: '耐久力の低いソナに対してLv2から確定キルを奪取可能。' },
      { enemy: 'Nami', reason: 'W着地からのエンゲージでナミのバブル発動前に拘束可能。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', counterPlay: 'ブラックシールド展開時はWを温存し、通常スキルでシールドを剥がしてから本命CCを入れる。' },
      { enemy: 'Poppy', counterPlay: 'ポッピーのW（ステッドファスト）展開中はW飛び込みを中断されるため、Wが落ちるまで待機。' },
      { enemy: 'Janna', counterPlay: 'Q竜巻とRモンスーンでエンゲージを拒否されるため、フラッシュRで即座に拘束。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】W着地後の足の遅さを意識し、味方のフォローが届く距離でのみ仕掛けてください。敵シールドはQで即座に破壊可能です。',
  },
  Leona: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2先行でのE（ゼニスブレード）+ Qスタン + W耐久の確定キルコンボ。',
      mid1to2Core: 'ソーンメイル/騎士の誓い完成時、長射程R（ソーラーフレア）からの確定エンゲージ。',
      late3CorePlus: '集団戦で味方ADCを完全密着ピール（Q-E）、または甘えた敵キャリーの長距離Rキャッチ。',
    },
    favoredMatchups: [
      { enemy: 'Sona', reason: 'Lv2からオールインで瞬殺し、レーン戦を完全に破壊可能。' },
      { enemy: 'Yuumi', reason: 'ユーミの相方をE-Qで拘束し、序盤からタワーダイブ可能。' },
      { enemy: 'Senna', reason: 'セナの薄い耐久力を突き、Eが当たれば確定でキルを奪取。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', counterPlay: 'ブラックシールドをEで釣ってからQを別の対象に入れるか、シールド切れを待つ。' },
      { enemy: 'Thresh', counterPlay: 'スレッシュのE（絶望の鎖）でレオナのEが弾かれるため、敵のEが落ちた瞬間に入る。' },
      { enemy: 'Janna', counterPlay: 'ジャンナのQ竜巻で突進を止められるため、ブッシュ視界を取って不意打ちする。' },
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
      { enemy: 'Leona', reason: 'レオナのE突進をスレッシュのEで弾き、完全に無力化可能。' },
      { enemy: 'Yuumi', reason: 'フック1本で相方を引きずり出し、味方と即座にキル可能。' },
      { enemy: 'Nautilus', reason: 'ランタンによる引き戻しとE拒否でノーチラスの仕掛けをいなせる。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', counterPlay: 'ブラックシールドを温存されるため、通常攻撃ハラスでシールドを釣る。' },
      { enemy: 'Blitzcrank', counterPlay: 'フック速度差で不利なため、ミニオン裏を徹底キープする。' },
      { enemy: 'Brand', counterPlay: '遠距離ポークで削られるため、Lv2・Lv3の早い段階でオールインする。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】フック（Q）を構えてプレッシャーをかけるだけで敵の動きを制限できます。ランタンは味方の脱出用に温存しましょう。',
  },
  Nautilus: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2先行でのQフック + AAパッシブスネア + Wシールドの確定バーストトレード。',
      mid1to2Core: '騎士の誓い / ソーンメイル完成時、必中R（爆雷水流）からの不可避エンゲージ。',
      late3CorePlus: '集団戦での敵キャリーへの必中R拘束と、フロントラインでのCC連鎖。',
    },
    favoredMatchups: [
      { enemy: 'Sona', reason: 'Qが当たれば確実にフラッシュかキルを奪取可能。' },
      { enemy: 'Yuumi', reason: '敵ADCにRを撃つだけでユーミごと完封可能。' },
      { enemy: 'Lulu', reason: 'ルルのシールドを上回るバーストCCで即座に排除。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', counterPlay: 'ブラックシールドでQもRも無効化されるため、シールドのない対象を狙う。' },
      { enemy: 'Braum', counterPlay: 'ブラウムの盾でQを吸われスタン反撃されるため、横からのフックを狙う。' },
      { enemy: 'Leona', counterPlay: 'レオナのW硬さにより削り負けるため、敵ADCを狙ってフックする。' },
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
      { enemy: 'Leona', reason: 'レオナの飛び込みをW変身で即無力化し、ADCを守り切れる。' },
      { enemy: 'Nautilus', reason: 'フックされた瞬間にADCへE+Rを付与し、逆転キルを狙える。' },
      { enemy: 'Pyke', reason: 'パイクの処刑RをルルのR最大HP増加で完全に防ぐことが可能。' },
    ],
    hardMatchups: [
      { enemy: 'Blitzcrank', counterPlay: 'フックを食らうと変身を使う前に即死するため、ミニオン裏を徹底維持。' },
      { enemy: 'Zyra', counterPlay: '植物の長射程ポークで削られるため、シールド受けしつつJGを呼ぶ。' },
      { enemy: 'Brand', counterPlay: '広域魔法ダメージでADCごと焼き尽くされるため、散開して戦う。' },
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
      { enemy: 'Sona', reason: 'フックが当たれば100%キル。耐久力の低さを徹底的に突ける。' },
      { enemy: 'Lulu', reason: 'ルル本人を引き寄せて変身前にバーストキル可能。' },
      { enemy: 'Nami', reason: 'ナミをキャッチして即座に排除し、レーン主導権を獲得。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', counterPlay: 'ブラックシールドでフックが無効化されるため、モルガナ以外を狙うかシールドを釣る。' },
      { enemy: 'Leona', counterPlay: 'レオナを引っ張ると味方ADCがスタンされて自爆するため、絶対にレオナを引かない。' },
      { enemy: 'Nautilus', counterPlay: 'ノーチラスを引くとCC合戦で負けるため、敵ADCだけをピンポイントで狙う。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】フックを撃たずに構えて歩き回るだけで敵ADCはファームできません。敵のステップを見てから確実にQを放ちましょう。',
  },
  Pyke: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2のQ（ボーンスキューア）+ E（ファントムアンダーテイカー）による先制キルと、パッシブ灰海の仇敵での高速HP回復。',
      mid1to2Core: '妖夢 / 脅威アイテム完成時、W潜航からの高速ロームとR（水底の急襲）処刑によるゴールド倍増スノーボール。',
      late3CorePlus: '視界外からのアンブッシュ処刑R連鎖と、フックによるオブジェクト前の人数差構築。',
    },
    favoredMatchups: [
      { enemy: 'Yuumi', reason: 'パイクの高速ロームにユーミが追従できず、マップ全体を破壊可能。' },
      { enemy: 'Senna', reason: '薄い耐久力をQ-Eコンボで瞬殺し、Lv1からレーンを支配。' },
      { enemy: 'Sona', reason: 'Qを当てるだけで処刑ラインまで削り切れる。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', counterPlay: 'ブラックシールドでQとEを弾かれるため、シールドのない他レーンへロームする。' },
      { enemy: 'Lulu', counterPlay: 'ルルのR最大HP増加で処刑ラインを外されるため、ルルのUlt使用後にRを切る。' },
      { enemy: 'Soraka', counterPlay: 'ソラカのEサイレンスゾーンでE離脱を封じられるため、ソラカを最優先でキルする。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】レーンに留まらず、Wとオムニストーンの移動速度を活かしてMIDや敵JGへ積極的にロームしてゴールド差を広げてください。',
  },
  Karma: {
    powerSpikes: {
      earlyLvl1to5: 'Lv1からのマントラQ（魂の盟約）による超強力ハラスとプッシュ主導権。Wインナーフレイムでのガンク合わせ。',
      mid1to2Core: 'シュレリア / ヘリアの残響完成時、マントラE（抵抗の誓い）によるチーム全体のシールド＆超加速エンゲージ。',
      late3CorePlus: '集団戦での連続マントラEによる味方全体の耐久底上げと、Qポークによるディスエンゲージ。',
    },
    favoredMatchups: [
      { enemy: 'Thresh', reason: '長射程RQポークで寄せ付けず、フックされてもREシールドでいなせる。' },
      { enemy: 'Braum', reason: 'ブラウムの盾の上から範囲ポークで削り、接近を拒絶。' },
      { enemy: 'Alistar', reason: 'アリスターの飛び込みをWスネアとE加速で完封。' },
    ],
    hardMatchups: [
      { enemy: 'Blitzcrank', counterPlay: 'フックを食らうとREを貼る前に即死するため、ブッシュ視界を徹底管理。' },
      { enemy: 'Nautilus', counterPlay: 'ノーチラスの必中Rで止められるため、長射程を維持してポークに専念する。' },
      { enemy: 'Pyke', counterPlay: 'パイクの急襲と処刑Rに対してシールドが機能しにくいため、Wスネアで距離を取る。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】中盤以降はRQではなく「マントラE（広域シールド＆加速）」をメインに使い、集団戦のイニシエートとピールを支えてください。',
  },
  Braum: {
    powerSpikes: {
      earlyLvl1to5: 'パッシブ（震天動地）4スタックスタンによるLv1インベード/Lv2オールイン拒否。E不破の盾での敵スキル完全遮断。',
      mid1to2Core: 'ソーンメイル / 騎士の誓い完成時、W味方飛びつきからのE展開 + R氷河の裂溝カウンターエンゲージ。',
      late3CorePlus: '集団戦で敵の主要飛び道具（オーンUlt、ナミUlt、メイジスキル）をEで消滅させ、ADCを鉄壁防衛。',
    },
    favoredMatchups: [
      { enemy: 'Nautilus', reason: 'ノーチラスのフックをE盾で吸い、味方ADCへの被害をゼロにしてスタン反撃可能。' },
      { enemy: 'Leona', reason: 'レオナのエンゲージに対して即座にパッシブスタンを重ねて返り討ち。' },
      { enemy: 'Thresh', reason: 'スレッシュのフックをEで防ぎ、レーン戦を安定化。' },
    ],
    hardMatchups: [
      { enemy: 'Zyra', counterPlay: '植物の足元攻撃はE盾で防ぎきれず削られるため、Lv6オールインまで耐える。' },
      { enemy: 'Karma', counterPlay: 'マントラQの長距離ポークで削られるため、ミニオンウェーブを押し付けられないよう管理。' },
      { enemy: 'Morgana', counterPlay: 'ブラックシールドでパッシブスタンを防がれるため、シールドのない対象を狙う。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】自分から突っ込まず、敵が仕掛けてきた瞬間に味方キャリーへWで飛びつき、Eの盾を敵に向けて開いてください。',
  },
  Alistar: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2先行でのW（頭突き）+ Q（粉砕）確定ノックアップコンボと、Eスタン連撃。',
      mid1to2Core: 'ソーンメイル / 騎士の誓い完成時、R（不屈の意志）55〜75%被ダメカットを活かしたノーリスクタワーダイブ。',
      late3CorePlus: '集団戦での敵キャリーのフラッシュイン粉砕、または飛び込んできた敵前衛の頭突き吹き飛ばしピール。',
    },
    favoredMatchups: [
      { enemy: 'Blitzcrank', reason: '引っ張られた瞬間に敵ADCへWQコンボを叩き込み、逆転キルを奪取可能。' },
      { enemy: 'Leona', reason: 'レオナのE飛び込みをQ粉砕で中断させ、味方ADCを守り切れる。' },
      { enemy: 'Yuumi', reason: 'R耐久ダイブでユーミペアをタワー下ごと破壊可能。' },
    ],
    hardMatchups: [
      { enemy: 'Morgana', counterPlay: 'ブラックシールドでWQを完全無力化されるため、他レーンへロームして差をつける。' },
      { enemy: 'Janna', counterPlay: 'ジャンナのQ竜巻でW突進を弾かれるため、フラッシュQから入る。' },
      { enemy: 'Lulu', counterPlay: 'W飛び込みをルルの変身で止められるため、ルルのWが落ちてからエンゲージ。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】Lv6以降はRのダメージ軽減を使って敵タワー下への積極的なダイブを仕掛け、BOTレーンを早期破壊してください。',
  },
  Morgana: {
    powerSpikes: {
      earlyLvl1to5: 'Q（ダークバインド）3秒拘束と、E（ブラックシールド）による敵フック・CC完全無効化。',
      mid1to2Core: 'ゾーニャの砂時計完成時、フラッシュ + R（魂の足枷）+ ゾーニャ発動による不可避の集団スタン。',
      late3CorePlus: '狭いチョークポイントでのQキャッチと、味方ハイパーキャリーへのEブラックシールド付与。',
    },
    favoredMatchups: [
      { enemy: 'Blitzcrank', reason: 'Eブラックシールドを貼るだけでブリッツのフックを100%完封可能。' },
      { enemy: 'Nautilus', reason: 'ノーチラスのQ・Rを両方ともブラックシールドで完全無力化。' },
      { enemy: 'Thresh', reason: 'スレッシュのフックとランタン引き込みを完封。' },
    ],
    hardMatchups: [
      { enemy: 'Karma', counterPlay: 'マントラQの魔法ダメージでブラックシールドを即破壊されるため、ポークを避ける。' },
      { enemy: 'Zyra', counterPlay: '植物の継続ダメージでシールドが剥がされるため、Lv6ゾーニャオールインを狙う。' },
      { enemy: 'Senna', counterPlay: '物理通常攻撃で削られるため、Qダークバインドを確実に当てる。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】Eブラックシールドは適当に使わず、敵の主要CC（フック・スタン）の弾道が見えた瞬間に反応して貼ってください。',
  },
  Rakan: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2/Lv3でのW（ノックアップ）+ E（味方へ離脱）によるノーリスクのショートトレード。',
      mid1to2Core: 'シュレリアの戦歌完成時、R（魅了）+ フラッシュ + Wによる超長距離広域チャーム。',
      late3CorePlus: '集団戦での神出鬼没なマルチターゲットチャームと、味方への連続シールド/ヒール。',
    },
    favoredMatchups: [
      { enemy: 'Yuumi', reason: 'W飛び込みから一気にオールインし、レーンを崩壊させられる。' },
      { enemy: 'Sona', reason: 'ソナのUlt前にR-Wで拘束し、反撃を許さず倒せる。' },
      { enemy: 'Ashe', reason: 'アッシュの足の遅さを突き、長距離エンゲージで捕殺可能。' },
    ],
    hardMatchups: [
      { enemy: 'Thresh', counterPlay: 'ラカンのW飛び込みをスレッシュのEで中断されるため、敵Eが落ちてから入る。' },
      { enemy: 'Janna', counterPlay: 'ジャンナのQ竜巻で突進を止められるため、Rの魅了を先に当ててからWを使う。' },
      { enemy: 'Poppy', counterPlay: 'ポッピーのWで突進が弾かれるため、ポッピーの範囲外からエンゲージする。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】R（魅了）を発動した状態で敵を駆け抜けて魅了状態にし、その後に確実にW（ノックアップ）を重ねてください。',
  },

  // ----------------------------------------------------
  // 🌲 ジャングル (JUNGLE)
  // ----------------------------------------------------
  LeeSin: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2/Lv3でのQ（響掌/共鳴撃）+ W（防護/鉄の意志）による圧倒的序盤タイマン力とインベード。',
      mid1to2Core: '赤月 / 赤天完成時、ワードジャンプ + R（龍の怒り）フラッシュによる敵キャリーの味方側インセクキック。',
      late3CorePlus: '集団戦での敵フロントラインを蹴り飛ばして敵後衛を巻き込む広域ノックアップコンボ。',
    },
    favoredMatchups: [
      { enemy: 'Amumu', reason: '序盤の3キャンプ侵入でアムムをキルし、ジャングル内を完全に支配可能。' },
      { enemy: 'Karthus', reason: 'カーサスの薄い序盤耐久を突いて連続キルを奪取可能。' },
      { enemy: 'Sejuani', reason: '機動力と序盤ダメージ差でリバー主導権を完全掌握。' },
    ],
    hardMatchups: [
      { enemy: 'Nocturne', counterPlay: 'ノクターンのスペルシールドでQ2やRを無効化されるため、Eでシールドを剥がす。' },
      { enemy: 'Poppy', counterPlay: 'ポッピーのWでQ2突進を止められるため、Wが切れるまで距離を保つ。' },
      { enemy: 'Udyr', counterPlay: 'ウディアの高いタイマン耐久に殴り負けるため、ファーム勝負を避けガンクで差をつける。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】Qを当てても無謀に突っ込まず、Wワード離脱をセットで考えて安全にインセクキック（R）を決めてください。',
  },
  Viego: {
    powerSpikes: {
      earlyLvl1to5: 'Q（滅びの王剣）とW（霊の波濤）による高速クリアと、E（黒の霧）迷彩を利用したガンク。',
      mid1to2Core: 'クラーケンスレイヤー / トリニティフォース完成時、パッシブ（君主の支配）憑依連鎖による集団戦壊滅力。',
      late3CorePlus: '1体キルからの連続憑依 + R（痛魂の支配）リセットによる無敵・連続処刑無双。',
    },
    favoredMatchups: [
      { enemy: 'Sejuani', reason: 'セジュアニを憑依した際の高耐久CCと割合ダメージで集団戦を制圧。' },
      { enemy: 'Amumu', reason: '序盤タイマンで圧倒し、集団戦でもアムム憑依から広域Ultを再発動可能。' },
      { enemy: 'Zac', reason: 'ザックのパッシブ分裂体をQとAAで高速処理可能。' },
    ],
    hardMatchups: [
      { enemy: 'Rammus', counterPlay: 'ラムスのトゲ鎧とタウントで自滅するため、クラーケンより前に防御貫通を積む。' },
      { enemy: 'Nocturne', counterPlay: '暗転からのタイマンで押し切られるため、Eの霧の中で味方合流を待つ。' },
      { enemy: 'KhaZix', counterPlay: '孤立Qのバーストで憑依前に即死するため、味方と固まって行動する。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】集団戦で真っ先に突っ込まず、味方が削った「瀕死の敵」を最初にキルして即座に憑依し、無敵時間でリセットを繋げてください。',
  },
  Nocturne: {
    powerSpikes: {
      earlyLvl1to5: 'Q（黄昏の襲撃）攻撃力バフとWスペルシールドによる高速フルクリア。E（底知れぬ恐怖）確定恐怖。',
      mid1to2Core: 'ストライドブレイカー / ヘクスプレート完成時、Lv6以降のR（パラノイア）暗転からの確定キルガンク。',
      late3CorePlus: '視界外からのR暗転による敵孤立キャリーのピンポイント暗殺と、ストライド広域スロー。',
    },
    favoredMatchups: [
      { enemy: 'Karthus', reason: 'カーサスのUltをWスペルシールドで無効化し、R暗転で確実に処刑可能。' },
      { enemy: 'Shyvana', reason: 'シヴァーナのLv6前にRで各レーンを破壊し、ゲームを終わらせられる。' },
      { enemy: 'Lillia', reason: 'リリアのR睡眠をWシールドで防ぎ、暗転急襲で瞬殺可能。' },
    ],
    hardMatchups: [
      { enemy: 'Rammus', counterPlay: '突進をタウントで止められ反射ダメで削られるため、ラムス以外にRを撃つ。' },
      { enemy: 'Jax', counterPlay: 'ジャックスのEカウンターストライクで通常攻撃が無効化されるため、Eが落ちてから入る。' },
      { enemy: 'Sejuani', counterPlay: '高い耐久とCCで耐えられるため、敵後衛メイジ/ADCを狙う。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】R（パラノイア）が上がるたびに確実にキルが取れるレーン（特にBOT）へ飛び込み、CD中は効率的にフルクリアを回してください。',
  },
  Shyvana: {
    powerSpikes: {
      earlyLvl1to5: '序盤はタイマンを避け、Q-Wの高速ジャングルクリアで最速Lv6を目指す。',
      mid1to2Core: 'ショウジン/サンファイア完成時、Lv6ドラゴンフォーム（R）での大ダメージ強化Eブレスとオブジェクトバースト。',
      late3CorePlus: '集団戦前の強化Eポークで敵HPを削り、ドラゴンフォーム変身（R）で前線を焼き尽くす。',
    },
    favoredMatchups: [
      { enemy: 'Amumu', reason: 'ファーム速度差と序盤のカウンタージャングルで圧倒し、ドラゴンを独占可能。' },
      { enemy: 'Sejuani', reason: '高いDPSと機動力で接近を拒絶し、リバー主導権を奪取可能。' },
      { enemy: 'Zac', reason: 'ザックの序盤ガンクをカウンターし、ファーム差でレベルリードを広げられる。' },
    ],
    hardMatchups: [
      { enemy: 'Nocturne', counterPlay: 'ノクターンのUlt暗転時は味方と固まり、怒りゲージが溜まるまで無理なタイマンを避ける。' },
      { enemy: 'XinZhao', counterPlay: '序盤の3キャンプ侵入を警戒し、逆サイドフルクリアで安全にLv6を目指す。' },
      { enemy: 'Graves', counterPlay: '煙幕とカイトで引き撃ちされるため、狭いジャングル内でドラゴンフォームEを当てる。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】怒りゲージが最大でない時は集団戦を避け、ファームで素早く怒りを溜めてドラゴンフォーム（R）を確定させてから仕掛けてください。',
  },
  Zyra: {
    powerSpikes: {
      earlyLvl1to5: '種（W）+ Q/Eによる超高速ジャングルフルクリアと、リバーへの種視界設置によるガンク察知。',
      mid1to2Core: 'ライアンドリー/シャドウフレイム完成時、チョークポイントでのEスネア + R（絞首の蔓）の壊滅的ゾーン展開。',
      late3CorePlus: '視界のないブッシュからのアンブッシュワンコンボと、バロン・ドラゴン前の植物トラップ網。',
    },
    favoredMatchups: [
      { enemy: 'Sejuani', reason: '植物でスキルショットを遮断し、遠距離からの割合ダメージで接近を完封。' },
      { enemy: 'Amumu', reason: '包帯を植物でブロックし、ファーム速度差とポークで圧倒。' },
      { enemy: 'Rammus', reason: 'ラムスのパワーボールを植物で止め、魔法ダメージで防具を貫通。' },
    ],
    hardMatchups: [
      { enemy: 'Nocturne', counterPlay: 'ノクターンのR暗転時に即座に足元へE+Rを置き、ゾーニャの砂時計を早期購入する。' },
      { enemy: 'KhaZix', counterPlay: '単独行動を徹底的に避け、植物で孤立判定を消しながら味方と進軍する。' },
      { enemy: 'LeeSin', counterPlay: 'リー・シンのQ1直撃に植物を盾として挟み、飛び込みを拒否する。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】視界のないブッシュへのフェイスチェックを絶対に避け、必ずW種とQで安全確認を行ってください。',
  },
  JarvanIV: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2先行でのE（デマーシアの旗）+ Q（ドラゴンストライク）ノックアップガンク。パッシブ割合ダメージ。',
      mid1to2Core: '赤月 / ショウジン完成時、EQフラッシュ + R（天変地異）による敵フラッシュ強要と囲い込み。',
      late3CorePlus: '集団戦での敵バックライン拘束と、味方メイジ・ADCの範囲スキルとの黄金コンボ。',
    },
    favoredMatchups: [
      { enemy: 'Karthus', reason: 'R天変地異で閉じ込め、フラッシュのないカーサスを確定キル。' },
      { enemy: 'Lillia', reason: 'リリアの足の速さをRの壁で封じ、EQコンボで瞬殺。' },
      { enemy: 'Kindred', reason: 'キンドレッドのUlt発動中にEQで弾き出し、処刑可能。' },
    ],
    hardMatchups: [
      { enemy: 'Poppy', counterPlay: 'ポッピーのWでEQ突進が弾かれるため、ポッピーのWが落ちてから入る。' },
      { enemy: 'Viego', counterPlay: 'Rで閉じ込めた後にタイマンで削り負けるため、味方と一緒にフォーカスする。' },
      { enemy: 'Nocturne', counterPlay: 'WシールドでEQノックアップを防がれるため、Wを剥がしてから仕掛ける。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】Lv2/Lv3でフラッシュを持たないレーン（MIDやBOT）へ即座にEQガンクを仕掛け、序盤からスノーボールしてください。',
  },
  Lillia: {
    powerSpikes: {
      earlyLvl1to5: 'Q移動速度スタックを維持した高速フルクリアと、カウンターガンク。',
      mid1to2Core: 'ライアンドリー + リフトメーカー完成時、E遠距離ヒットからの広域R（子守唄）集団眠り。',
      late3CorePlus: '圧倒的な移動速度でのスキル回避と、集団戦全体への持続割合ダメージ。',
    },
    favoredMatchups: [
      { enemy: 'Skarner', reason: '移動速度で引き撃ちし、スカーナーの接近を完全に拒絶可能。' },
      { enemy: 'Sejuani', reason: 'セジュアニのCCを移動速度で回避し、割合ダメージで溶かす。' },
      { enemy: 'Amumu', reason: 'アムムの包帯を避けながらQで削り、集団戦Rで上書き可能。' },
    ],
    hardMatchups: [
      { enemy: 'Nocturne', counterPlay: 'ノクターンのスペルシールドでR睡眠を防がれるため、Qでシールドを剥がしてからRを押す。' },
      { enemy: 'LeeSin', counterPlay: '序盤のQ1直撃からの侵入を警戒し、視界を確保してタイマンを避ける。' },
      { enemy: 'KhaZix', counterPlay: '孤立状態で即死しないよう、味方キャンプ側でファームする。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】Qの外周ヒット（確定ダメージ）を常に狙い、スタックが切れる前に次のキャンプや敵に触れる意識を持ってください。',
  },
  XinZhao: {
    powerSpikes: {
      earlyLvl1to5: 'Lv2/Lv3でのE（無双突撃）+ Q（三爪撃）3連撃ノックアップによる最強クラスの序盤タイマン力。',
      mid1to2Core: '赤天 / タイタンハイドラ完成時、R（三日月の一閃）遠距離無敵フィールドを展開した集団戦前線突破。',
      late3CorePlus: '敵主要キャリーへのダイブと、R遠距離防御による敵ADC/メイジの攻撃遮断。',
    },
    favoredMatchups: [
      { enemy: 'Karthus', reason: '序盤インベードで完封し、カーサスのUltもRの範囲外無敵で遮断可能。' },
      { enemy: 'Shyvana', reason: 'シヴァーナのLv6前にジャングル内を荒らし尽くしてゲームを崩壊させられる。' },
      { enemy: 'Amumu', reason: '序盤タイマンで圧倒し、アムムのガンクをカウンター可能。' },
    ],
    hardMatchups: [
      { enemy: 'Jax', counterPlay: 'ジャックスのEで三爪撃（Q）が全て無効化されるため、E使用中はE突進しない。' },
      { enemy: 'Rammus', counterPlay: '反射ダメージで自滅するため、防具貫通と魔法耐性を揃える。' },
      { enemy: 'Poppy', counterPlay: 'E突進をポッピーのWで止められるため、ポッピーを避けてガンクする。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】序盤3キャンプクリア後に躊躇せずガンクまたは敵ジャングル侵入を行い、最初の5分で試合の主導権を握ってください。',
  },

  // ----------------------------------------------------
  // 🏹 ボット・ADC (BOTTOM / ADC)
  // ----------------------------------------------------
  Jinx: {
    powerSpikes: {
      earlyLvl1to5: 'Q（スイッチ！）ロケットランチャーでの遠距離ハラスと、E（パックンチョッパー）での味方CC合わせ。',
      mid1to2Core: 'クラーケンスレイヤー / ルーナンハリケーン完成時、R（超究極死のロケット！）でのマップ全体キルスナイプ。',
      late3CorePlus: '集団戦で1キル/アシスト獲得時のパッシブ（超エキサイト！）超加速による敵全滅スノーボール。',
    },
    favoredMatchups: [
      { enemy: 'Aphelios', reason: '超長射程ロケットで安全圏からアフェリオスを圧倒可能。' },
      { enemy: 'Zeri', reason: '射程差とパッシブ超エキサイトの機動力でゼリを完封。' },
      { enemy: 'Kai\'Sa', reason: '序盤の射程差でカイ＝サをレーンから追い出し主導権を獲得。' },
    ],
    hardMatchups: [
      { enemy: 'Draven', counterPlay: '序盤の殴り合いを徹底拒否し、タワー下でCSを拾って中盤以降にスケールする。' },
      { enemy: 'Samira', counterPlay: 'サミラのWでロケットやチョッパーが消されるため、味方のCC後にスキルを使う。' },
      { enemy: 'Lucian', counterPlay: 'ルシアンの序盤ダッシュバーストを避け、ロングレンジでファームする。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】単独で視界のないサイドレーンに行かず、常に味方サポートの後ろからロケット（Q）で最も近い敵を攻撃してください。',
  },
  KaiSa: {
    powerSpikes: {
      earlyLvl1to5: 'Q（イケイケミサイル）単体ヒットバーストと、W（虚空の索敵）プラズマスタック蓄積。',
      mid1to2Core: 'クラーケン + ナッシャートゥースによるQ・W・E全スキル進化達成時の圧倒的タイマン＆暗殺力。',
      late3CorePlus: '長距離WヒットからのR（キラーインスティンクト）長距離シールド突進による敵バックライン強襲。',
    },
    favoredMatchups: [
      { enemy: 'Ezreal', reason: 'エズリアルのQをミニオンで避けつつ、R突進からの近接バーストで瞬殺。' },
      { enemy: 'Vayne', reason: 'Qの爆発的バーストとE透明化でヴェインのタイマンを圧倒。' },
      { enemy: 'Sivir', reason: 'シヴィアのスペルシールドをQで剥がし、Wとパッシブでキル奪取。' },
    ],
    hardMatchups: [
      { enemy: 'Caitlyn', counterPlay: '圧倒的射程差で削られるため、Lv6まで耐えて味方のCCからRで飛び込む。' },
      { enemy: 'Draven', counterPlay: '序盤の殴り合いで即死するため、ショートトレードに留めてガンクを待つ。' },
      { enemy: 'Ashe', counterPlay: 'アッシュの長射程スローとRスタンをクレンズまたはフラッシュで回避する。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】最速でQ進化（AD100）とE進化（攻撃速度100%）を完成させ、味方のCCにRで即座に合わせる判断を磨いてください。',
  },
  Ezreal: {
    powerSpikes: {
      earlyLvl1to5: 'Q（秘術の射撃）ポークとパッシブ攻撃速度スタック。E（アーケインシフト）による絶対的ブリンク生存力。',
      mid1to2Core: 'トリニティフォース + マナムネ（ムラマナ完成時）の壊滅的ポーク火力とオブジェクト前制圧力。',
      late3CorePlus: 'セリルダの怨恨完成による遠距離無限スローポークと、R（トゥルーショットバラージ）によるウェーブクリア。',
    },
    favoredMatchups: [
      { enemy: 'Jhin', reason: 'ジンの4発目トレードをEで拒否し、長射程Qで一方的に削れる。' },
      { enemy: 'Varus', reason: 'ヴァルスのUltやQをEアーケインシフトで軽々回避可能。' },
      { enemy: 'Aphelios', reason: 'アフェリオスの武器切り替えタイミングを突いて遠距離からポーク。' },
    ],
    hardMatchups: [
      { enemy: 'Draven', counterPlay: 'ドレイブンの序盤オールインに耐えられないため、タワー下でQファームに徹する。' },
      { enemy: 'Tristana', counterPlay: 'トリスターナのWジャンプインからのバーストをEで即座に離脱して拒否。' },
      { enemy: 'Samira', counterPlay: 'サミラのWでQやRが消されるため、W使用後にスキルを叩き込む。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】E（ブリンク）を攻撃用に前方に使わず、敵のガンクやエンゲージを回避する「命綱」として温存してください。',
  },

  // ----------------------------------------------------
  // 🧙 ミッド (MID)
  // ----------------------------------------------------
  Ahri: {
    powerSpikes: {
      earlyLvl1to5: 'Q（幻惑の宝玉）によるプッシュと確定ダメージ、E（チャーム）によるガンク合わせ。',
      mid1to2Core: 'ルーデン / マリス完成時、R（スピリットラッシュ）3段ブリンクによる超高機動ロームと暗殺。',
      late3CorePlus: '集団戦でのRキルリセットによる無限機動力と、敵主力へのフラッシュEキャッチ。',
    },
    favoredMatchups: [
      { enemy: 'Twisted Fate', reason: 'TFのロームをR追従で阻止し、Eチャームで容易にソロキル可能。' },
      { enemy: 'Veigar', reason: 'ベイガーのイベントホライズンをRブリンクで飛び越えて瞬殺可能。' },
      { enemy: 'Lux', reason: 'ラックスのスキルをRで全て回避しながら接近してワンコンボ。' },
    ],
    hardMatchups: [
      { enemy: 'Yasuo', counterPlay: '風の壁でチャームも宝玉も消されるため、風の壁を撃たせてからRで仕掛ける。' },
      { enemy: 'Zed', counterPlay: 'ゼドのR着地位置（自身の背後）に即座にEチャームを置き、ゾーニャを積む。' },
      { enemy: 'Syndra', counterPlay: 'シンドラのEスタン射程外をキープし、Rが上がるまで耐える。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】ウェーブをQで素早く押し込んだら、MIDに留まらずRを使ってBOTやTOPへ積極的にロームしてください。',
  },
  Zed: {
    powerSpikes: {
      earlyLvl1to5: 'W（生ける影）+ E + Q手裏剣による遠距離電撃トレードと、エナジー管理。',
      mid1to2Core: '妖夢 / プロフェンハイドラ完成時、R（死の刻印）による敵メイジ/ADCの確定ワンコンボ暗殺。',
      late3CorePlus: 'サイドレーンでのスプリットプッシュと、影の位置交換を利用した神出鬼没の集団戦撹乱。',
    },
    favoredMatchups: [
      { enemy: 'Veigar', reason: 'ベイガーの檻をWやRで無視して飛び込み、一瞬で消滅させられる。' },
      { enemy: 'Lux', reason: 'ラックスのQを影で回避し、R刻印で確実にキル可能。' },
      { enemy: 'Aurelion Sol', reason: 'オレリオン・ソルの飛行やブレスを影で翻弄しソロキル連発。' },
    ],
    hardMatchups: [
      { enemy: 'Lissandra', counterPlay: 'リサンドラのR自己凍結やW拘束で完封されるため、他レーンへロームする。' },
      { enemy: 'Malzahar', counterPlay: 'マルザハールのR抑圧で影に戻れず即死するため、シルバーサッシュを早期購入。' },
      { enemy: 'Zhonya Users', counterPlay: '敵がゾーニャを使った直後に手裏剣を重ねて処刑する。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】R（死の刻印）で入った後、敵のCCが飛んでくる前にR再発動で元の影に戻る冷静な位置把握を徹底してください。',
  },

  // ----------------------------------------------------
  // 🛡️ トップ (TOP)
  // ----------------------------------------------------
  Darius: {
    powerSpikes: {
      earlyLvl1to5: 'ゴースト発動からのW（重傷）スロー + Q外周ヒール + パッシブ5スタック（紅血の激昂）でのLv1〜3キル。',
      mid1to2Core: 'ストライドブレイカー / トリニティフォース完成時、ストライドスロー + E（捕縛）による確定拘束。',
      late3CorePlus: '集団戦で1体をR（ノクサスギロチン）で処刑した後の5スタック全体拡散・ギロチン連鎖。',
    },
    favoredMatchups: [
      { enemy: 'Sion', reason: 'サイオンのQタメ中にEで引き寄せ、5スタックで一方的にレーン粉砕。' },
      { enemy: 'Cho\'Gath', reason: 'チョ＝ガスの耐久力を5スタックの出血割合で削り切り完封。' },
      { enemy: 'Malphite', reason: 'マルファイトのアーマーを出血魔法ダメージとEの割合防御貫通で貫通。' },
    ],
    hardMatchups: [
      { enemy: 'Vayne', counterPlay: 'ヴェインのEノックバックで近づけないため、ゴーストとフラッシュがある時のみ仕掛ける。' },
      { enemy: 'Quinn', counterPlay: 'クインのE宙返りで距離を取られるため、ブッシュ視界を使って奇襲する。' },
      { enemy: 'Fiora', counterPlay: 'フィオラのWパリィでEやWを弾かれるため、パリィを見てからスキルを当てる。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】Qの内周（柄）で当てるとヒールもスタックも入らないため、必ず外周（刃）を当てる距離感を身体に染み込ませてください。',
  },
  Aatrox: {
    powerSpikes: {
      earlyLvl1to5: 'Q（ダーキンブレード）3段先端ヒットと、W（滅びの鎖）引き戻しによる圧倒的レーントレード。',
      mid1to2Core: 'ショウジン / サンダードスカイ完成時、R（世界の終わり）発動による超回復と集団戦フロントライン破壊。',
      late3CorePlus: '集団戦でのRキル延長による無限サステインと、敵バックラインへのQ3フラッシュ強襲。',
    },
    favoredMatchups: [
      { enemy: 'Sion', reason: 'サイオンのQモーションにAatroxのQノックアップを重ねて完全無力化。' },
      { enemy: 'Gwen', reason: 'グウェンの霧の外からQ1・Q2ポークで削り、接近を拒絶。' },
      { enemy: 'Nasus', reason: 'ナサスの序盤スタックをフリーズとQハラスで完封し腐らせる。' },
    ],
    hardMatchups: [
      { enemy: 'Irelia', counterPlay: 'イレリアのQ高速ブリンクでQ先端を外されるため、スタックがない時に戦う。' },
      { enemy: 'Fiora', counterPlay: 'Q3の着地にフィオラのWパリィを合わせられてスタンするため、Q3をフェイントする。' },
      { enemy: 'Kled', counterPlay: 'クレッドの重傷Qと超攻撃力に殴り負けるため、Eで距離を取る。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】E（影進）はQの射程調整用として同時に使い、Q1先端・Q2先端・Q3中心を確実に敵に当ててください。',
  },
  Renekton: {
    powerSpikes: {
      earlyLvl1to5: '怒り50%時のW（メッタ斬り）強化スタン + Q（甘美なる旋風）大回復 + E（エリス）離脱のノーリスクトレード。',
      mid1to2Core: 'ショウジン / 赤天完成時、R（ドミナス）HP増加とタワーダイブでのゲーム早期破壊。',
      late3CorePlus: '敵キャリーへのフラッシュ強化Wスタン（シールド即破壊）による瞬殺。',
    },
    favoredMatchups: [
      { enemy: 'Yasuo', reason: 'ヤスオのシールドを強化Wで即破壊し、そのままフルコンボで瞬殺可能。' },
      { enemy: 'Irelia', reason: 'イレリアの飛び込みに強化Wスタンを叩き込み、トレード完勝。' },
      { enemy: 'Riven', reason: 'リベンのシールドを破壊してスタンさせ、一方的に有利トレード。' },
    ],
    hardMatchups: [
      { enemy: 'Illaoi', counterPlay: 'イラオイのE触手引き抜きを食らうとトレード負けするため、ミニオン裏をキープ。' },
      { enemy: 'Quinn', counterPlay: 'クインの遠距離ハラスとE宙返りで近づけないため、ガンクを待つ。' },
      { enemy: 'Gangplank', counterPlay: 'GPのオレンジ（W）でスタンを即解除されるため、オレンジ使用後に仕掛ける。' },
    ],
    tacticsGuide: '【エメラルド到達の鍵】怒りゲージが50%未満の時は無理に仕掛けず、ミニオンをQで殴って怒りを50%溜めてから強化Wでトレードしてください。',
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
  const isBot = role === 'BOTTOM' || role === 'BOT' || role === 'ADC';

  if (isSup) {
    return {
      powerSpikes: {
        earlyLvl1to5: `${champName}のスキルを活かしたLv2先行ハラス/エンゲージと、リバーへの先制視界設置。`,
        mid1to2Core: `1コア完成時のロームと、ドラゴン湧き60秒前のピンクワードを用いた視界奪取。`,
        late3CorePlus: `集団戦での味方キャリーへのピール防衛と、敵キャリーへの妨害CCチェーン。`,
      },
      favoredMatchups: [], // 未登録チャンピオンに架空の対面を出さない(2026-09-22)
      hardMatchups: [], // 未登録チャンピオンに架空の対面を出さない(2026-09-22)
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
      favoredMatchups: [], // 未登録チャンピオンに架空の対面を出さない(2026-09-22)
      hardMatchups: [], // 未登録チャンピオンに架空の対面を出さない(2026-09-22)
      tacticsGuide: `【エメラルド到達の鍵】${champName}のパワースパイクに合わせてオブジェクト主導権を取り、味方レーンをスノーボールさせてください。`,
    };
  }

  if (isBot) {
    return {
      powerSpikes: {
        earlyLvl1to5: `${champName}のスキルを活かした序盤CS回収と、Lv2先行ショートトレード。`,
        mid1to2Core: `1〜2コア完成時のパワースパイクと、味方サポートとのフォーカス集中。`,
        late3CorePlus: `集団戦での最後尾ポジショニングと、敵前衛からの確実なDPS出力。`,
      },
      favoredMatchups: [], // 未登録チャンピオンに架空の対面を出さない(2026-09-22)
      hardMatchups: [], // 未登録チャンピオンに架空の対面を出さない(2026-09-22)
      tacticsGuide: `【エメラルド到達の鍵】単独ファームでのデスを徹底的に防ぎ、味方と共に行動してダメージを出し続けてください。`,
    };
  }

  if (isMid) {
    return {
      powerSpikes: {
        earlyLvl1to5: `${champName}のスキルを活かした序盤ウェーブプッシュと、ローム視界の確保。`,
        mid1to2Core: `1〜2コア完成時のバーストダメージと、サイドレーン介入。`,
        late3CorePlus: `集団戦での敵バックラインフォーカスと、チョークポイントでのゾーン管理。`,
      },
      favoredMatchups: [], // 未登録チャンピオンに架空の対面を出さない(2026-09-22)
      hardMatchups: [], // 未登録チャンピオンに架空の対面を出さない(2026-09-22)
      tacticsGuide: `【エメラルド到達の鍵】${champName}のパワースパイクを活かしてサイドレーンへ影響力を広げてください。`,
    };
  }

  return {
    powerSpikes: {
      earlyLvl1to5: `${champName}のスキルを活かした序盤ウェーブ管理と、タイマン主導権。`,
      mid1to2Core: `1〜2コア完成時のスプリットプッシュ圧力と、TP合流。`,
      late3CorePlus: `集団戦でのフロントライン維持と、敵キャリーへのエンゲージ。`,
    },
    favoredMatchups: [], // 未登録チャンピオンに架空の対面を出さない(2026-09-22)
    hardMatchups: [], // 未登録チャンピオンに架空の対面を出さない(2026-09-22)
    tacticsGuide: `【エメラルド到達の鍵】${champName}の強みであるサイドプッシュとTPタイミングを極めてください。`,
  };
}
