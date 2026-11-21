import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { callHybridLlm } from '@/lib/ollamaClient';
import { normalizeChampionName } from '@/lib/championNames';

/**
 * SPEC 10: AIコーチ回答のバリデーションとサニタイズ
 * - 未記入プレースホルダー（「約何秒」「○○」「XX」等）の自動補正・除去
 * - 中国語誤訳スキル名の Riot 公式日本語名への自動補正（例: 「突っ向勝負」➔「真っ向勝負」）
 * - 意味不明語（「信長値」➔「射程」等）のサニタイズ
 */
function validateAndSanitizeCoachAnswer(text: string): string {
  if (!text) return text;
  let s = text;

  // 1. スキル名・用語の既知の誤訳・文字化け辞書補正
  const TERM_FIXES: [RegExp, string][] = [
    [/突っ?向勝負/g, '真っ向勝負'], // Vi Q (Vault Breaker)
    [/突進パンチ/g, '真っ向勝負(Q)'],
    [/通常攻撃の信長値/g, '通常攻撃の射程・リーチ'],
    [/信長値/g, '射程・リーチ'],
    [/闪く/g, '光る'],
    [/チーク/g, 'トレード'],
  ];
  for (const [pattern, replacement] of TERM_FIXES) {
    s = s.replace(pattern, replacement);
  }

  // 2. 未記入プレースホルダーの除去・補正（長いパターンを先行置換）
  s = s.replace(/【約何秒】/g, '【数秒間】');
  s = s.replace(/約何秒/g, '状況に応じた秒数');
  s = s.replace(/[○◯]{2,}/g, '主要スキル');
  s = s.replace(/X{2,}/g, '敵スキル');
  s = s.replace(/△{2,}/g, '状況');
  s = s.replace(/\[未定\]/g, '適宜判断');

  return s.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      myChampion = 'Darius',
      enemyChampion = 'Aatrox',
      lane = 'TOP',
      question = '',
      history = [],
    } = body;

    const trimmedQuestion = String(question || '').trim();
    if (!trimmedQuestion) {
      return NextResponse.json({ error: '質問を入力してください' }, { status: 400 });
    }

    // 1. データベースから自チャンプ＆対面の根拠データを取得
    const sources: string[] = [];
    let myFactsText = '';
    let enemyFactsText = '';
    let matchupMemoText = '';

    if (supabase) {
      try {
        const { data: myData } = await supabase
          .from('champion_facts')
          .select('weaknesses, counter_champions, powerspikes, builds, patch')
          .eq('champion', myChampion)
          .maybeSingle();

        if (myData) {
          sources.push(`${myChampion} 辞典データ (Patch ${myData.patch || '現行'})`);
          const parts = [];
          if (myData.weaknesses) parts.push(`【弱み・隙】\n${myData.weaknesses}`);
          if (myData.counter_champions) parts.push(`【苦手な相手】\n${myData.counter_champions}`);
          if (myData.powerspikes) parts.push(`【パワースパイク】\n${myData.powerspikes}`);
          myFactsText = parts.join('\n\n');
        }

        const { data: enemyData } = await supabase
          .from('champion_facts')
          .select('weaknesses, counter_champions, patch')
          .eq('champion', enemyChampion)
          .maybeSingle();

        if (enemyData) {
          sources.push(`${enemyChampion} 辞典データ`);
          if (enemyData.weaknesses) {
            enemyFactsText = `【敵の弱み・隙】\n${enemyData.weaknesses}`;
          }
        }

        const { data: sentinel } = await supabase
          .from('matchup_sentinel')
          .select('strategy')
          .eq('champion', myChampion)
          .eq('enemy', enemyChampion)
          .not('strategy', 'is', null)
          .maybeSingle();

        if (sentinel?.strategy) {
          sources.push(`vs ${enemyChampion} 特化戦術メモ`);
          matchupMemoText = `【実戦対面メモ】\n${sentinel.strategy}`;
        }
      } catch (dbErr) {
        console.warn('[Coach Ask] DBデータ取得失敗（LLM単体で回答します）:', dbErr);
      }
    }

    if (sources.length === 0) {
      sources.push('LoL一般戦術理論 ＆ スキル仕様データ');
    }
    sources.push('LoL体系化戦術基準(ターン同期・ウェーブ制御・損益計算)');

    // 2. システムプロンプトの構築
    const contextInfo = [
      `【コンテキスト】`,
      `- 自チャンピオン: ${myChampion}`,
      `- 対面相手: ${enemyChampion}`,
      `- レーン: ${lane}`,
      myFactsText ? `\n【自チャンプ(${myChampion})の正本データ】\n${myFactsText}` : '',
      enemyFactsText ? `\n【敵チャンプ(${enemyChampion})の正本データ】\n${enemyFactsText}` : '',
      matchupMemoText ? `\n【実戦対面メモ(vs ${enemyChampion})】\n${matchupMemoText}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `
あなたはLeague of Legendsの超一流AI戦術コーチです。
プレイヤーからの対面や戦術に関する質問に対して、論理的で具体的、かつ即座に実戦で試せるアドバイスを日本語で返してください。

${contextInfo}

【過去のチャット文脈】
${Array.isArray(history) && history.length > 0
  ? history.slice(-4).map((h: any) => `${h.role === 'user' ? 'プレイヤー' : 'コーチ'}: ${h.content}`).join('\n')
  : '（過去のやりとりなし）'}

【プレイヤーからの質問】
${trimmedQuestion}

【回答のルール】
1. 曖昧な抽象論（「頑張ってCSを取りましょう」等）ではなく、スキルの当て方、CDの隙、ウェーブ管理、初動3分やLv6のキルラインなど、具体的なアクションを提示すること。
2. 今回参照した正本データや対面メモがある場合は、「${sources.join(' / ')}」に基づいた根拠を一言添えること。
3. 文体は親しみやすく頼れるコーチ口調（「〜しよう」「〜がポイントだ」等）にすること。
4. 長すぎず、試合前に30秒で読める簡潔な構成（箇条書き2〜3点＋要約）にすること。
5. 【厳格】スキル名はRiot公式の正式日本語名（例: ViのQは「真っ向勝負」、Rは「強行突入」）を用い、中国語や不正確な訳語を使用しないこと。
6. 【厳格】「約何秒」「○○」などの未記入プレースホルダーは絶対に出力せず、具体的な秒数（例: 約8秒）または「スキルの空振り直後」などの具体的な状況を明記すること。
7. 【論理検証】Q（チャージ突進）とR（確定突入）など、異なるスキルの効果や仕様を混同・混線させないこと。
8. 【定量的思考原則（参考資料ライブラリより活用）】:
   - 先出し判断（D1）: 先出しはロールではなくチャンピオンのブラインド耐性で判断する。
   - ターン同期（D4）: 有利トレードやプッシュ後は居座らず、味方とリコールテンポ（ターン）を同期させる。
   - 序盤ダイブ基準（D59）: 序盤のタワーダイブは「3ウェーブ（約15体）を溜めて3:15前後にタワーへ押し込む」具体的目安を持つ。
   - ローム損益分岐点（D62）: 無計画なロームはタワープレートやウェーブ損を招き、アシスト1個では赤字になるため慎重に判断する。
   - リコールゴールド管理（D66）: 500Gや2000Gの抱え落ちを防ぎ、パワースパイク素材の金額に合わせてリコールする。
   - デス分析の視点（D42）: デスの瞬間ではなく「30秒前の判断・ウェーブ管理の歪み」に根本原因がある視点を持つ。
   - フリーズ形成基準（D54）: フリーズは「後衛ミニオンを4体残す」ことで永続化し、不利時ではなく有利時に相手を詰ませるために使う。
   - バロン判断（D17）: バロン開始は人数有利・敵JG位置確定・視界優位・DPS確保の4条件を満たした時のみ。敵接近時は無理に急がず視界を消して反転（釣り）を優先する。
   - 敵3ドラ時のレバレッジ（D28）: 相手の3ドラ目はパニックにならず、相手が寄る隙を突いて逆サイドのタワー2本やインヒビターへ逆転のレバレッジをかける。
   - 抑制器の破壊タイミング（D37）: 20分前後の安易な単独インヒビター破壊は相手に無料ゴールドを与えるため、バロンや別レーン包囲と連動して圧殺できる時のみ折る。
   - JGの優先順位と絶対基準（D57, D68）: ファーム（分間7CS目標）➔ オブジェクト ➔ レーン先行 ➔ ガンク圧の順位を崩さない。不用意な歩き回りでファームを落とさない。
   - 劣勢JGの逆転判断原則（D111 HALdesu）: 劣勢時は自陣バフ入口の防衛視界（コントロールワード）をJGが最大責任で維持。安全ファーム（空きレーン ＞ 自陣JG ＞ 敵逆サイド）を徹底し、序盤は無理なドラゴンを捨てプレートやヘラルドでゴールド差を埋め、終盤はエルダーを最優先。集団戦はタンクならピール、アサシンなら孤立ピック、ビルドは敵キャリーに合わせた防衛装備や騎士の誓い/ソラリへ柔軟にスイッチする。
   - ザイラJG最速周回＆交戦ポジショニング（D108 天狐ハク）: 1:28湧きに対し0:55にブッシュを出て種を配置し、1:26に植物召喚することで種パッシブとQの周期を完全同期させ2分53秒フルクリアを達成。初動はインベード警戒ワード後に即赤レンズ購入で最速レーン主導権を確保。集団戦は植物召喚後「引き➔横➔前」の3段ポジショニングで敵ダイブをスカしつつ蓄積ダメージで圧殺する。
   - ザイラJGの必殺キルコンボ＆ルーン換装（D74 BLG Sungod）: 必殺コンボは「E ➔ Flash ➔ W W Q R」。Eの発生フレーム中にフラッシュし、敵の足元に植物2本を生やしてQとRで瞬時に確定打ち上げ・バーストを叩き込む。序盤の2v2やレーン戦主導権を狙う場合は「魂の収穫」から「電撃」へルーン換装する。暗闇（フォグ・オブ・ウォー）からの待ち伏せが最大の強み。
   - JGアイテム購入原則（D47）: 最初の2コア完成まではコントロールワード（75G）を安易に買わずパワースパイクを最優先。素材は攻撃力より「ルビー クリスタル（HP素材）」を優先（HPは最効率ステータスかつJGペットのダメージが自身の増加HPでスケールし周回速度が向上）。
   - スキル仕様の盲点カウンター（D50）: J4のEQはスネアや釘付け中でも発動可能（モルガナ・ラックスQを無効化して突撃）。ヴェックスRはダッシュ中のみアンストッパブルで着地時はCCが通る。デスダンスのDoT変換は敵のダメージ連動回復（エイトロックスや赤ケイン等）を実質30%阻害する。
    - ドラゴン90秒前準備の鉄則（F1 LoL Guide）: ドラゴン出現90秒前にリコールして装備を更新し、1分前には川の視界を確保して敵の侵入経路を塞ぎ、ミッド・ボットをプッシュして主導権を握る。準備のないドラゴン戦はコインフリップ。
    - 中盤のアラム化脱却（F2 LoL Guide）: レーン戦終了後に5人全員でミッドに突っ立って経験値・ゴールドを溶かす悪癖を脱却。ADC+SUPがミッドを担当し、ソロレーナー（TOP/MID）がサイドを押してクロスプレイスプリットを展開する。
    - リコール即出撃のテンポ管理（F5 LoL Guide）: リコール詠唱中にショップを開いて購入アイテムを決め、ベース滞在時間を5秒以内にして出撃する。毎試合1〜2分のテンポ差を生み、寄りの速度で圧倒する。
    - ウィーク/ストロングサイドの厳守（F7 LoL Guide）: 味方JGのいない「ウィークサイド」の時は、レーン有利でもガンクを受ければ1v2で死ぬ。ウェーブを引いて耐えることがチーム全体の勝利貢献。
    - 有利時のスロー防止原則（F6 LoL Guide）: リード時は暗闇への孤立侵入や強引なバロンを禁止し、外側タワーから安全に削って敵視界を制圧し、リソース差で窒息させる。
    - バロンバフ獲得後のシージ（F11 LoL Guide）: 5人で1レーンに集まらず、1-3-1または1-4で複数レーンの強化ミニオンを同時に押し込み、敵の防衛を分散させてインヒビターを安全に折る。
    - JGのラプター処刑＆5:30スマイトタイマー（D114 Griffin）: 敵ラプタースタート時は蟹を無視して即リコールし、3:20-3:25の敵ラプター湧きを待ち伏せキルしてGGにする。2周目フルクリアの最後のキャンプを5:30（ボーナス餌タイミング）に合わせて狩ることで、2回目スカトル戦の瞬間に強化スマイトを完成させオブジェクトを確定奪取する。Lv1スカトルは最弱のため無理に争わず、敵の3キャンプ即ガンクには釣られずフルクリアを完遂して後続インベードでレベル差をつける。
    - Agurin流リニアクリア＆赤バフスキップ理論（D115 bonevoid/Agurin）: 従来の円形フルクリアに固執せず、目的地点（ガンク・インベード・オブジェクト）への経路上にあるキャンプだけを線（リニア）状に狩る。レーナーのウェーブ状況やダイブ好機、敵JGへの先手を最優先する場合、あえて赤バフや外れたキャンプをスキップして目的地へ直行し、圧倒的なテンポ差で盤面を制圧する。
    - JG上級編の鉄則（D96, D97 HALdesu）: 1v1で負けているレーン（0/2/0等）には原則ガンク厳禁。育った敵に2v1でも返り討ちダブルキルされるリスクが高いためカバー（ダイブ阻止）に留め、自分が勝たせた強いサイドと一緒に集団で対処する。タワーダイブの合図は巨大ウェーブがタワーにクラッシュした瞬間（キル＋大量ミニオン消失で敵を完全破壊）。味方の押し切りリコール時は森に潜んで敵ガンクから護衛する「カバー」を徹底する。自分が奪った敵キャンプの再湧き時間は自分だけの非公開情報であり、再湧き時間に合わせてブッシュ待ち伏せキルを仕掛ける。
    - ドラゴン10秒前バロン強襲（D84 天狐ハク）: 全レーン主導権なしの劣勢時、ドラゴン湧く10秒前に高DPSチャンプでバロンを触り始める。レーンに味方を露出させて「2人だけでバロンを狩れるはずがない」と錯覚させ、敵がドラゴンに寄る隙にバロンを強奪して逆転する。
    - リリアのプロトプラズムハーネス（D88 天狐ハク）: 1コア（リアンドリー）で火力は十分だが突進即死する弱点を、2コアハーネス（HP30%以下での回復＋テナシティ＋MS）で克服し、生存力とヘイストを最大化する。
    - J4の緑ルーン主軸（D83 DesLoverLoL）: J4は征服者スタックが遅いため征服者は非推奨。Wシールドの回転率と耐久力を高める不滅（緑）ルーンを主軸にする。
    - LS流チャンピオン・アイテム効率論（E20 LS）: 感覚的なおすすめではなくアイテムのゴールド効率とパワースパイクを重視し、過小評価されているビルドツリーやルーンの最適解を選択する。
    - ロテートとロームの厳格分離（D68 天狐ハク）: 先押しから確実なオブジェクト・川交戦に数的優位を作る「ロテート（確実な利他）」と、レーンを空けて他レーンへキルを狙いに行く「ローム（コインフリップ）」を混同しない。ウェーブを2体残してロームする行為は永久に主導権を失う自殺行為。
    - テンポの真の起点（D69 天狐ハク）: テンポを作るのはJGではなくレーンの「ウェーブ」。タワー下でミニオン処理中の味方にオブジェクト寄りを強要するのは確定デス。ジャングルとレーンは一つの機械。
`.trim();

    // 3. ハイブリッドLLM（ローカルOllama優先・Geminiフォールバック）で回答生成
    // 試合前チャットのためタイムアウトは15秒とし、ローカルOllamaがバッチ処理等で塞がっている場合は即座にGemini（約2.9秒）へフォールバック
    const rawAnswer = await callHybridLlm(prompt, {
      temperature: 0.3,
      timeoutMs: 15000,
    });

    // 4. SPEC 10: 回答文のノイズ除去・サニタイズ検証
    const answer = validateAndSanitizeCoachAnswer(rawAnswer);

    return NextResponse.json({
      success: true,
      answer,
      sources,
      myChampion,
      enemyChampion,
      lane,
    });
  } catch (error: any) {
    console.error('[Coach Ask Error]:', error);
    return NextResponse.json(
      { error: error.message || 'コーチへの質問回答中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
