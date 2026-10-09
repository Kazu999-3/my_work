

// ポータル登録（portal_register）と師弟制度（弟子/師匠の申込・弟子の引き受け）
// 2026-10-07: handlers/components.js（1,486行）のボタン処理から分割。処理は分割前と同じ（元の判定順のまま）。
/** 該当するボタンなら応答を返し、該当しなければ undefined（次の処理へ）を返す */
export async function handleRegistrationMentorshipButtons(interaction, env, ctx, { customId, userId, appId, token, botToken }) {
  // 🎛️ ポータル・ウェルカム用共通ボタンハンドラー
  if (customId === 'portal_register') {
    return Response.json({
      type: 9,
      data: {
        title: "🎮 サモナー名 ＆ 希望レーン一括登録",
        custom_id: "portal_register_modal",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "ign",
                label: "LoL サモナー名 (Riot ID: 名前#Tag)",
                style: 1,
                placeholder: "例: りくや#JP1 / Faker#KR1",
                required: true,
                max_length: 50
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "main",
                label: "メインレーン",
                style: 1,
                placeholder: "TOP / JG / MID / ADC / SUP / ALL",
                required: true,
                max_length: 10
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "sub",
                label: "サブレーン (2番目に得意なレーン)",
                style: 1,
                placeholder: "TOP / JG / MID / ADC / SUP / なし",
                required: false,
                max_length: 10
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "weight",
                label: "こだわり度 (1:絶対, 2:通常, 3:柔軟)",
                style: 1,
                placeholder: "1, 2, または 3 (未入力は2)",
                required: false,
                max_length: 2
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "ng1",
                label: "NGレーン (行きたくないレーン)",
                style: 1,
                placeholder: "TOP / JG / MID / ADC / SUP (未入力可)",
                required: false,
                max_length: 10
              }
            ]
          }
        ]
      }
    });
  }

  // 🎓 師弟マッチング：弟子登録モーダル
  if (customId === 'mentorship_apply_pupil') {
    return Response.json({
      type: 9,
      data: {
        title: "🌱 師弟マッチング：弟子入り登録 (修行希望)",
        custom_id: "mentorship_pupil_modal",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "lanes",
                label: "希望レーン (1つ選択)",
                style: 1,
                placeholder: "TOP / JG / MID / BOT / SUP のいずれか1つ",
                required: true,
                max_length: 10
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "target_rank",
                label: "目標ランク (目指したいランク)",
                style: 1,
                placeholder: "例: ゴールド / プラチナ / エメラルド",
                required: false,
                max_length: 20
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "champions",
                label: "練習したいチャンピオン (カンマ区切り)",
                style: 1,
                placeholder: "例: ヤスオ, ヨネ, アーリ",
                required: false,
                max_length: 50
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "bio",
                label: "学びたいこと・悩み・ひとこと意気込み",
                style: 2,
                placeholder: "例: CSの取り方やウェーブ管理を安定させたいです！週末夜に通話できます。",
                required: true,
                max_length: 500
              }
            ]
          }
        ]
      }
    });
  }

  // 🥋 師弟マッチング：師匠登録モーダル
  if (customId === 'mentorship_apply_mentor') {
    return Response.json({
      type: 9,
      data: {
        title: "🥋 師弟マッチング：師匠登録 (指導者)",
        custom_id: "mentorship_mentor_modal",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "lanes",
                label: "指導レーン (1つ選択)",
                style: 1,
                placeholder: "TOP / JG / MID / BOT / SUP のいずれか1つ",
                required: true,
                max_length: 10
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "champions",
                label: "得意チャンピオン (カンマ区切り)",
                style: 1,
                placeholder: "例: リー・シン, ジャルヴァンIV, ザック",
                required: false,
                max_length: 50
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "active_hours",
                label: "活動・指導可能時間帯",
                style: 1,
                placeholder: "例: 平日21:00〜24:00 / 週末",
                required: false,
                max_length: 50
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "bio",
                label: "指導方針・アドバイスできる内容",
                style: 2,
                placeholder: "例: リプレイ添削やレーン戦の立ち回りを優しく教えます。初心者歓迎です！",
                required: true,
                max_length: 500
              }
            ]
          }
        ]
      }
    });
  }

  // 🤝 師弟マッチング：弟子カードから師匠を引き受ける (未登録先輩でも即ペア成立)
  //
  // ⚠️ 2026-09-29: ボタン押下で即APIを呼ぶ「ワンポチ」だったが、**ひとことを一切送れなかった**。
  // サーバー側(CLAIM_MENTOR)は元から `message` を受け取る実装なのに画面から渡しておらず、
  // 結果として**立候補した師匠全員が同じ定型文の自己紹介**になり、弟子側は
  // 「どんな人が引き受けてくれたのか」が分からなかった（マッチングの要が機能していない）。
  // 弟子からの申請は最初からメッセージを書けたので非対称でもあった。
  // → 一度モーダルを挟んでひとことを受け取る（任意。空欄なら従来どおり成立する）。
  if (customId.startsWith('mentorship_claim_pupil:')) {
    const pupilProfileId = customId.split(':')[1];
    return Response.json({
      type: 9,
      data: {
        title: '🎓 指導を引き受ける',
        custom_id: `mentorship_claim_modal:${pupilProfileId}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: 'message',
                label: 'お相手へのひとこと（任意）',
                style: 2,
                placeholder: '例: JGのルート設計を中心に見ます。週末の夜なら通話できます',
                required: false,
                max_length: 300
              }
            ]
          }
        ]
      }
    });
  }


  // 💌 シークレットお見合い便：話してみたい（承諾）
  if (customId.startsWith('secret_match_accept:')) {
    const matchId = customId.split(':')[1];
    ctx.waitUntil((async () => {
      try {
        const { fetchPortalAPI } = await import('../../utils/api.js');
        await fetchPortalAPI(env, '/api/mentorship/matchmaker', {
          action: 'RESPOND_OFFER_BOT',
          matchId,
          decision: 'ACCEPT',
          userDiscordId: userId,
        });
      } catch (err) {
        console.error('[secret_match_accept] error:', err);
      }
    })());

    return Response.json({
      type: 4,
      data: {
        content: '🤝 **「話してみたい」をお伝えしました！**\nお相手もOKされた場合、自動的に専用スレッドが作成されます✨\n（※相手が見送った場合や辞退された場合でも何も通知されませんのでご安心ください）',
        flags: 64, // 非公開
      },
    });
  }

  // 🍃 シークレットお見合い便：今回はすべて見送る（一括見送り）
  if (customId.startsWith('secret_match_decline_all:')) {
    ctx.waitUntil((async () => {
      try {
        const { fetchPortalAPI } = await import('../../utils/api.js');
        await fetchPortalAPI(env, '/api/mentorship/matchmaker', {
          action: 'RESPOND_OFFER_BOT',
          decision: 'DECLINE_ALL',
          userDiscordId: userId,
        });
      } catch (err) {
        console.error('[secret_match_decline_all] error:', err);
      }
    })());

    return Response.json({
      type: 4,
      data: {
        content: '🍃 **見送りを記録しました。**\n相手には一切通知されませんのでご安心ください。また次回良いタイミングがあればお届けします！',
        flags: 64, // 非公開
      },
    });
  }

  // 🍃 シークレットお見合い便：単一見送り（先輩側）
  if (customId.startsWith('secret_match_decline:')) {
    const matchId = customId.split(':')[1];
    ctx.waitUntil((async () => {
      try {
        const { fetchPortalAPI } = await import('../../utils/api.js');
        await fetchPortalAPI(env, '/api/mentorship/matchmaker', {
          action: 'RESPOND_OFFER_BOT',
          matchId,
          decision: 'DECLINE',
          userDiscordId: userId,
        });
      } catch (err) {
        console.error('[secret_match_decline] error:', err);
      }
    })());

    return Response.json({
      type: 4,
      data: {
        content: '🍃 **見送りを記録しました。**\n相手には一切通知されませんのでご安心ください。',
        flags: 64, // 非公開
      },
    });
  }

  // 🎒 師弟中間チェックイン：弟子の振り返りボタン
  if (customId.startsWith('mentorship_checkin_pupil_')) {
    const parts = customId.replace('mentorship_checkin_pupil_', '').split('_');
    const matchId = parts[0];
    const checkinId = parts.slice(1).join('_');

    return Response.json({
      type: 9,
      data: {
        title: "🌱 弟子の1分振り返り（成長カルテ）",
        custom_id: `mentorship_checkin_pupil_modal:${matchId}:${checkinId}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "rating",
                label: "教わった手応え・満足度（1〜5の半角数字）",
                style: 1,
                placeholder: "5（大満足）/ 4（満足）/ 3（普通）",
                required: true,
                max_length: 1,
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "growthNote",
                label: "実感した上達ポイント・教わって良かったこと",
                style: 2,
                placeholder: "例: レーン戦でのCS意識が上がり、デスが減りました！",
                required: true,
                max_length: 300,
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "challenges",
                label: "今の悩み・次の目標",
                style: 2,
                placeholder: "例: 集団戦での立ち位置がまだ不安なので、次回のカスタムで意識したいです。",
                required: true,
                max_length: 300,
              }
            ]
          }
        ]
      }
    });
  }

  // 🧑‍🏫 師弟中間チェックイン：師匠のアドバイスボタン
  if (customId.startsWith('mentorship_checkin_mentor_')) {
    const parts = customId.replace('mentorship_checkin_mentor_', '').split('_');
    const matchId = parts[0];
    const checkinId = parts.slice(1).join('_');

    return Response.json({
      type: 9,
      data: {
        title: "👑 師匠の1分アドバイス（成長カルテ）",
        custom_id: `mentorship_checkin_mentor_modal:${matchId}:${checkinId}`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "praise",
                label: "弟子の成長を感じた点（褒めポイント）",
                style: 2,
                placeholder: "例: 以前よりマップを見る頻度が増えて、ガンク回避が上手くなっています！",
                required: true,
                max_length: 300,
              }
            ]
          },
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "advice",
                label: "次の一歩への助言・意識してほしい点",
                style: 2,
                placeholder: "例: 序盤の有利をオブジェクト（ドラゴン等）へ繋げる意識を持つとさらに勝率が上がります！",
                required: true,
                max_length: 300,
              }
            ]
          }
        ]
      }
    });
  }

  return undefined;
}
