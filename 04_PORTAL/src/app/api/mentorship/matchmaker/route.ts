import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getAuthSession } from '../../../../lib/authGuard';
import { generateSecretMatchmakerPairs, SecretMatchProposal } from '../../../../lib/mentorshipMatchmaker';
import { sendDiscordDirectMessage } from '../../../../lib/discordNotify';
import { createMentorshipForumThread } from '../../../../lib/discordMentorship';

export const dynamic = 'force-dynamic';

const PORTAL_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://my-work-8jbd.vercel.app';

/**
 * GET: お見合い便の候補リストを取得
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session?.discordId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const discordId = session.discordId;

    // 1. 自分宛てのアクティブなお見合いオファー（未回答）を検索
    let myProposal: any = null;
    if (discordId) {
      const { data: incomingList } = await supabase
        .from('mentorship_matches')
        .select('*')
        .eq('status', 'PROPOSAL_PENDING')
        .or(`mentor_discord_id.eq.${discordId},pupil_discord_id.eq.${discordId}`)
        .order('started_at', { ascending: false });

      if (incomingList && incomingList.length > 0) {
        for (const m of incomingList) {
          try {
            const notes = JSON.parse(m.notes || '{}');
            const isMentor = m.mentor_discord_id === discordId;
            const myStatus = isMentor ? notes.mentorStatus : notes.pupilStatus;
            if (myStatus === 'PENDING') {
              myProposal = {
                matchId: m.id,
                isMentor,
                partnerName: isMentor ? notes.pupilName : notes.mentorName,
                lane: notes.lane,
                matchScore: notes.matchScore,
                reasons: notes.reasons || [],
              };
              break;
            }
          } catch (_) {}
        }
      }
    }

    // 2. 管理者向け相性推薦候補リスト
    const proposals = await generateSecretMatchmakerPairs();

    return NextResponse.json({ ok: true, proposals, myProposal });
  } catch (err: any) {
    console.error('[matchmaker GET] error:', err);
    return NextResponse.json({ error: err.message || '内部エラー' }, { status: 500 });
  }
}

/**
 * POST: お見合いオファーの送信・回答処理
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session?.discordId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // 1. オファー送信 (管理者操作またはテスト送信)
    if (action === 'SEND_OFFER') {
      const { proposal, sendToPupil = true, sendToMentor = true } = body;
      if (!proposal || !proposal.mentor || !proposal.pupil) {
        return NextResponse.json({ error: '無効なペアデータです' }, { status: 400 });
      }

      const mentorDiscordId = proposal.mentor.discordId;
      const pupilDiscordId = proposal.pupil.discordId;

      // 既存のオファーをチェック
      const { data: existing } = await supabase
        .from('mentorship_matches')
        .select('*')
        .eq('mentor_discord_id', mentorDiscordId)
        .eq('pupil_discord_id', pupilDiscordId)
        .maybeSingle();

      const initialNotes = {
        isSecretProposal: true,
        mentorStatus: 'PENDING',
        pupilStatus: 'PENDING',
        proposedAt: new Date().toISOString(),
        matchScore: proposal.matchScore,
        reasons: proposal.reasons,
        mentorName: proposal.mentor.name,
        pupilName: proposal.pupil.name,
        lane: proposal.mentor.lanes?.[0] || proposal.pupil.primaryLane,
      };

      let matchId = existing?.id;

      if (existing) {
        // 既存更新
        await supabase
          .from('mentorship_matches')
          .update({
            status: 'PROPOSAL_PENDING',
            notes: JSON.stringify(initialNotes),
          })
          .eq('id', existing.id);
      } else {
        // 新規作成
        const { data: inserted, error: insErr } = await supabase
          .from('mentorship_matches')
          .insert({
            mentor_profile_id: proposal.mentor.profileId || null,
            pupil_profile_id: proposal.pupil.profileId || null,
            mentor_discord_id: mentorDiscordId,
            pupil_discord_id: pupilDiscordId,
            status: 'PROPOSAL_PENDING',
            notes: JSON.stringify(initialNotes),
            started_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insErr) {
          throw insErr;
        }
        matchId = inserted.id;
      }

      // 后輩側へDM送信
      let pupilDmSent = false;
      if (sendToPupil && pupilDiscordId) {
        const pupilEmbed = {
          title: `🎒 【教えて先輩！】あなたへのお見合い便が届きました`,
          description:
            `こんにちは、**${proposal.pupil.name}** さん！\n` +
            `ポータル名簿のレーン情報をもとに、ぴったりの先輩をご紹介します！✨\n\n` +
            `**👤 おすすめの先輩**: **${proposal.mentor.name}** さん (${proposal.mentor.rank})\n` +
            `**🛡️ レーン**: \`${proposal.mentor.lanes.join('/')}\`\n` +
            `**🎯 相性スコア**: **${proposal.matchScore}%**\n` +
            `**💡 おすすめ理由**:\n` +
            proposal.reasons.map((r: string) => `・${r}`).join('\n') +
            `\n\n---\n` +
            `少しコツを聞いてみたり、質問してみたいですか？\n` +
            `👉 **[Webポータルでお見合いに回答する](${PORTAL_BASE_URL}/mentorship)**\n\n` +
            `🔒 **安心ルール（完全非公開）**:\n` +
            `**「今回は見送る」を選んでも、相手には一切通知されません。**\n` +
            `双方が「話してみたい」を選んだ時だけ、静かに専用チャットが作成されます。`,
          color: 0x10b981, // Emerald
          footer: {
            text: 'KTM シークレットお見合い便 • 完全ダブルオプトイン・見送り無通知',
          },
        };

        pupilDmSent = await sendDiscordDirectMessage(pupilDiscordId, {
          embeds: [pupilEmbed],
        });
      }

      // 先輩側へDM送信
      let mentorDmSent = false;
      if (sendToMentor && mentorDiscordId) {
        const mentorEmbed = {
          title: `🎒 【教えて先輩！】マッチする後輩候補のご紹介`,
          description:
            `**${proposal.mentor.name}** さん、いつもありがとうございます！\n` +
            `あなたが担当するレーンで、ぴったりの後輩候補がいます！✨\n\n` +
            `**👤 後輩候補**: **${proposal.pupil.name}** さん (${proposal.pupil.rank})\n` +
            `**🛡️ レーン**: \`${proposal.pupil.primaryLane}\`\n` +
            `**🎯 相性スコア**: **${proposal.matchScore}%**\n` +
            `**💡 おすすめ理由**:\n` +
            proposal.reasons.map((r: string) => `・${r}`).join('\n') +
            `\n\n---\n` +
            `声をかけてみますか？\n` +
            `👉 **[Webポータルでお見合いに回答する](${PORTAL_BASE_URL}/mentorship)**\n\n` +
            `🔒 **安心ルール（完全非公開）**:\n` +
            `**「今回は見送る」を選んでも、相手には一切通知されません。**`,
          color: 0x8b5cf6, // Purple
          footer: {
            text: 'KTM シークレットお見合い便 • 完全ダブルオプトイン・見送り無通知',
          },
        };

        mentorDmSent = await sendDiscordDirectMessage(mentorDiscordId, {
          embeds: [mentorEmbed],
        });
      }

      return NextResponse.json({
        ok: true,
        matchId,
        pupilDmSent,
        mentorDmSent,
      });
    }

    // 2. オファーへの回答（承諾 / 見送り）
    if (action === 'RESPOND_OFFER') {
      const { matchId, decision } = body; // decision: 'ACCEPT' | 'DECLINE'
      const userDiscordId = session.discordId; // Discord ID

      const { data: match, error: mErr } = await supabase
        .from('mentorship_matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (mErr || !match) {
        return NextResponse.json({ error: '対象のお見合いが見つかりません' }, { status: 404 });
      }

      let notes: any = {};
      try {
        notes = JSON.parse(match.notes || '{}');
      } catch (_) {}

      const isMentor = match.mentor_discord_id === userDiscordId;
      const isPupil = match.pupil_discord_id === userDiscordId;

      if (!isMentor && !isPupil) {
        return NextResponse.json({ error: '回答権限がありません' }, { status: 403 });
      }

      // 【見送りの場合】: 相手には一切通知せず、静かに終了
      if (decision === 'DECLINE') {
        if (isMentor) notes.mentorStatus = 'DECLINED';
        if (isPupil) notes.pupilStatus = 'DECLINED';

        await supabase
          .from('mentorship_matches')
          .update({
            status: 'DISMISSED',
            notes: JSON.stringify(notes),
          })
          .eq('id', matchId);

        return NextResponse.json({
          ok: true,
          status: 'DISMISSED',
          message: '見送りを記録しました。相手には一切通知されません。',
        });
      }

      // 【承諾（話してみたい）の場合】
      if (isMentor) notes.mentorStatus = 'ACCEPTED';
      if (isPupil) notes.pupilStatus = 'ACCEPTED';

      const isBothAccepted = notes.mentorStatus === 'ACCEPTED' && notes.pupilStatus === 'ACCEPTED';

      if (isBothAccepted) {
        // 双方が承諾！ ➔ マッチング成立
        const updatedNotes = {
          ...notes,
          durationKey: '14_DAYS',
          durationLabel: 'お見合い成立（14日間）',
          commStyle: 'VC_ACTIVE',
          autoRenew: true,
          matchedAt: new Date().toISOString(),
        };

        await supabase
          .from('mentorship_matches')
          .update({
            status: 'ACTIVE',
            notes: JSON.stringify(updatedNotes),
          })
          .eq('id', matchId);

        // 専用スレッドの作成
        let threadUrl = '';
        try {
          const threadRes = await createMentorshipForumThread({
            mentorName: notes.mentorName || '先輩',
            pupilName: notes.pupilName || '後輩',
            durationLabel: 'お見合い成立（14日間）',
            mentorDiscordId: match.mentor_discord_id,
            pupilDiscordId: match.pupil_discord_id,
            lanes: [notes.lane || 'ALL'],
            commStyle: 'VC_ACTIVE',
          });
          if (threadRes?.threadUrl) {
            threadUrl = threadRes.threadUrl;
            updatedNotes.threadUrl = threadUrl;
            await supabase
              .from('mentorship_matches')
              .update({ notes: JSON.stringify(updatedNotes) })
              .eq('id', matchId);
          }
        } catch (tErr) {
          console.warn('[matchmaker] Failed to create thread:', tErr);
        }

        // 双方にマッチング成立の祝賀DM
        const notifyContent =
          `🎉 **【お見合い成立！】**\n` +
          `双方が「話してみたい」を選択されたため、マッチングが成立しました！✨\n` +
          (threadUrl ? `👉 [専用相談スレッドはこちら](${threadUrl})\n` : '') +
          `気軽に挨拶や質問をしてみてくださいね！`;

        await sendDiscordDirectMessage(match.mentor_discord_id, { content: notifyContent });
        await sendDiscordDirectMessage(match.pupil_discord_id, { content: notifyContent });

        return NextResponse.json({
          ok: true,
          status: 'MATCHED',
          isBothAccepted: true,
          threadUrl,
          message: 'お見合いが成立しました！専用スレッドを作成しました。',
        });
      } else {
        // 片方のみ承諾（相手の回答待ち）
        await supabase
          .from('mentorship_matches')
          .update({
            notes: JSON.stringify(notes),
          })
          .eq('id', matchId);

        return NextResponse.json({
          ok: true,
          status: 'PENDING_PARTNER',
          isBothAccepted: false,
          message: '回答を受け付けました。相手も「話してみたい」を選択した場合に成立します。',
        });
      }
    }

    return NextResponse.json({ error: '不明なアクションです' }, { status: 400 });
  } catch (err: any) {
    console.error('[matchmaker POST] error:', err);
    return NextResponse.json({ error: err.message || '内部エラー' }, { status: 500 });
  }
}
