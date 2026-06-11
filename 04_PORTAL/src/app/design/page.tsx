import fs from 'fs';
import path from 'path';
import DesignEditor from './DesignEditor';

export const metadata = {
  title: "システム設計書 | Sovereign Command Center",
  description: "Sovereign OS & KTM Bot のシステムアーキテクチャ・設計仕様書",
};

export default function DesignPage() {
  const filePath = path.join(process.cwd(), 'src/app/design/SYSTEM_DESIGN.md');
  let markdown = '';
  try {
    markdown = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    markdown = '# ❌ 設計書が読み込めませんでした\nローカル開発環境で `node copy_design.js` が実行されているか、または `SYSTEM_DESIGN.md` が存在するか確認してください。';
  }

  return (
    <div className="min-h-screen bg-[#06070a] text-gray-100 p-6 md:p-12 overflow-y-auto">
      <DesignEditor initialMarkdown={markdown} />
    </div>
  );
}
