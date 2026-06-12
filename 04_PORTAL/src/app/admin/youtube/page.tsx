import YoutubeQueueManager from './YoutubeQueueManager';

export const metadata = {
  title: "YouTube吸収キュー管理 | Sovereign Command Center",
  description: "Sovereign OS の YouTube 動画解析キューを登録・監視・管理します。",
};

export default function YoutubeAdminPage() {
  return (
    <div className="min-h-screen bg-[#06070a] text-gray-100 p-6 md:p-12 overflow-y-auto">
      <YoutubeQueueManager />
    </div>
  );
}
