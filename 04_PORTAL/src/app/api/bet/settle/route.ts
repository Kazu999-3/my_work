import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { findOrCreatePlayer, getPlayerCoins, updatePlayerCoinsAndInventory } from '../../../../lib/playerCoins';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // ⚠️ 2026-09-22 セキュリティ修正:
    // このエンドポイントは1人あたり最大850コイン（参加100+勝利150+MVP200+各賞200x3）を
    // 任意のプレイヤーへ回数無制限に発行できるが、以前は認証が一切無く誰でも叩けた。
    //
    // 通常運用では KTM Bot（試合終了時の handleAutoMatchEnd）が呼ぶため、
    // 管理者セッション または X-Bot-Secret のどちらかを必須とする。
    // ⚠️ PORTAL_BOT_SECRET が未設定だと verifyBotSecretStrict は必ず false を返す。
    //    その場合 Discord からの自動精算は動かなくなる（安全側に倒している）。
    //    Vercel と Cloudflare Workers の両方に同じ値を設定すること。
    const { requireAdmin } = await import('../../../../lib/authGuard');
    const { verifyBotSecretStrict } = await import('../../../../lib/botAuth');

    if (!verifyBotSecretStrict(req).ok) {
      const auth = await requireAdmin();
      if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: 403 });
      }
    }

    const body = await req.json();
    const { winner, players, mvp, awards } = body;
    // winner: 'BLUE' | 'RED'
    // players: [{ name: '...', team: 'BLUE' | 'RED', role: 'TOP', discordId?: '...' }, ...]
    // mvp: 'PlayerName'
    // awards: { mostKills: '...', mostDamageTaken: '...', mostAssists: '...' }

    if (!winner || !players || !Array.isArray(players)) {
      return NextResponse.json({ error: '勝敗情報またはプレイヤーリストが不足しています。' }, { status: 400 });
    }

    const rewardDetails: { name: string; added: number; total: number; reasons: string[] }[] = [];

    for (const p of players) {
      if (!p.name) continue;

      let added = 100; // 参加賞 +100
      const reasons = ['参加賞 (+100)'];

      if (p.team === winner) {
        added += 150; // 勝利ボーナス +150
        reasons.push('勝利ボーナス (+150)');
      }

      if (mvp && p.name === mvp) {
        added += 200; // MVP +200
        reasons.push('👑 MVP賞 (+200)');
      }

      if (awards) {
        if (awards.mostKills === p.name) {
          added += 200;
          reasons.push('⚔️ 最多キル賞 (+200)');
        }
        if (awards.mostDamageTaken === p.name) {
          added += 200;
          reasons.push('🛡️ 不沈艦タンク賞 (+200)');
        }
        if (awards.mostAssists === p.name) {
          added += 200;
          reasons.push('🪄 ベストサポート賞 (+200)');
        }
      }

      // プレイヤーを安全に取得
      const dbPlayer = await findOrCreatePlayer({
        discordId: p.discordId || p.discord_id,
        name: p.name,
        autoCreate: true,
      });

      if (dbPlayer) {
        const current = getPlayerCoins(dbPlayer);
        const total = current + added;

        // role_preferences.coins を安全に更新
        await updatePlayerCoinsAndInventory({
          player: dbPlayer,
          newCoins: total,
          reason: 'match_settle',
          reasonMetadata: { winner, reasons },
        });

        rewardDetails.push({
          name: p.name,
          added,
          total,
          reasons,
        });
      }
    }

    return NextResponse.json({
      success: true,
      winner,
      rewardDetails,
      message: `🎉 試合結果（${winner} 勝利）に基づき、全出場者にコインボーナスが付与されました！`,
    });
  } catch (error: any) {
    console.error('Bet Settle API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
