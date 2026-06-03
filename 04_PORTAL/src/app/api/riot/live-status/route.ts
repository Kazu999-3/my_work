import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { discordIds } = await req.json();
    
    // MVP: ここでRiot API (Spectator-V5) を叩いて現在のプレイ状況を取得する
    // 現在はモックデータを返す
    console.log(`Requested live status for: ${discordIds?.length} players`);

    const statuses: Record<string, { name: string, message: string }> = {};
    if (discordIds && Array.isArray(discordIds)) {
      discordIds.forEach((id: string) => {
        statuses[id] = { name: `User_${id.substring(0, 4)}`, message: "クライアント待機中" };
      });
    }

    return NextResponse.json({ 
      status: "SUCCESS", 
      statuses 
    });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
