// 2026-08-12: この関数は廃止されました。
//
// 元々は intelligence_core への INSERT (パッチ検知) をトリガーに、DDragonの薄い
// データで matchup_sentinel を直接上書きするMVPコードだった。champion="Nidalee"に
// 固定でハードコードされたバグに加え、AIが丁寧にリサーチした辞典データを
// プレースホルダーで上書きしてしまう危険があったため、後続処理は
// pulse-patches が直接 edge_tasks へ champion_db_bulk_update を起票する
// 安全な経路に置き換えられた（intelligence_core の DBトリガーも削除済み）。
//
// このスタブは、何かが誤ってこの関数を直接呼び出した場合でもデータを一切
// 変更せず、廃止された旨を返すだけにするための安全網として残置している。
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (_req) => {
    console.log("[Stats-Collector] Deprecated function called - no action taken.");
    return new Response(
        JSON.stringify({
            status: "deprecated",
            message: "stats-collector is deprecated (2026-08-12). pulse-patches now enqueues champion_db_bulk_update directly."
        }),
        { status: 410, headers: { "Content-Type": "application/json" } }
    );
});
