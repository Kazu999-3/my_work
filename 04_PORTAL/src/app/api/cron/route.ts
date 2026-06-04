import { NextResponse } from 'next/server';

export const maxDuration = 30; // 30遘偵〒繧ｿ繧､繝繧｢繧ｦ繝・
export async function GET(request: Request) {
  // Render縺ｫ繝・・繝ｭ繧､縺励◆Antigravity API縺ｮURL
  // ・域悽逡ｪ迺ｰ蠅・〒縺ｯ迺ｰ蠅・､画焚 process.env.API_SERVER_URL 縺ｫ縺吶ｋ・・  const API_SERVER_URL = process.env.API_SERVER_URL || 'https://antigravity-api-nzo3.onrender.com';
  
  // 隱崎ｨｼ繧ｭ繝ｼ・・ron縺九ｉ縺ｮ繝ｪ繧ｯ繧ｨ繧ｹ繝医〒縺ゅｋ縺薙→繧定ｨｼ譏弱☆繧具ｼ・  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Render荳翫・ /api/pulse (繝｡繧ｿ讀懃衍) 縺ｨ /api/monetize (險倅ｺ狗函謌・ 繧堤匱轣ｫ縺輔○繧・    // 髱槫酔譛溘〒螳溯｡後＆繧後ｋ縺溘ａ縲√Ξ繧ｹ繝昴Φ繧ｹ繧貞ｾ・◆縺壹↓縺吶＄縺ｫ邨ゆｺ・☆繧・    const triggerMonetize = await fetch(`${API_SERVER_URL}/api/monetize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Antigravity-Key': process.env.ANTIGRAVITY_API_KEY || 'local-dev-key'
      }
    });

    if (!triggerMonetize.ok) {
      throw new Error(`Failed to trigger API: ${triggerMonetize.statusText}`);
    }

    return NextResponse.json({ success: true, message: 'Monetization loop triggered successfully' });
  } catch (error: any) {
    console.error('Cron Execution Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
