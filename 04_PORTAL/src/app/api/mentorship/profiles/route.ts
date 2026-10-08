import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { getAuthSession } from '../../../../lib/authGuard';
import { verifyBotSecret } from '../../../../lib/botAuth';
import { findOrCreatePlayer } from '../../../../lib/playerCoins';
import { sendErrorNotification } from '../../../../lib/discordNotify';
import { notifyNewMentorshipProfile, syncMentorshipDashboard } from '../../../../lib/discordMentorship';

import { getPlayerTier, ExperienceTier } from '../../../../lib/playerTier';

export const dynamic = 'force-dynamic';

export interface MentorshipProfile {
  id: string;
  player_id: number | null;
  discord_id: string;
  player_name: string;
  role_type: 'PUPIL' | 'MENTOR';
  lanes: string[];
  champions: string[];
  current_rank: string;
  target_rank?: string;
  tags: string[];
  bio: string;
  active_hours: string;
  status: 'OPEN' | 'MATCHED' | 'PAUSED';
  preferred_duration?: string; // '1_MATCH' | 'REPLAY' | '3_DAYS' | '14_DAYS' | '30_DAYS' | 'INDEFINITE'
  max_pupils?: number; // 師匠の最大受入人数（デフォルト: 3）
  active_pupils_count?: number; // 現在進行中の弟子数
  active_pupil_names?: string[]; // 現在進行中の弟子たちの名前
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  tier?: ExperienceTier;
  tier_label?: string;
  total_games?: number;
}

/**
 * プレイヤーの経験度Tier（常連・経験者・ライト等）および通算試合数を解決する
 */
export async function resolvePlayerTier(discordId: string, playerName?: string) {
  const { data: player } = await supabase
    .from('ktm_players')
    .select('id, name, games_top, games_jg, games_mid, games_adc, games_sup, metadata')
    .eq('discord_id', discordId)
    .maybeSingle();

  let totalGames = 0;
  if (player) {
    totalGames =
      (player.games_top || 0) +
      (player.games_jg || 0) +
      (player.games_mid || 0) +
      (player.games_adc || 0) +
      (player.games_sup || 0);
  }
  if (totalGames === 0) {
    const { count } = await supabase
      .from('ktm_match_participants')
      .select('*', { count: 'exact', head: true })
      .eq('discord_id', discordId);
    totalGames = count || 0;
  }

  // 直近参加日時の取得
  const { data: lastMatch } = await supabase
    .from('ktm_match_participants')
    .select('created_at')
    .eq('discord_id', discordId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let daysAgo: number | null = null;
  if (lastMatch?.created_at) {
    daysAgo = Math.floor((Date.now() - new Date(lastMatch.created_at).getTime()) / (24 * 60 * 60 * 1000));
  }

  const tierInfo = getPlayerTier({
    total_games: totalGames,
    recent_games_30d: daysAgo !== null && daysAgo <= 30 ? 1 : 0,
    days_since_last_match: daysAgo,
  });

  return {
    ...tierInfo,
    totalGames,
    isEligibleMentor: tierInfo.tier === 'regular' || tierInfo.tier === 'experienced',
  };
}

/**
 * GET: 師弟プロフィールの取得（ロール・レーン別絞り込み対応）
 */
export async function GET(request: Request) {
  let myDiscordId: string | undefined = undefined;
  try {
    const { searchParams } = new URL(request.url);
    const roleType = searchParams.get('roleType'); // 'PUPIL' | 'MENTOR' | null
    const lane = searchParams.get('lane'); // 'TOP' | 'JUNGLE' | 'MID' | 'BOT' | 'SUPPORT' | null
    const status = searchParams.get('status') || 'OPEN';

    let query = supabase
      .from('mentorship_profiles')
      .select('*')
      .order('updated_at', { ascending: false });

    if (roleType) {
      query = query.eq('role_type', roleType);
    }
    if (status && status !== 'ALL') {
      query = query.eq('status', status);
    }
    if (lane && lane !== 'ALL') {
      query = query.contains('lanes', [lane]);
    }

    const { data: rawProfiles, error } = await query;

    if (error) {
      // テーブル未作成時などのフォールバック
      console.warn('[mentorship/profiles] select error:', error);
      return NextResponse.json({ ok: true, profiles: [] });
    }

    // 進行中（ACTIVE）のマッチを取得して各師匠の弟子数・名前を集計
    const { data: activeMatches } = await supabase
      .from('mentorship_matches')
      .select(`
        mentor_profile_id,
        pupil:mentorship_profiles!mentorship_matches_pupil_profile_id_fkey(player_name)
      `)
      .eq('status', 'ACTIVE');

    const mentorActiveMap: Record<string, string[]> = {};
    if (activeMatches) {
      activeMatches.forEach((m: any) => {
        if (m.mentor_profile_id) {
          if (!mentorActiveMap[m.mentor_profile_id]) {
            mentorActiveMap[m.mentor_profile_id] = [];
          }
          const pName = m.pupil?.player_name;
          if (pName) {
            mentorActiveMap[m.mentor_profile_id].push(pName);
          }
        }
      });
    }

    // 各プレイヤーのTier情報を非同期で並列解決
    const profilesWithTier: MentorshipProfile[] = await Promise.all(
      (rawProfiles || []).map(async (p: any) => {
        const activePupils = mentorActiveMap[p.id] || [];
        const maxPupils = p.max_pupils !== undefined && p.max_pupils !== null ? p.max_pupils : 3;
        let pTierInfo = null;
        if (p.discord_id) {
          pTierInfo = await resolvePlayerTier(p.discord_id, p.player_name);
        }
        return {
          ...p,
          max_pupils: maxPupils,
          active_pupils_count: activePupils.length,
          active_pupil_names: activePupils,
          tier: pTierInfo?.tier,
          tier_label: pTierInfo?.label,
          total_games: pTierInfo?.totalGames,
        };
      })
    );

    // セッション情報があれば自分のプロフィールIDおよび管理者権限も返す
    const session = await getAuthSession();
    myDiscordId = session?.discordId;
    const isKazuki = session?.discordId === '697220229964759130';
    const isAdmin = Boolean(session?.isAdmin || isKazuki);

    let canBeMentor = isAdmin; // 管理者は常に先輩可能
    let currentUserTier = null;
    if (myDiscordId) {
      currentUserTier = await resolvePlayerTier(myDiscordId);
      canBeMentor = currentUserTier.isEligibleMentor || isAdmin;
    }

    return NextResponse.json({
      ok: true,
      profiles: profilesWithTier,
      myDiscordId: myDiscordId || null,
      isAdmin,
      canBeMentor,
      userTier: currentUserTier,
    });
  } catch (err: any) {
    console.error('[mentorship/profiles] GET error:', err);
    sendErrorNotification({
      source: 'API',
      path: '/api/mentorship/profiles',
      method: 'GET',
      error: err,
      statusCode: 500,
      userId: myDiscordId,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}


/**
 * POST: 自分の自己紹介プロフィールの作成または更新
 */
export async function POST(request: Request) {
  let session: any = null;
  try {
    session = await getAuthSession();
    const body = await request.json();
    const {
      id: bodyProfileId,
      role_type,
      lanes = [],
      champions = [],
      current_rank,
      target_rank,
      tags = [],
      bio = '',
      active_hours = '',
      status = 'OPEN',
      max_pupils = 3,
      preferred_duration,
      discord_id: bodyDiscordId,
      player_name: bodyPlayerName,
    } = body;

    // 🛡️ なりすまし防止ガード ＆ 管理者メンテナンス支援:
    // 1. 管理者（かずき・ADMIN）は他ユーザーのプロフィールの代理メンテナンス更新を許可
    // 2. 一般ログインユーザーは必ず自身のセッションIDで登録（他人名義作成を遮断）
    // 3. セッションが無い場合は Bot からの正当な代理登録（verifyBotSecret）のみ許可
    const isBotAuthorized = verifyBotSecret(request).ok;
    const isKazuki = session?.discordId === '697220229964759130';
    const isAdmin = Boolean(session?.isAdmin || isKazuki);

    let effectiveDiscordId: string | null = null;
    let effectivePlayerName: string = 'Player';
    let isAdminProxyEdit = false;
    let proxyTargetProfile: any = null;

    if (isAdmin && (bodyProfileId || (bodyDiscordId && bodyDiscordId !== session?.discordId))) {
      // 管理者による代理メンテナンス
      if (bodyProfileId) {
        const { data } = await supabase
          .from('mentorship_profiles')
          .select('*')
          .eq('id', bodyProfileId)
          .maybeSingle();
        proxyTargetProfile = data;
      } else if (bodyDiscordId) {
        const { data } = await supabase
          .from('mentorship_profiles')
          .select('*')
          .eq('discord_id', bodyDiscordId)
          .eq('role_type', role_type)
          .maybeSingle();
        proxyTargetProfile = data;
      }

      if (proxyTargetProfile) {
        isAdminProxyEdit = true;
        effectiveDiscordId = proxyTargetProfile.discord_id;
        effectivePlayerName = bodyPlayerName || proxyTargetProfile.player_name || 'Player';
      }
    }

    if (!isAdminProxyEdit) {
      if (session?.discordId) {
        effectiveDiscordId = session.discordId;
        effectivePlayerName = session.displayName || session.username || 'Player';
      } else if (isBotAuthorized && bodyDiscordId) {
        effectiveDiscordId = bodyDiscordId;
        effectivePlayerName = bodyPlayerName || 'Player';
      } else {
        return NextResponse.json(
          { ok: false, error: 'プロフィールを登録するにはDiscordログインが必要です。' },
          { status: 401 }
        );
      }
    }

    const player = await findOrCreatePlayer({
      discordId: effectiveDiscordId!,
      name: effectivePlayerName,
    });

    if (!role_type || !['PUPIL', 'MENTOR'].includes(role_type)) {
      return NextResponse.json(
        { ok: false, error: '役割（弟子/師匠）を選択してください。' },
        { status: 400 }
      );
    }

    // 👑 先輩（MENTOR）資格チェック: 常連（regular）または経験者（experienced）のみ
    if (role_type === 'MENTOR' && !isAdminProxyEdit) {
      const userTier = await resolvePlayerTier(effectiveDiscordId!, effectivePlayerName);
      if (!userTier.isEligibleMentor && !isAdmin) {
        return NextResponse.json(
          {
            ok: false,
            error: `先輩カードを登録できるのは、定期カスタムに15戦以上参加した「👑 常連」または「🎖️ 経験者」メンバー限定です（現在の参加状況: ${userTier.label} / 通算${userTier.totalGames}戦）。まずは後輩として相談したり、定期カスタムへの参加経験を重ねましょう！`,
          },
          { status: 403 }
        );
      }
    }

    const playerName = effectivePlayerName || player?.name || 'Player';
    const finalCurrentRank = current_rank || player?.highest_rank || 'UNRANKED';
    const finalMaxPupils = role_type === 'MENTOR' ? Math.min(Math.max(Number(max_pupils) || 3, 1), 5) : 1;

    // 既存のプロフィール（同一role_typeまたは代理編集対象）があるか確認
    let existing = proxyTargetProfile;
    if (!existing) {
      const { data } = await supabase
        .from('mentorship_profiles')
        .select('id')
        .eq('discord_id', effectiveDiscordId)
        .eq('role_type', role_type)
        .maybeSingle();
      existing = data;
    }

    let resultData;
    let isFirstTimeBonus = false;
    let updatedCoins = 1000;

    // 師弟関係は単一レーンに特化するため、単一レーンのみ採用
    const normalizedLanes = Array.isArray(lanes) && lanes.length > 0
      ? [lanes[0]]
      : typeof lanes === 'string' && lanes.trim()
        ? [lanes.trim()]
        : ['MID'];

    // タグのサニタイズ（通話・相談スタイルのみを厳密に残し、入力してないゴミタグを完全排除）
    let normalizedTags = Array.isArray(tags) ? [...tags] : [];
    normalizedTags = normalizedTags.filter((t: string) => {
      const isJunk = [
        '優しく丁寧に教えます', 'チャンピオン使い方講座', 'ノーマル/カスタム同伴プレイ',
        '1on1マッチアップ特訓', '初心者大歓迎', 'ゴールド以下歓迎', '全ランク・初心者歓迎',
        'エメラルド以下歓迎', 'プラチナ以下歓迎', '1試合カスタム歓迎', 'リプレイ添削歓迎',
        '3日間お試し歓迎', '単発指導OK', 'エンゲージ・仕掛け判断の指導', 'ピール・キャリー保護の指導',
        '集団戦フォーカス優先度', 'ガンク警戒・ディープワード', 'オブジェクト周りの陣形・マクロ',
        'ジャングルルート・ガンク判断', 'サポートローム・視界支配', 'リプレイ添削・ミスの言語化',
        '対面マッチアップ勝ち方・トレード', 'トレード・キルライン見極め', '単発相談OK',
        'オブジェクト戦の陣形・視界', 'タワーダイブ・シージ・防衛', 'サポートのローム基準',
        'キー配置・カメラ操作見直し', 'ウェーブ管理・フリーズ', 'ローム・寄りの判断',
        '有利な試合の終わらせ方', 'リプレイ自己分析のコツ', '画面共有ライブコーチング',
        '画面共有ライブ指導', 'VC指導対応', 'VC可能', 'テキストのみ'
      ].includes(t);
      return !isJunk;
    });

    // 既存の期間系タグを除去して再設定
    normalizedTags = normalizedTags.filter((t: string) => 
      !['1試合カスタム', 'リプレイ添削', '3日間お試し', '2週間育成', '1ヶ月特訓', '長期指導'].includes(t)
    );
    if (preferred_duration === '1_MATCH') {
      normalizedTags.unshift('1試合カスタム');
    } else if (preferred_duration === 'REPLAY') {
      normalizedTags.unshift('リプレイ添削');
    } else if (preferred_duration === '3_DAYS') {
      normalizedTags.unshift('3日間お試し');
    } else if (preferred_duration === '14_DAYS') {
      normalizedTags.unshift('2週間育成');
    } else if (preferred_duration === '30_DAYS') {
      normalizedTags.unshift('1ヶ月特訓');
    }

    const basePayload: Record<string, any> = {
      player_name: playerName,
      lanes: normalizedLanes,
      champions,
      current_rank: finalCurrentRank,
      target_rank: role_type === 'PUPIL' ? target_rank : null,
      tags: normalizedTags,
      bio,
      active_hours,
      status,
    };

    if (existing?.id) {
      // 更新（まず max_pupils カラムを含めて実行）
      let { data, error } = await supabase
        .from('mentorship_profiles')
        .update({
          ...basePayload,
          max_pupils: finalMaxPupils,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      // DB側に max_pupils カラムが未追加の場合の自動フォールバック
      if (error && (error.message?.includes('max_pupils') || error.code === 'PGRST204')) {
        console.warn('[mentorship/profiles] max_pupils カラム未検出のため除外して再試行:', error.message);
        const retry = await supabase
          .from('mentorship_profiles')
          .update({
            ...basePayload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      resultData = data;
    } else {
      // 過去に他のロールでもプロフィールを作成したことがあるか確認
      const { count } = await supabase
        .from('mentorship_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('discord_id', effectiveDiscordId);

      const isFirstCreationEver = (count || 0) === 0;

      // 新規作成（まず max_pupils カラムを含めて実行）
      const insertBase: Record<string, any> = {
        player_id: player?.id || null,
        discord_id: effectiveDiscordId,
        role_type,
        ...basePayload,
      };

      let { data, error } = await supabase
        .from('mentorship_profiles')
        .insert({
          ...insertBase,
          max_pupils: finalMaxPupils,
        })
        .select()
        .single();

      // DB側に max_pupils カラムが未追加の場合の自動フォールバック
      if (error && (error.message?.includes('max_pupils') || error.code === 'PGRST204')) {
        console.warn('[mentorship/profiles] max_pupils カラム未検出のため除外して再試行:', error.message);
        const retry = await supabase
          .from('mentorship_profiles')
          .insert(insertBase)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      resultData = data;

      // 初回作成ボーナス（+500pt）を付与（管理者の代理編集時は除外）
      if (!isAdminProxyEdit && isFirstCreationEver && player) {
        const { getPlayerCoins, updatePlayerCoinsAndInventory } = await import('../../../../lib/playerCoins');
        const currentCoins = getPlayerCoins(player);
        const newCoins = currentCoins + 500;
        await updatePlayerCoinsAndInventory({
          player,
          newCoins,
        });
        isFirstTimeBonus = true;
        updatedCoins = newCoins;
      }
    }

    // 📢 Discord連携（新着速報カード送信 ＆ 常駐ダッシュボード自動同期）
    if (!isAdminProxyEdit) {
      notifyNewMentorshipProfile({ profile: resultData, isUpdate: !!existing?.id }).catch((e) =>
        console.warn('[mentorship/profiles] Discord notify failed:', e)
      );
    }
    syncMentorshipDashboard().catch((e) =>
      console.warn('[mentorship/profiles] Discord dashboard sync failed:', e)
    );

    return NextResponse.json({
      ok: true,
      profile: resultData,
      isFirstTimeBonus,
      bonusCoins: isFirstTimeBonus ? 500 : 0,
      newCoins: updatedCoins,
    });
  } catch (err: any) {
    console.error('[mentorship/profiles] POST error:', err);
    sendErrorNotification({
      source: 'API',
      path: '/api/mentorship/profiles',
      method: 'POST',
      error: err,
      statusCode: 500,
      userId: session?.discordId,
      userName: session?.displayName,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE: プロフィールを削除（本人のカードまたは管理者は全カード削除可能）
 */
export async function DELETE(request: Request) {
  let session: any = null;
  try {
    session = await getAuthSession();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const paramDiscordId = searchParams.get('discordId');

    const effectiveDiscordId = session?.discordId || paramDiscordId;
    const isAdmin = !!session?.isAdmin;

    if (!effectiveDiscordId && !isAdmin) {
      return NextResponse.json({ ok: false, error: '認証が必要です。' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Profile ID is required' }, { status: 400 });
    }

    let deleteQuery = supabase
      .from('mentorship_profiles')
      .delete()
      .eq('id', id);

    // 管理者でない場合は本人のカードのみ削除可能に制限
    if (!isAdmin && effectiveDiscordId) {
      deleteQuery = deleteQuery.eq('discord_id', effectiveDiscordId);
    }

    const { error } = await deleteQuery;

    if (error) throw error;

    // 📢 Discord連携（削除後の常駐ダッシュボード自動同期）
    syncMentorshipDashboard().catch((e) =>
      console.warn('[mentorship/profiles] Discord dashboard sync on delete failed:', e)
    );

    return NextResponse.json({ ok: true, message: 'カードを削除しました。' });
  } catch (err: any) {
    console.error('[mentorship/profiles] DELETE error:', err);
    sendErrorNotification({
      source: 'API',
      path: '/api/mentorship/profiles',
      method: 'DELETE',
      error: err,
      statusCode: 500,
      userId: session?.discordId,
      userName: session?.displayName,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

