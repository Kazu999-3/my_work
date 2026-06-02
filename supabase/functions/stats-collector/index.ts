// V4 Phase 1: Edge Function for Champion Stats Collection
// This script runs on Supabase Edge Functions (Deno)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const DISCORD_WEBHOOK = Deno.env.get('DISCORD_WEBHOOK') || "";
const PROJECT_URL = Deno.env.get('PROJECT_URL') || "";
const PROJECT_SERVICE_KEY = Deno.env.get('PROJECT_SERVICE_KEY') || "";

const PORTAL_URL = Deno.env.get('PORTAL_URL') || "https://my-work-8jbd.vercel.app/";
const supabase = createClient(PROJECT_URL, PROJECT_SERVICE_KEY);

async function notifyDiscord(title: string, description: string) {
    if (!DISCORD_WEBHOOK) return;
    const payload = {
        embeds: [{
            title: `📊 ${title}`,
            description: `${description}\n\n[👉 統合指揮所(ポータル)で確認する](${PORTAL_URL})`,
            color: 0x00cfef,
            timestamp: new Date().toISOString(),
            footer: { text: "Antigravity Sovereign OS (Edge Function)" }
        }]
    };
    await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}

serve(async (req) => {
    // CORS Header (必要な場合)
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
    if (req.method === 'OPTIONS') {
        return new Response("ok", { headers });
    }

    try {
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
        }
        
        const body = await req.json();
        let champion = body.champion;
        let role = body.role || "Jungle";
        
        // Supabase Webhook からの自動呼び出し（パッチ検知）の場合
        if (body.type === 'INSERT' && body.table === 'intelligence_core') {
            console.log("[Stats-Collector] Triggered by Database Webhook (New Patch)!");
            champion = "Nidalee"; // MVPとして固定（将来的には全監視対象をループ）
        }
        
        if (!champion) {
            return new Response(JSON.stringify({ error: "Champion is required" }), { status: 400, headers });
        }
        
        console.log(`[Stats-Collector] Fetching data for ${champion} (${role})...`);
        
        // MVP: 本物のデータ(Riot DDragon API)から最新パッチとチャンピオン情報を取得
        const versionRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await versionRes.json();
        const latestPatch = versions[0];
        
        console.log(`[Stats-Collector] Target Patch: ${latestPatch}`);
        
        const champRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestPatch}/data/ja_JP/champion/${champion}.json`);
        if (!champRes.ok) {
            return new Response(JSON.stringify({ error: `Champion ${champion} not found in DDragon` }), { status: 404, headers });
        }
        
        const champData = await champRes.json();
        const champ = champData.data[champion];
        
        const collectedData = {
            source: "Edge_Cloud_Collector",
            role: "GLOBAL",
            strengths: `[パッチ ${latestPatch}] ${champ.title}`,
            weaknesses: `タグ: ${champ.tags.join(", ")}`,
            buildRunes: `初期体力: ${champ.stats.hp} / 移動速度: ${champ.stats.movespeed}`,
            note_draft: `# ${champion} 最新攻略バイブル\n\nパッチ ${latestPatch} における最新データです。\n\n> ${champ.blurb}`,
            collected_at: new Date().toISOString(),
            stats: {
                win_rate: null, // 将来的にu.gg等のAPIからマージ
                pick_rate: null,
                ban_rate: null,
                tier: null,
            }
        };
        
        // Supabase の matchup_sentinel テーブルに "enemy=GLOBAL" としてデータを投入・更新
        const { data: existing, error: searchError } = await supabase
            .from('matchup_sentinel')
            .select('id, raw_data')
            .eq('champion', champion)
            .eq('enemy', 'GLOBAL')
            .single();
            
        if (existing) {
            // 更新
            await supabase.from('matchup_sentinel').update({
                raw_data: { ...existing.raw_data, ...collectedData },
                title: `${champion} 攻略データベース (Cloud Sync)`
            }).eq('id', existing.id);
        } else {
            // 新規作成
            await supabase.from('matchup_sentinel').insert({
                matchup_id: `global_${champion.toLowerCase()}_edge`,
                title: `${champion} 攻略データベース (Cloud Sync)`,
                champion: champion,
                enemy: "GLOBAL",
                strategy: "クラウドエンジンによる自動分析データ",
                raw_data: collectedData
            });
        }
        
        await notifyDiscord(
            `データ収集完了: ${champion}`, 
            `**${champion} (${role})** の最新統計データの収集と、データベース(GLOBAL)へのマージが完了しました。\nクラウド(Edge)上での非同期実行に成功しています。`
        );
        
        return new Response(JSON.stringify({ status: "Success", champion, data: collectedData }), { headers: { "Content-Type": "application/json", ...headers } });

    } catch (err: any) {
        console.error("[Stats-Collector] Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...headers } });
    }
});
