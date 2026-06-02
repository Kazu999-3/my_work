// V4 Phase 1: Edge Function for Patch Monitoring
// This script runs on Supabase Edge Functions (Deno)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const DISCORD_WEBHOOK = Deno.env.get('DISCORD_WEBHOOK') || "";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function notifyDiscord(title: string, description: string, url: string) {
    if (!DISCORD_WEBHOOK) return;
    const payload = {
        embeds: [{
            title: `👑 ${title}`,
            description: `${description}\n\n[👉 公式パッチノートを読む](${url})`,
            color: 0x7289da,
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
    try {
        console.log("[Pulse-Patches] Edge function triggered.");
        const url = "https://www.leagueoflegends.com/ja-jp/news/game-updates/";
        const res = await fetch(url);
        const html = await res.text();
        
        // 正規表現でパッチノートのリンクを抽出
        const match = html.match(/href="([^"]*patch-[^"]*-notes\/)"/i);
        if (!match) {
            return new Response(JSON.stringify({ status: "No patch found in HTML" }), { headers: { "Content-Type": "application/json" } });
        }
        
        let latestLink = match[1];
        if (latestLink.startsWith("/")) {
            latestLink = `https://www.leagueoflegends.com${latestLink}`;
        }
        
        // パッチ番号の抽出 (例: patch-15-1-notes)
        const patchSlug = latestLink.split("/").filter(Boolean).pop() || "";
        const patchNo = patchSlug.replace("patch-", "").replace("-notes", "").replace(/-/g, ".");
        
        console.log(`[Pulse-Patches] Latest patch detected: ${patchNo}`);
        
        // DBから前回取得した最新パッチを確認 (intelligence_core テーブルを使用)
        const { data: existingData, error: dbError } = await supabase
            .from('intelligence_core')
            .select('id')
            .eq('id', `patch_edge_${patchNo}`)
            .single();
            
        if (existingData) {
            console.log("[Pulse-Patches] No new patch. Already processed.");
            return new Response(JSON.stringify({ status: "Already up to date", patch: patchNo }), { headers: { "Content-Type": "application/json" } });
        }
        
        // 新しいパッチが見つかった場合、DBに保存してDiscordへ通知
        console.log(`[Pulse-Patches] NEW PATCH DETECTED: ${patchNo}! Storing to DB...`);
        
        await supabase.from('intelligence_core').insert({
            id: `patch_edge_${patchNo}`,
            content: `New patch ${patchNo} detected by Edge Function.`,
            metadata: { type: "patch_notes", patch: patchNo, source_url: latestLink },
            created_at: new Date().toISOString()
        });
        
        await notifyDiscord(
            `新パッチ ${patchNo} 到来 (Edge 検知)`, 
            `公式パッチノートが更新されました。\nこの通知はローカルPCからではなく、**クラウドのエッジサーバー**から自律的に送信されています。`, 
            latestLink
        );
        
        // 注意: 後続の重い処理 (RAGや記事生成) は、DBのInsertトリガーで別のEdge Functionをキックするアーキテクチャ(非同期イベント駆動)にするため、ここでは処理を終える。
        
        return new Response(JSON.stringify({ status: "New patch processed", patch: patchNo, url: latestLink }), { headers: { "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error("[Pulse-Patches] Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});
