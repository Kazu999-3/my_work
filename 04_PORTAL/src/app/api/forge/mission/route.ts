import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { champion, mission_type } = await req.json();
    
    // MVP: Sovereign OS など外部システムへミッションを連携する
    // 現在はSupabaseのキューに積むか、単純に受理したとする
    console.log(`Received Forge mission: ${champion} (${mission_type})`);

    return NextResponse.json({ 
      status: "SUCCESS", 
      message: "錬成ミッションを受理しました" 
    });
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err.message }, { status: 500 });
  }
}
