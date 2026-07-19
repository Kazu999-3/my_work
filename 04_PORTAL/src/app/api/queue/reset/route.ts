import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { verifyAdminSession } from '../../../../lib/adminAuth';

export async function POST(req: Request) {
  // S-01棚卸し対応: キューのリセットは管理者のみ
  const auth = await verifyAdminSession(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  const queuePath = 'D:/my_work/02_FACTORY/kirei_queue.json';
  
  try {
    // ファイルが存在するか確認
    try {
      await fs.access(queuePath);
    } catch {
      return NextResponse.json(
        { success: false, error: 'キューファイルが見つかりません。' },
        { status: 404 }
      );
    }

    // ファイルを読み込み
    const data = await fs.readFile(queuePath, 'utf8');
    const queue = JSON.parse(data);

    if (!Array.isArray(queue)) {
      return NextResponse.json(
        { success: false, error: 'キューのデータ形式が不正です。' },
        { status: 400 }
      );
    }

    // エラー状態の項目を待機中（pending）にリセット
    let resetCount = 0;
    const updatedQueue = queue.map((item: any) => {
      const status = item.status;
      if (status && (status.startsWith('error') || status.includes('error'))) {
        resetCount++;
        return { ...item, status: 'pending' };
      }
      return item;
    });

    if (resetCount > 0) {
      // 変更をファイルに書き戻し
      await fs.writeFile(queuePath, JSON.stringify(updatedQueue, null, 4), 'utf8');
    }

    return NextResponse.json({
      success: true,
      message: `${resetCount}件のエラー項目を待機中にリセットしました。`,
      resetCount
    });

  } catch (error: any) {
    console.error('Queue reset API error:', error);
    return NextResponse.json(
      { success: false, error: `リセット処理中にエラーが発生しました: ${error.message}` },
      { status: 500 }
    );
  }
}
