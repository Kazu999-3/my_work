import DesignEditor from './DesignEditor';
import { systemDesignDocs } from './systemDesignMarkdown';

export const metadata = {
  title: "システム設計書 | Sovereign Command Center",
  description: "Sovereign OS & KTM Bot のシステムアーキテクチャ・設計仕様書",
};

export default function DesignPage() {
  return (
    <div className="min-h-screen bg-[#06070a] text-gray-100 p-6 md:p-12 overflow-y-auto">
      <DesignEditor initialDocs={systemDesignDocs} />
    </div>
  );
}
