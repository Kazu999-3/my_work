"use client";

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

interface AIPlayerAnalysisProps {
  playerId: string;
  name: string;
  stats: any;
  mmr: number;
  highestRank: string;
  initialComment?: string;
}

export default function AIPlayerAnalysis({ playerId, name, stats, mmr, highestRank, initialComment }: AIPlayerAnalysisProps) {
  const [comment, setComment] = useState<string>(initialComment || "");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (initialComment) {
      setComment(initialComment);
    }
  }, [initialComment]);

  const generateComment = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/player/ai-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          name,
          stats,
          mmr,
          highestRank
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setComment(data.comment);
    } catch (err: any) {
      setError(err.message || "生成に失敗しました。APIキーを確認してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-64 bg-gray-900/50 rounded-lg p-6 flex flex-col items-center justify-center border border-gray-800 relative overflow-hidden group">
      {/* Background decoration */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>

      <div className="flex items-center gap-2 mb-4 text-blue-400 font-bold tracking-widest text-sm z-10">
        <Sparkles className="w-4 h-4" />
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">AI STYLE ANALYSIS</span>
        <Sparkles className="w-4 h-4" />
      </div>

      <div className="flex-1 flex items-center justify-center w-full z-10 relative">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-blue-400">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span className="text-sm font-bold animate-pulse">AIがプレイスタイルを分析中...</span>
          </div>
        ) : comment ? (
          <div className="text-center px-4">
            <p className="text-lg md:text-xl font-bold text-gray-200 leading-relaxed italic">
              "{comment}"
            </p>
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center">
            {error}
          </div>
        ) : (
          <div className="text-gray-500 text-sm text-center">
            まだAIによる分析が行われていません。<br/>下のボタンから生成してください。
          </div>
        )}
      </div>

      <button 
        onClick={generateComment}
        disabled={loading}
        className="mt-4 z-10 text-xs font-bold bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-full border border-gray-700 transition flex items-center gap-2 opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        {comment ? '再分析する' : 'AI分析を実行'}
      </button>
    </div>
  );
}
