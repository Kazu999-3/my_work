import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

function parseIntroduction(content: string) {
  const lower = content.toLowerCase();
  let ign: string | null = null;
  let primary: string = "ALL";
  let secondary: string = "-";
  let ignore_role: string = "-";

  // 1. Riot ID の抽出 (Name#TAG) - ReDoSフリーな超シンプル設計
  const match = lower.match(/[^\s#]{2,16}#[a-z0-9]{3,5}/g);
  if (match && match.length > 0) {
    ign = match[0].trim();
  }

  // 2. 希望・NGレーンの判定
  const roleMapping: Record<string, string> = {
    top: "TOP", 
    トップ: "TOP",
    jg: "JG",
    jungle: "JG",
    ジャングル: "JG",
    mid: "MID",
    ミッド: "MID",
    adc: "ADC",
    bot: "ADC",
    ボット: "ADC",
    sup: "SUP",
    support: "SUP",
    サポート: "SUP"
  };

  // 行単位に分割してスキャンする（ReDoSを完全に防ぐ）
  const lines = lower.split(/[\r\n]+/);

  for (const line of lines) {
    // NGロールの検出
    const isNgLine = line.includes("ng") || line.includes("苦手") || line.includes("やりたくない") || line.includes("無理") || line.includes("できない") || line.includes("できません");
    if (isNgLine) {
      for (const [key, val] of Object.entries(roleMapping)) {
        if (line.includes(key)) {
          ignore_role = val;
          break;
        }
      }
    }

    // 第一希望の検出
    const isPrimaryLine = line.includes("第1") || line.includes("第一") || line.includes("メイン") || line.includes("希望") || line.includes("1");
    if (isPrimaryLine && primary === "ALL") {
      for (const [key, val] of Object.entries(roleMapping)) {
        if (line.includes(key) && val !== ignore_role) {
          primary = val;
          break;
        }
      }
    }

    // 第二希望の検出
    const isSecondaryLine = line.includes("第2") || line.includes("第二") || line.includes("サブ") || line.includes("2");
    if (isSecondaryLine && secondary === "-") {
      for (const [key, val] of Object.entries(roleMapping)) {
        if (line.includes(key) && val !== ignore_role && val !== primary) {
          secondary = val;
          break;
        }
      }
    }
  }

  // フォールバック: 出現順での判定 (行スキャンでヒットしなかった場合)
  if (primary === "ALL") {
    const appearances: { role: string, index: number }[] = [];
    for (const [key, val] of Object.entries(roleMapping)) {
      const idx = lower.indexOf(key);
      if (idx !== -1 && val !== ignore_role) {
        appearances.push({ role: val, index: idx });
      }
    }
    appearances.sort((a, b) => a.index - b.index);
    if (appearances.length > 0) {
      primary = appearances[0].role;
      if (appearances.length > 1 && appearances[1].role !== primary) {
        secondary = appearances[1].role;
      }
    }
  }

  return {
    ign,
    role_preferences: {
      primary,
      secondary,
      ignore_role
    }
  };
}

export async function GET() {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    return NextResponse.json({ error: 'Discord credentials not configured' }, { status: 500 });
  }

  try {
    // 1. Discordからメンバー一覧を取得
    const res = await fetch(`https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members?limit=1000`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: `Failed to fetch Discord members: ${errorText}` }, { status: res.status });
    }

    const discordMembers: any[] = await res.json();
    
    // Botを除外
    const humanMembers = discordMembers.filter(m => !m.user.bot);

    // 2. DBから現在のプレイヤー一覧を取得
    const { data: dbPlayers, error: dbError } = await supabase
      .from('ktm_players')
      .select('*');

    if (dbError) throw dbError;

    // 3. 差分を計算
    const toAdd: any[] = [];
    const toDeactivate: any[] = [];
    const activeSync: any[] = [];
    
    const dbPlayersMap = new Map();
    dbPlayers.forEach(p => {
      dbPlayersMap.set(p.discord_id || p.name.toLowerCase(), p);
    });

    const discordIdsFound = new Set();
    const toUpdateName: any[] = [];

    humanMembers.forEach(m => {
      const discordId = m.user.id;
      const displayName = m.nick || m.user.global_name || m.user.username;
      discordIdsFound.add(discordId);

      let dbPlayer = dbPlayersMap.get(discordId);
      if (!dbPlayer) {
         const byName = dbPlayers.find(p => p.name.toLowerCase() === displayName.toLowerCase());
         if (byName) dbPlayer = byName;
      }

      if (!dbPlayer) {
        toAdd.push({
          discord_id: discordId,
          name: displayName,
          ign: `${m.user.username}#...`, // ダミー
          metadata: { joined_at: m.joined_at }
        });
      } else {
        const nameChanged = dbPlayer.name !== displayName;
        if (nameChanged) {
          toUpdateName.push({
            id: dbPlayer.id,
            oldName: dbPlayer.name,
            newName: displayName,
            discord_id: discordId
          });
        }

        activeSync.push({
          ...dbPlayer,
          name: displayName,
          metadata: { ...(dbPlayer.metadata || {}), joined_at: m.joined_at }
        });
      }
    });

    // 4. toAdd (新規追加候補) がある場合、自己紹介チャンネルから書き込みを検索・解析して初期値を埋める
    if (toAdd.length > 0) {
      try {
        const introChannelId = '1485646578621616209';
        const msgRes = await fetch(`https://discord.com/api/v10/channels/${introChannelId}/messages?limit=100`, {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        });
        
        if (msgRes.ok) {
          const messages: any[] = await msgRes.json();
          
          const introMap = new Map<string, string>();
          messages.forEach((msg: any) => {
            if (msg.author && !msg.author.bot && msg.content) {
              if (!introMap.has(msg.author.id)) {
                introMap.set(msg.author.id, msg.content);
              }
            }
          });

          toAdd.forEach((p: any) => {
            const introText = introMap.get(p.discord_id);
            if (introText) {
              const parsed = parseIntroduction(introText);
              if (parsed.ign) {
                p.ign = parsed.ign;
              }
              p.role_preferences = parsed.role_preferences;
              p.metadata = {
                ...p.metadata,
                intro_parsed: true,
                raw_intro: introText.slice(0, 100)
              };
            } else {
              p.role_preferences = { primary: "ALL", secondary: "-", ignore_role: "-" };
            }
          });
        }
      } catch (err) {
        console.error('Failed to parse introductions:', err);
      }
    }

    // DBにはいるが、Discordにいない人（Active/Inactive問わず）
    dbPlayers.forEach(p => {
      if (p.discord_id) {
        // IDで判定
        if (!discordIdsFound.has(p.discord_id)) {
          toDeactivate.push(p);
        }
      } else {
        // IDが未登録の場合は名前で判定
        const found = humanMembers.some(m => {
          const displayName = m.nick || m.user.global_name || m.user.username;
          return displayName.toLowerCase() === p.name.toLowerCase();
        });
        if (!found) {
          toDeactivate.push(p);
        }
      }
    });

    return NextResponse.json({
      toAdd,
      toDeactivate,
      activeSync,
      toUpdateName,
      totalDiscordMembers: humanMembers.length,
    });
  } catch (error: any) {
    console.error('Discord Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { add, deactivate, update_metadata } = await request.json();
    
    // 追加・削除処理を FastAPI (Sovereign Core API) へ委譲 (Proxy)
    if ((add && add.length > 0) || (deactivate && deactivate.length > 0)) {
      // 本番環境など、FastAPI がローカル同居していない場合は直接 Supabase を叩くようにフォールバック
      const isLocalhostFastApi = process.env.NODE_ENV === 'development' && !process.env.SKIP_FASTAPI_PROXY;
      const fastapiUrl = process.env.FASTAPI_API_URL || 'http://localhost:8000/api/v1/players/sync';
      
      let proxySuccess = false;
      
      if (isLocalhostFastApi) {
        try {
          const apiKey = process.env.ANTIGRAVITY_API_KEY || 'default_dev_key_2026';
          const response = await fetch(fastapiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Antigravity-Key': apiKey
            },
            body: JSON.stringify({ add: add || [], deactivate: deactivate || [] })
          });

          if (response.ok) {
            proxySuccess = true;
          } else {
            const errText = await response.text();
            console.warn(`[Discord Sync POST] FastAPI proxy failed, fallback to direct Supabase. Error: ${errText}`);
          }
        } catch (e: any) {
          console.warn(`[Discord Sync POST] FastAPI is offline, fallback to direct Supabase. Error: ${e.message}`);
        }
      }

      if (!proxySuccess) {
        console.log(`[Discord Sync POST] Executing direct Supabase sync (Add: ${add?.length || 0}, Deactivate: ${deactivate?.length || 0})`);
        
        // (A) 新規プレイヤーの一括インサート/アップサート
        if (add && add.length > 0) {
          const addData = add.map((p: any) => {
            // role_preferences.ignore_role を ng_lane_1 カラムに展開する
            // （parseIntroduction() の検出結果を DB のトップレベルカラムへ正しく反映）
            const ignoreRole = p.role_preferences?.ignore_role;
            const ng_lane_1 = (ignoreRole && ignoreRole !== '-') ? ignoreRole : (p.ng_lane_1 || null);
            const ng_lane_2 = p.ng_lane_2 || null;

            return {
              discord_id: p.discord_id,
              name: p.name,
              ign: p.ign,
              highest_rank: p.highest_rank,
              role_preferences: p.role_preferences,
              mmr: p.mmr,
              mmr_top: p.mmr_top,
              mmr_jg: p.mmr_jg,
              mmr_mid: p.mmr_mid,
              mmr_adc: p.mmr_adc,
              mmr_sup: p.mmr_sup,
              is_active: p.is_active ?? false,
              ng_lane_1, // ★ バグ修正: Discord自己紹介から解析したNGレーンをDBへ書き込む
              ng_lane_2, // ★ バグ修正: ng_lane_2 も同様に引き継ぎ
            };
          });

          const { error: upsertError } = await supabase
            .from('ktm_players')
            .upsert(addData, { onConflict: 'discord_id' });

          if (upsertError) {
            throw new Error(`Direct Database upsert error: ${upsertError.message}`);
          }
        }

        // (B) プレイヤーの物理削除
        if (deactivate && deactivate.length > 0) {
          const idsToDelete = deactivate.map((p: any) => p.id).filter(Boolean);
          if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabase
              .from('ktm_players')
              .delete()
              .in('id', idsToDelete);

            if (deleteError) {
              throw new Error(`Direct Database delete error: ${deleteError.message}`);
            }
          }
        }
      }
    }

    // 既存プレイヤーのメタデータ(joined_at等)や名前の更新処理（差分がある場合のみ並列で高速更新）
    if (update_metadata && update_metadata.length > 0) {
      const { data: dbPlayers } = await supabase
        .from('ktm_players')
        .select('id, name, metadata');

      const dbPlayerMap = new Map();
      (dbPlayers || []).forEach(p => dbPlayerMap.set(p.id, p));

      const updatePromises = [];

      for (const p of update_metadata) {
        if (!p.id) continue;
        const dbPlayer = dbPlayerMap.get(p.id);
        if (!dbPlayer) continue;

        const isNameChanged = dbPlayer.name !== p.name;
        const isMetaChanged = JSON.stringify(dbPlayer.metadata || {}) !== JSON.stringify(p.metadata || {});

        if (isNameChanged || isMetaChanged) {
          const oldName = dbPlayer.name;
          const newName = p.name;

          const updatePromise = (async () => {
            const { error: updateError } = await supabase
              .from('ktm_players')
              .update({ 
                metadata: p.metadata,
                name: newName
              })
              .eq('id', p.id);
            
            if (updateError) {
              console.error(`Player update failed for ID ${p.id}:`, updateError);
            } else if (isNameChanged) {
              console.log(`[Discord Sync Name Change] Updating matches for ${oldName} -> ${newName}`);
              const { error: matchesUpdateError } = await supabase
                .from('ktm_match_participants')
                .update({ player_name: newName })
                .eq('player_name', oldName);
              if (matchesUpdateError) {
                console.error(`Failed to update matches for ${oldName} -> ${newName}:`, matchesUpdateError);
              }
            }
          })();

          updatePromises.push(updatePromise);
        }
      }

      if (updatePromises.length > 0) {
        console.log(`[Discord Sync POST] Executing parallel update for ${updatePromises.length} players with differences.`);
        await Promise.all(updatePromises);
      }
    }

    return NextResponse.json({ success: true, message: `Added ${add?.length || 0}, Deactivated ${deactivate?.length || 0}, Updated ${update_metadata?.length || 0}` });
  } catch (error: any) {
    console.error('Discord Sync POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
