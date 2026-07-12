"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Compass, 
  Search, 
  ChevronLeft, 
  Play, 
  Clock, 
  Sparkles, 
  Flame, 
  BookOpen, 
  HelpCircle,
  Trees,
  CheckCircle,
  X,
  Lock
} from "lucide-react";
import { getChampIcon } from "../../../lib/ddragonClient";

interface ClearRoute {
  side: 'BLUE' | 'RED';
  route: string;
  fastestTime: string;
  averageTime: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  videoUrl: string; // YouTube Video ID
  tips: string[];
}

interface ClearRecord {
  championId: string;
  championName: string;
  avatar: string;
  clears: ClearRoute[];
}

const INITIAL_CLEARS: ClearRecord[] = [
  {
    championId: 'LeeSin',
    championName: 'リー・シン (Lee Sin)',
    avatar: 'LeeSin',
    clears: [
      {
        side: 'BLUE',
        route: '赤 ➜ 石甲 ➜ 鳥 ➜ 狼 ➜ 青 ➜ 蛙 (フルクリア)',
        fastestTime: '3:15',
        averageTime: '3:22',
        difficulty: 'MEDIUM',
        videoUrl: 'tq6wQ40f7d4', // YouTubeの実演動画
        tips: [
          'パッシブ（攻撃速度増加）を各スキル発動後に2回ずつ必ず消化する。',
          'W（鉄の意志）の吸収効果を中型クリープに対して使用し、ヘルスを維持する。',
          'Q（響音波）はクリープのHPが減った状態で再発動するとダメージが増加するため、トドメに使用する。'
        ]
      },
      {
        side: 'RED',
        route: '青 ➜ 蛙 ➜ 狼 ➜ 鳥 ➜ 赤 ➜ 石甲 (フルクリア)',
        fastestTime: '3:18',
        averageTime: '3:25',
        difficulty: 'MEDIUM',
        videoUrl: 'tq6wQ40f7d4',
        tips: [
          '蛙の最初の攻撃をWのシールドで受ける。',
          '石甲を叩く際は、小さい石甲をEの範囲ダメージで巻き込んで素早く処理する。'
        ]
      }
    ]
  },
  {
    championId: 'Graves',
    championName: 'グレイブス (Graves)',
    avatar: 'Graves',
    clears: [
      {
        side: 'BLUE',
        route: '赤 ➜ 鳥 ➜ 狼 ➜ 青 ➜ 蛙 ➜ カニ (5キャンプスカトル)',
        fastestTime: '3:08',
        averageTime: '3:14',
        difficulty: 'EASY',
        videoUrl: 'H3_207Y9yv4',
        tips: [
          '通常攻撃のノックバックを利用して、クリープからダメージを受けずに周回する（引き撃ち）。',
          'E（クイックドロー）で常に「真の勇気」スタックを維持し、物理防御を上昇させる。',
          'Q（エンドライン）を壁に当てることで、即座に跳ね返らせて爆破ダメージを与える。'
        ]
      }
    ]
  },
  {
    championId: 'Nidalee',
    championName: 'ニダリー (Nidalee)',
    avatar: 'Nidalee',
    clears: [
      {
        side: 'BLUE',
        route: '青 ➜ 蛙 ➜ 狼 ➜ 鳥 ➜ 赤 ➜ 石甲 (フルクリア)',
        fastestTime: '3:01',
        averageTime: '3:10',
        difficulty: 'HARD',
        videoUrl: 'Jp8g3V08d6E',
        tips: [
          '人型のQ（槍投げ）を最大距離から当てて「獲物」マークを付与し、クーガー型のW（急襲）で長距離ジャンプする。',
          'クーガー型のスキル回し（W ➜ E ➜ Q）を最速で入力してダメージを極大化。',
          'トラップ（W）をあらかじめ沸き位置に敷いておき、追加ダメージを与える。'
        ]
      }
    ]
  },
  {
    championId: 'JarvanIV',
    championName: 'ジャーヴァンIV (Jarvan IV)',
    avatar: 'JarvanIV',
    clears: [
      {
        side: 'BLUE',
        route: '赤 ➜ 石甲 ➜ 鳥 ➜ 狼 ➜ 青 ➜ 蛙 (フルクリア)',
        fastestTime: '3:20',
        averageTime: '3:28',
        difficulty: 'EASY',
        videoUrl: 'dQw4w9WgXcQ',
        tips: [
          'E（デマーシアの旗印）を設置して周囲の味方（自分）の攻撃速度を上昇させる。',
          'Q（ドラゴンストライク）を旗に通してノックアップさせ、被ダメージを抑える。',
          'パッシブ（武勇の証）の割合ダメージを最初に大クリープに当てるようにターゲット選択する。'
        ]
      }
    ]
  }
];

export default function ChampionClearsPage() {
  const [clears, setClears] = useState<ClearRecord[]>(INITIAL_CLEARS);
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [sideFilter, setSideFilter] = useState<string | null>(null);
  
  // アクティブな再生動画 (embed ID)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeChampName, setActiveChampName] = useState<string>("");

  // フィルタリング処理
  const filteredClears = clears.filter(c => {
    const matchesSearch = c.championName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDifficulty = difficultyFilter 
      ? c.clears.some(r => r.difficulty === difficultyFilter)
      : true;

    const matchesSide = sideFilter
      ? c.clears.some(r => r.side === sideFilter)
      : true;

    return matchesSearch && matchesDifficulty && matchesSide;
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-slate-950 to-black text-white p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* ナビゲーション */}
        <div className="flex justify-between items-center">
          <Link 
            href="/ktm-admin" 
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>管理者ダッシュボードへ戻る</span>
          </Link>
          <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 uppercase tracking-widest flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            <span>管理者専用 🔑 周回統計ライブラリ</span>
          </span>
        </div>

        {/* ヘッダー */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <Trees className="w-8 h-8 text-emerald-400" />
            <span>ジャングル周回統計 ＆ 実演動画アーカイブ</span>
          </h1>
          <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
            各ジャングルチャンピオンの最速ルート、目標クリアタイム、およびカイトのコツと実演動画をまとめた管理者用の戦術攻略ライブラリです。
          </p>
        </div>

        {/* フィルターパネル */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-xl flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* 名前検索 */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-500" />
            <input 
              type="text"
              placeholder="チャンピオン名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-2 pl-10 pr-4 text-xs font-bold focus:outline-none focus:border-emerald-500/50 transition-all text-white placeholder-gray-600"
            />
          </div>

          <div className="flex gap-4 flex-wrap w-full md:w-auto justify-end">
            {/* 難易度フィルター */}
            <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-[10px] font-black">
              <button onClick={() => setDifficultyFilter(null)} className={`px-2.5 py-1 rounded-lg ${!difficultyFilter ? 'bg-emerald-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>ALL</button>
              <button onClick={() => setDifficultyFilter('EASY')} className={`px-2.5 py-1 rounded-lg ${difficultyFilter === 'EASY' ? 'bg-emerald-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>EASY</button>
              <button onClick={() => setDifficultyFilter('MEDIUM')} className={`px-2.5 py-1 rounded-lg ${difficultyFilter === 'MEDIUM' ? 'bg-emerald-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>MEDIUM</button>
              <button onClick={() => setDifficultyFilter('HARD')} className={`px-2.5 py-1 rounded-lg ${difficultyFilter === 'HARD' ? 'bg-emerald-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>HARD</button>
            </div>

            {/* サイドフィルター */}
            <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-[10px] font-black">
              <button onClick={() => setSideFilter(null)} className={`px-2.5 py-1 rounded-lg ${!sideFilter ? 'bg-cyan-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>ALL</button>
              <button onClick={() => setSideFilter('BLUE')} className={`px-2.5 py-1 rounded-lg ${sideFilter === 'BLUE' ? 'bg-cyan-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>BLUE</button>
              <button onClick={() => setSideFilter('RED')} className={`px-2.5 py-1 rounded-lg ${sideFilter === 'RED' ? 'bg-cyan-500 text-black shadow-md' : 'text-gray-400 hover:text-white'}`}>RED</button>
            </div>
          </div>
        </div>

        {/* YouTube埋め込み再生モーダル (動画プレイヤー) */}
        {activeVideoId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4" onClick={() => setActiveVideoId(null)}>
            <div className="bg-gray-950 border border-emerald-500/30 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-4 p-4 md:p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-sm font-black flex items-center gap-2">
                  <Flame className="w-5 h-5 text-emerald-400" />
                  <span>{activeChampName} - 周回実演アーカイブ</span>
                </h3>
                <button 
                  onClick={() => setActiveVideoId(null)}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* iframe動画 */}
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black shadow-inner">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="text-[11px] text-gray-500 text-center font-mono">
                ※ 実演動画は YouTube プレイリストアーカイブから配信されています。
              </div>
            </div>
          </div>
        )}

        {/* チャンピオン周回リスト */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredClears.map(champ => (
            <div 
              key={champ.championId}
              className="bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-emerald-500/20 rounded-3xl p-5 transition duration-300 shadow-xl space-y-4"
            >
              {/* チャンピオン基本情報 */}
              <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                <img 
                  src={getChampIcon(champ.avatar)} 
                  alt={champ.championName} 
                  className="w-10 h-10 rounded-xl border border-white/10"
                />
                <span className="text-base font-black text-white">{champ.championName}</span>
              </div>

              {/* 各サイドのクリアルート */}
              <div className="space-y-4">
                {champ.clears
                  .filter(r => !sideFilter || r.side === sideFilter)
                  .filter(r => !difficultyFilter || r.difficulty === difficultyFilter)
                  .map((route, idx) => (
                    <div 
                      key={`${champ.championId}-${route.side}-${idx}`}
                      className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-3"
                    >
                      {/* ルート基本情報バッジ */}
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex gap-1.5 items-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                            route.side === 'BLUE' 
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {route.side} Side
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                            route.difficulty === 'EASY' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : route.difficulty === 'MEDIUM' 
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            難易度: {route.difficulty}
                          </span>
                        </div>

                        {/* クリアタイム比較 */}
                        <div className="flex gap-3 text-[10px] font-mono">
                          <div className="flex items-center gap-1 text-emerald-400 font-bold">
                            <Clock className="w-3 h-3" />
                            <span>最速: {route.fastestTime}</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-400">
                            <Clock className="w-3 h-3" />
                            <span>平均: {route.averageTime}</span>
                          </div>
                        </div>
                      </div>

                      {/* ルート表記 */}
                      <div className="text-[11px] font-bold text-gray-300 leading-relaxed bg-black/20 p-2.5 rounded-xl border border-white/5">
                        ルート: {route.route}
                      </div>

                      {/* 攻略テクニック */}
                      <div className="space-y-1.5">
                        <div className="text-[9px] text-gray-500 font-black uppercase tracking-wider flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-emerald-400" />
                          <span>周回のポイント</span>
                        </div>
                        <ul className="text-[10px] text-gray-400 space-y-1 pl-1">
                          {route.tips.map((tip, tIdx) => (
                            <li key={tIdx} className="flex items-start gap-1">
                              <span className="text-emerald-400 shrink-0">•</span>
                              <span className="leading-relaxed">{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* 実演動画再生ボタン */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveVideoId(route.videoUrl);
                          setActiveChampName(`${champ.championName} (${route.side} Side)`);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-xs transition-colors shadow-md mt-2"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>実演動画をインライン再生 🎬</span>
                      </button>

                    </div>
                  ))}
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
