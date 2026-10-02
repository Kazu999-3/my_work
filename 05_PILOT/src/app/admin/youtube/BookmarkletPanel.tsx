'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Copy, CheckCircle2 } from 'lucide-react';

// PCのYouTubeの「共有」はOSの共有メニューを出さない（独自のリンクコピー画面）ため、
// スマホのような共有先登録(share_target)が使えない。代わりにブックマークレットで、
// 今開いている動画のURLを /share-target?popup=1 に小窓で渡して登録する。
// 別サイト(youtube.com)からの fetch では Cookie(SameSite=Lax) が送られず認証が通らないため、小窓方式にしている。
function buildBookmarklet(origin: string): string {
  const code = `(()=>{const u=location.href;if(!/youtube\\.com|youtu\\.be/.test(u)){alert('YouTubeの動画ページで押してください');return;}`
    + `window.open('${origin}/share-target?popup=1&url='+encodeURIComponent(u)+'&title='+encodeURIComponent(document.title.replace(/ - YouTube$/,'')),`
    + `'ktm_pilot_share','width=440,height=520');})()`;
  return `javascript:${code}`;
}

export default function BookmarkletPanel() {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const c = buildBookmarklet(window.location.origin);
    setCode(c);
    // React 19 は href の javascript: URL を無効化するため、描画後にDOMへ直接設定する
    linkRef.current?.setAttribute('href', c);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
      <h3 className="text-xs font-black text-white flex items-center gap-2">
        <Bookmark className="w-4 h-4 text-amber-400" /> PCからYouTubeを一発登録（ブックマークレット）
      </h3>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <a
          ref={linkRef}
          onClick={(e) => { e.preventDefault(); alert('このボタンはクリックではなく、ブックマークバーへドラッグして登録してください'); }}
          className="shrink-0 self-start px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold cursor-grab active:cursor-grabbing"
          title="ブックマークバーへドラッグ"
        >
          📼 KTMに登録
        </a>
        <ol className="text-[11px] text-slate-300 space-y-0.5 list-decimal pl-4">
          <li>左のボタンを、ブラウザのブックマークバーへドラッグして登録します（バーが無ければ Ctrl+Shift+B で表示）。</li>
          <li>YouTubeで動画（通常・Shorts・ライブ）を開いた状態で、ブックマークの「KTMに登録」を押します。</li>
          <li>小窓が開いて解析キューに登録され、1.5秒後に自動で閉じます。</li>
        </ol>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
        <span>ドラッグできない場合は、新しいブックマークを作り、URL欄にこのコードを貼り付けてください。</span>
        <button onClick={copy} disabled={!code} className="px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1 cursor-pointer">
          {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'コピーしました' : 'コードをコピー'}
        </button>
      </div>
      <p className="text-[10px] text-slate-500">
        このPCのブラウザで一度05_PILOTにログインしておく必要があります（未ログインのときは小窓でログイン画面が開きます）。
      </p>
    </div>
  );
}
