const fs = require('fs');

function modifyTab() {
    const path = 'd:/my_work/04_PORTAL/src/app/champions/tabs/MatchupTab.tsx';
    let code = fs.readFileSync(path, 'utf8');

    code = code.replace('export default function MatchupsPage()', 'export default function MatchupTab()');
    code = code.replace(/\.\.\/\.\.\/lib/g, '../../../lib');
    code = code.replace(/\.\.\/\.\.\/components/g, '../../../components');

    code = code.replace("const [viewMode, setViewMode] = useState<'list' | 'champion' | 'simulator'>('list');", 
                        "const [viewMode, setViewMode] = useState<'list' | 'champion'>('list');");

    const header_buttons = `<button
              onClick={() => setViewMode('list')}
              className={\`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 \${viewMode === 'list' ? 'bg-[#00cfef]/20 text-[#00cfef] shadow-[0_0_10px_rgba(0,207,239,0.2)]' : 'text-gray-400 hover:text-white'}\`}
            >
              📋 一覧
            </button>
            <button
              onClick={() => setViewMode('champion')}
              className={\`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 \${viewMode === 'champion' ? 'bg-[#c89b3c]/20 text-[#c89b3c] shadow-[0_0_10px_rgba(200,155,60,0.2)]' : 'text-gray-400 hover:text-white'}\`}
            >
              🎯 チャンピオン別
            </button>
            <button
              onClick={() => setViewMode('simulator')}
              className={\`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 \${viewMode === 'simulator' ? 'bg-[#a78bfa]/20 text-[#a78bfa] shadow-[0_0_10px_rgba(167,139,250,0.2)]' : 'text-gray-400 hover:text-white'}\`}
            >
              ⚔️ AIシミュレータ
            </button>`;
    
    const new_header_buttons = `<button
              onClick={() => setViewMode('list')}
              className={\`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 \${viewMode === 'list' ? 'bg-[#00cfef]/20 text-[#00cfef] shadow-[0_0_10px_rgba(0,207,239,0.2)]' : 'text-gray-400 hover:text-white'}\`}
            >
              📋 一覧
            </button>
            <button
              onClick={() => setViewMode('champion')}
              className={\`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 \${viewMode === 'champion' ? 'bg-[#c89b3c]/20 text-[#c89b3c] shadow-[0_0_10px_rgba(200,155,60,0.2)]' : 'text-gray-400 hover:text-white'}\`}
            >
              🎯 チャンピオン別
            </button>
            <Link href="/matchups" className="text-sm text-cyan-400 hover:text-white transition-colors flex items-center gap-1 ml-4">
              <Zap size={14} /> 5v5 AIシミュレータへ →
            </Link>`;
    code = code.replace(header_buttons, new_header_buttons);

    const header_block = `<div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 flex items-center gap-4">
            <Swords className="text-[#00cfef]" size={36} /> <span className="text-gradient">バトルサーチ</span>
          </h1>
          <p className="text-[var(--color-primary)] font-medium text-glow flex items-center gap-2">
            <Activity size={18} className="animate-pulse" /> 対面チャンプ名を入力して対策を表示
          </p>
        </div>`;
    code = code.replace(header_block, "<div></div>");
    
    code = code.replace('<div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-8">', '<div className="p-6 md:p-12 max-w-7xl mx-auto flex flex-col gap-8">');
    
    code = code.replace("viewMode === 'simulator' ? (", "false ? (");

    fs.writeFileSync(path, code, 'utf8');
}

function modifyPage() {
    const path = 'd:/my_work/04_PORTAL/src/app/matchups/page.tsx';
    let code = fs.readFileSync(path, 'utf8');
    
    code = code.replace("const [viewMode, setViewMode] = useState<'list' | 'champion' | 'simulator'>('list');",
                        "const [viewMode, setViewMode] = useState<'simulator'>('simulator');");
    
    const title_block = `<h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 flex items-center gap-4">
            <Swords className="text-[#00cfef]" size={36} /> <span className="text-gradient">バトルサーチ</span>
          </h1>
          <p className="text-[var(--color-primary)] font-medium text-glow flex items-center gap-2">
            <Activity size={18} className="animate-pulse" /> 対面チャンプ名を入力して対策を表示
          </p>`;
    const new_title_block = `<h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 flex items-center gap-4">
            <Swords className="text-[#00cfef]" size={36} /> <span className="text-gradient">5v5 AIシミュレータ</span>
          </h1>
          <Link href="/champions?tab=matchup" className="text-sm text-[#c89b3c] hover:text-white transition-colors mt-2 inline-block">
            ← 対面メモはチャンピオン辞典へ
          </Link>`;
    code = code.replace(title_block, new_title_block);

    const header_buttons = `<div className="glass-panel rounded-full p-1 flex">
            <button
              onClick={() => setViewMode('list')}
              className={\`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 \${viewMode === 'list' ? 'bg-[#00cfef]/20 text-[#00cfef] shadow-[0_0_10px_rgba(0,207,239,0.2)]' : 'text-gray-400 hover:text-white'}\`}
            >
              📋 一覧
            </button>
            <button
              onClick={() => setViewMode('champion')}
              className={\`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 \${viewMode === 'champion' ? 'bg-[#c89b3c]/20 text-[#c89b3c] shadow-[0_0_10px_rgba(200,155,60,0.2)]' : 'text-gray-400 hover:text-white'}\`}
            >
              🎯 チャンピオン別
            </button>
            <button
              onClick={() => setViewMode('simulator')}
              className={\`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 \${viewMode === 'simulator' ? 'bg-[#a78bfa]/20 text-[#a78bfa] shadow-[0_0_10px_rgba(167,139,250,0.2)]' : 'text-gray-400 hover:text-white'}\`}
            >
              ⚔️ AIシミュレータ
            </button>
          </div>
          {viewMode !== 'simulator' && (
            <button 
              onClick={() => setShowForm(!showForm)} 
              className="glass-panel glass-panel-hover rounded-full px-6 py-2.5 font-bold text-sm flex items-center gap-2 text-[#00cfef]"
            >
              {showForm ? <><X size={16} /> 閉じる</> : <><Plus size={16} /> メモ追加</>}
            </button>
          )}`;
    code = code.replace(header_buttons, "");
    
    const main_view_search = `{loading ? (
        <div className="flex justify-center items-center py-20"><div className="w-8 h-8 border-4 border-[#00cfef] border-t-transparent rounded-full animate-spin"></div></div>
      ) : viewMode === 'simulator' ? (
        renderSimulator()
      ) : viewMode === 'list' ? (`;
    
    if (code.includes(main_view_search)) {
        const parts = code.split(main_view_search);
        if (parts.length === 2) {
            const new_code = parts[0] + `{loading ? (
        <div className="flex justify-center items-center py-20"><div className="w-8 h-8 border-4 border-[#00cfef] border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        renderSimulator()
      )}
    </div>
  );
}

// Ensure Badge, InfoBlock, TimelineCard exist if used in page, but they might not be used here if list is gone.
// Let's just keep them or the compiler will strip them if unused, or complain if used but missing. Wait, we stripped the list so they are unused and won't cause error, except TimelineCard might be used by simulator?
// Wait, rendering simulator might use TimelineCard? No, renderSimulator doesn't seem to use it.
`;
            code = new_code;
        }
    }

    fs.writeFileSync(path, code, 'utf8');
}

modifyTab();
modifyPage();
