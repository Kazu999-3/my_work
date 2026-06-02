// V4 Phase 3: Edge Function for RAG Memory Encoding
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { GoogleGenerativeAI } from "npm:@google/generative-ai"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || "";
const PROJECT_URL = Deno.env.get('PROJECT_URL') || "";
const PROJECT_SERVICE_KEY = Deno.env.get('PROJECT_SERVICE_KEY') || "";

const supabase = createClient(PROJECT_URL, PROJECT_SERVICE_KEY);

serve(async (req) => {
    // CORS Header
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
    if (req.method === 'OPTIONS') return new Response("ok", { headers });

    try {
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
        }
        
        const body = await req.json();
        const textToMemorize = body.content;
        const metadata = body.metadata || {};
        
        if (!textToMemorize) {
            return new Response(JSON.stringify({ error: "Content is required" }), { status: 400, headers });
        }
        
        // Gemini SDK でベクトル生成
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
        
        const result = await model.embedContent(textToMemorize);
        const embedding = result.embedding.values;
        
        // DB (intelligence_vectors) へ保存
        const { data: inserted, error: dbError } = await supabase
            .from('intelligence_vectors')
            .insert({
                content: textToMemorize,
                metadata: metadata,
                embedding: embedding
            })
            .select('id')
            .single();
            
        if (dbError) throw dbError;
        
        console.log(`[Memory-Encoder] Successfully memorized (ID: ${inserted.id})`);
        
        return new Response(JSON.stringify({ status: "Success", id: inserted.id }), { headers: { "Content-Type": "application/json", ...headers } });

    } catch (err: any) {
        console.error("[Memory-Encoder] Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...headers } });
    }
});
