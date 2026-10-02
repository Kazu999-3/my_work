'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, Copy, CheckCircle2 } from 'lucide-react';

// PCのYouTubeの「共有」はOSの共有メニューを出さない（独自のリンクコピー画面）ため、
// スマホのような共有先登録(share_target)が使えない。代わりにブックマークレットで、
// 今開いている動画のURLを /share-target?popup=1 に小窓で渡して登録する。
// 別サイト(youtube.com)からの fetch では Cookie(SameSite=Lax) が送られず認証が通らないため、小窓方式にしている。
function buildBookmarklet(origin: string): string {
  // ブックマークレットは1行に詰めるため、// コメントは使わない。
  // プレイリストのページ、またはプレイリスト再生中の右側の一覧から動画IDを集める。
  // URLは % を含むと javascript: URL として展開時に化けるため % を使わない書き方にしている。
  const code = [
    "(()=>{",
    "const u=location.href;",
    "if(!/youtube\\.com|youtu\\.be/.test(u)){alert('YouTubeのページで押してください');return;}",
    `const W=q=>window.open('${origin}/share-target?popup=1&'+q,'ktm_pilot_share','width=440,height=560');`,
    "const onPl=location.pathname==='/playlist';",
    "const scope=onPl?document:document.querySelector('ytd-playlist-panel-renderer');",
    `const ids=[...new Set([...(scope?scope.querySelectorAll('a[href*="/watch?v="]'):[])]`,
    ".filter(a=>!onPl||a.href.includes('list='))",
    ".map(a=>{try{return new URL(a.href).searchParams.get('v')}catch(e){return null}}).filter(Boolean))].slice(0,200);",
    "if(onPl){",
    "if(!ids.length){alert('プレイリストの動画が見つかりませんでした');return;}",
    "if(confirm('このプレイリストの'+ids.length+'本をまとめて解析キューに登録しますか？\\n（登録済みの動画は飛ばします）'))",
    "W('ids='+ids.join(',')+'&title='+encodeURIComponent(document.title.replace(/ - YouTube$/,'')));",
    "return;}",
    "if(ids.length>1&&confirm('再生中のプレイリストの'+ids.length+'本をまとめて登録しますか？\\n（キャンセルすると今の動画だけ登録します）')){",
    "const h=document.querySelector('ytd-playlist-panel-renderer #header-description h3, ytd-playlist-panel-renderer .title');",
    "W('ids='+ids.join(',')+'&title='+encodeURIComponent(h?h.textContent.trim():''));return;}",
    "W('url='+encodeURIComponent(u)+'&title='+encodeURIComponent(document.title.replace(/ - YouTube$/,'')));",
    "})()",
  ].join('');
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
          <li>YouTubeで動画（通常・Shorts・ライブ）を開いた状態で、ブックマークの「KTMに登録」を押します。小窓で登録され、自動で閉じます。</li>
          <li><b>プレイリスト</b>のページ（またはプレイリスト再生中）で押すと、並んでいる動画をまとめて登録できます（登録済みは飛ばします）。YouTubeは最初の約100本しか表示しないので、それ以上ある場合は下までスクロールしてから押してください。</li>
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
