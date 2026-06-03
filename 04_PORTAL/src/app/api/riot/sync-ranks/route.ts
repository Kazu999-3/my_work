import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { discordName } = await req.json();
    
    // MVP: ここでRiot API (League-V4) を叩いてktm_playersのランクやMMRを更新する
    // 現在はプレースホルダーとして成功のみを返す
    console.log(`Requested Riot sync for: ${discordName}`);

    return NextResponse.json({ 
      status: "SUCCESS", 
      message: "ランク同期は現在メンテナンス中ですが、リクエストは受理されました。" 
    });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
