import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
      <div className="max-w-4xl mx-auto bg-[#0f111a]/40 backdrop-blur-md rounded-3xl border border-white/10 p-6 md:p-12 shadow-2xl">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({node, ...props}) => <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#c89b3c] to-yellow-200 mb-8 pb-4 border-b border-white/10 mt-6" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-2xl font-bold text-yellow-100 mt-10 mb-4 pb-2 border-b border-white/5 flex items-center gap-2" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-xl font-bold text-[#00cfef] mt-6 mb-3" {...props} />,
            p: ({node, ...props}) => <p className="text-gray-300 leading-relaxed mb-4 text-sm md:text-base" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc list-inside pl-4 mb-4 text-gray-300 space-y-2 text-sm md:text-base" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal list-inside pl-4 mb-4 text-gray-300 space-y-2 text-sm md:text-base" {...props} />,
            li: ({node, ...props}) => <li className="mb-1 text-gray-300" {...props} />,
            a: ({node, ...props}) => <a className="text-[#00cfef] hover:underline font-bold" {...props} />,
            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#c89b3c] bg-[#c89b3c]/5 pl-4 py-2 my-4 rounded-r-xl italic text-gray-400" {...props} />,
            code: ({node, className, children, ...props}) => {
              const match = /language-(\w+)/.exec(className || '');
              const inline = !match;
              return inline ? (
                <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#c89b3c] font-mono text-sm" {...props}>{children}</code>
              ) : (
                <pre className="bg-[#0b0c13] border border-white/10 rounded-2xl p-4 overflow-x-auto my-6 font-mono text-sm text-gray-300 leading-relaxed shadow-inner"><code className={className} {...props}>{children}</code></pre>
              );
            },
            table: ({node, ...props}) => <div className="overflow-x-auto my-6 rounded-2xl border border-white/10 bg-[#08090f]/60"><table className="w-full text-left border-collapse" {...props} /></div>,
            thead: ({node, ...props}) => <thead className="bg-white/5 border-b border-white/10 text-[#c89b3c] font-bold text-xs uppercase tracking-wider" {...props} />,
            tbody: ({node, ...props}) => <tbody className="divide-y divide-white/5" {...props} />,
            tr: ({node, ...props}) => <tr className="hover:bg-white/5 transition-colors" {...props} />,
            th: ({node, ...props}) => <th className="px-6 py-4 font-black text-sm" {...props} />,
            td: ({node, ...props}) => <td className="px-6 py-4 text-sm text-gray-300" {...props} />,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
