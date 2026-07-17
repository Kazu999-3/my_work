import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '../../../../lib/supabaseAdmin';
import { fetchPuuidByRiotId } from '../../../../lib/riot';

export async function POST(req: Request) {
  try {
    const { discordId, ign } = await req.json();

    if (!discordId || !ign) {
      return NextResponse.json({ status: "ERROR", message: "Missing discordId or ign" }, { status: 400 });
    }

    const apiKey = process.env.RIOT_API_KEY;
    if (!apiKey) throw new Error("RIOT_API_KEY is not set.");

    // Parse IGN (Name#Tag)
    const [gameName, tagLine] = ign.split('#');
    if (!gameName || !tagLine) {
      throw new Error("IGN format must be Name#Tag");
    }

    // Fetch PUUID
    const puuid = await fetchPuuidByRiotId(gameName, tagLine, apiKey);

    // Save to Supabase
    const { error } = await supabase
      .from('ktm_players')
      .update({ ign, puuid })
      .eq('discord_id', discordId);

    if (error) throw error;

    return NextResponse.json({ status: "SUCCESS", puuid });
  } catch (err: any) {
    console.error("Update PUUID Error:", err);
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
