'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '../../lib/apiClient';
import AngerDetoxModal from './AngerDetoxModal';
import { QuickChoiceOption, BlameCheckResult } from '../../lib/tiltBlameDetector';

type Level = 'green' | 'yellow' | 'red';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProceedToReflection: () => void;
  onSnooze: () => void;
}

export default function TiltDiagnosisPopup({ isOpen, onClose, onProceedToReflection, onSnooze }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [isDetoxOpen, setIsDetoxOpen] = useState(false);

  // 1秒直感チェックおよびコメントの状態
  const [quickChoice, setQuickChoice] = useState<QuickChoiceOption | null>(null);
  const [inputText, setInputText] = useState('');

  const runAnalysis = async (choice?: QuickChoiceOption, textVal?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiJson('/api/coach/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'tilt',
          quickChoice: choice !== undefined ? choice : quickChoice,
          text: textVal !== undefined ? textVal : inputText,
        }),
        timeout: 60000,
        redirectOn401: false,
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setQuickChoice(null);
    setInputText('');
    setResult(null);
    runAnalysis();
  }, [isOpen]);

  const handleSelectChoice = (choice: QuickChoiceOption) => {
    setQuickChoice(choice);
    // AI応答待機前にローカルで即座に暫定スコアを計算して描画反映 (ゼロレイテンシー化)
    const { calculateIntegratedTiltScore } = require('../../lib/tiltBlameDetector');
    const localResult = calculateIntegratedTiltScore({
      quickChoice: choice,
      aiBlameScore: result?.aiBlameScore || (choice === 'ally_fault' ? 80 : choice === 'self_fault' ? 10 : 30),
      aiCalmScore: result?.aiCalmScore || (choice === 'self_fault' ? 90 : 30),
      lossStreak: result?.streakAnalysis?.currentStreak || 0,
      text: inputText,
    });
    setResult((prev: any) => ({
      ...prev,
      integratedResult: localResult,
    }));
    runAnalysis(choice, inputText);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runAnalysis(quickChoice || undefined, inputText);
  };

  if (!isOpen) return null;

  const tilt = result?.tilt;
  const timing = result?.timing;
  const rec = result?.playRecommendation;
  const integrated: BlameCheckResult | undefined = result?.integratedResult;

  const blameScore = integrated?.blameScore ?? 0;
  const calmScore = integrated?.calmScore ?? 50;
  const isHighBlame = blameScore >= 70;

  const tiltColors: Record<Level, string> = {
    green: 'border-emerald-300 bg-emerald-50',
    yellow: 'border-yellow-300 bg-yellow-50',
    red: 'border-red-300 bg-red-50',
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-stone-50 border border-stone-300 rounded-xl shadow-2xl w-full max-w-md overflow-hidden my-6">
          {/* ヘッダー */}
          <div className="bg-amber-900 text-amber-50 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧠</span>
              <h2 className="text-base font-bold">試合終了：メンタル＆ティルト高精度診断</h2>
            </div>
            <button
              onClick={onClose}
              className="text-amber-200 hover:text-white text-xl font-bold px-2 py-0.5 rounded hover:bg-amber-800 transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-5 text-sm text-stone-800 max-h-[75vh] overflow-y-auto">
            {/* Step 1: 1秒直感チェック */}
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <h3 className="font-extrabold text-xs text-stone-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <span>⚡ Step 1: 1秒直感チェック</span>
                <span className="text-[10px] text-stone-400 font-normal">（直感で選択）</span>
              </h3>
              <p className="text-xs text-stone-600 mb-3 font-semibold">今の試合で一番大きな敗因・問題と感じるのは？</p>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSelectChoice('ally_fault')}
                  className={`p-2.5 rounded-lg border text-xs font-bold text-left transition ${
                    quickChoice === 'ally_fault'
                      ? 'bg-red-500 text-white border-red-600 shadow-sm'
                      : 'bg-stone-50 hover:bg-red-50 text-stone-800 border-stone-200'
                  }`}
                >
                  🔴 味方のミス・判断
                </button>
                <button
                  onClick={() => handleSelectChoice('self_fault')}
                  className={`p-2.5 rounded-lg border text-xs font-bold text-left transition ${
                    quickChoice === 'self_fault'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                      : 'bg-stone-50 hover:bg-emerald-50 text-stone-800 border-stone-200'
                  }`}
                >
                  🟢 自分のミス・判断
                </button>
                <button
                  onClick={() => handleSelectChoice('comp_fault')}
                  className={`p-2.5 rounded-lg border text-xs font-bold text-left transition ${
                    quickChoice === 'comp_fault'
                      ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                      : 'bg-stone-50 hover:bg-blue-50 text-stone-800 border-stone-200'
                  }`}
                >
                  🔵 構成・不可抗力
                </button>
                <button
                  onClick={() => handleSelectChoice('unknown')}
                  className={`p-2.5 rounded-lg border text-xs font-bold text-left transition ${
                    quickChoice === 'unknown'
                      ? 'bg-stone-700 text-white border-stone-800 shadow-sm'
                      : 'bg-stone-50 hover:bg-stone-200 text-stone-800 border-stone-200'
                  }`}
                >
                  ⚪ まだ分からない
                </button>
              </div>
            </div>

            {/* Step 2: 思考・理由メモ入力 (AI感情トーン解析に連動) */}
            <form onSubmit={handleTextSubmit} className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-2.5">
              <h3 className="font-extrabold text-xs text-stone-700 uppercase tracking-wider flex items-center justify-between">
                <span>💬 Step 2: 今のイラつき理由や反省点（任意）</span>
                <span className="text-[10px] text-stone-400 font-normal">AIトーン解析</span>
              </h3>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="例: 「味方が寄らなくてゴミ」「自分のTop判断ミスで捕まった」など..."
                className="w-full p-2.5 rounded-lg border border-stone-200 text-xs bg-stone-50 focus:outline-none focus:border-amber-500 font-medium leading-relaxed resize-none"
                rows={2}
              />
              <button
                type="submit"
                disabled={loading || !inputText.trim()}
                className="w-full py-1.5 px-3 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <span>🔍 AIで文章の感情・冷静度トーンを解析する</span>
              </button>
            </form>

            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-stone-500">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-amber-600" />
                <span className="text-xs font-semibold">思考トーン＆戦績を分析中...</span>
              </div>
            )}

            {error && <p className="text-xs text-rose-600 font-bold">❌ {error}</p>}

            {/* Wメーター表示: イラつき度 vs 冷静度 */}
            {result && (
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-3">
                <h3 className="font-extrabold text-xs text-stone-700 uppercase tracking-wider flex items-center justify-between">
                  <span>📊 感情＆冷静度 Wメーター</span>
                  {result.sentimentAnalysis && (
                    <span className="text-[10px] bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full font-bold text-stone-700">
                      トーン: {result.sentimentAnalysis}
                    </span>
                  )}
                </h3>

                {/* 他罰イラつき度メーター */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-red-700 flex items-center gap-1">🔥 味方へのイラつき度</span>
                    <span className="text-red-800 font-black">{blameScore}%</span>
                  </div>
                  <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-red-600 transition-all duration-500"
                      style={{ width: `${blameScore}%` }}
                    />
                  </div>
                </div>

                {/* 冷静・客観度メーター */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-emerald-700 flex items-center gap-1">❄️ 冷静・客観分析度</span>
                    <span className="text-emerald-800 font-black">{calmScore}%</span>
                  </div>
                  <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-600 transition-all duration-500"
                      style={{ width: `${calmScore}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 基本ティルト結果 */}
            {tilt && (
              <div className={`rounded-xl border p-4 ${tiltColors[tilt.level as Level]}`}>
                <div className="font-bold text-stone-900 mb-1">{tilt.label}</div>
                {integrated?.reasons && integrated.reasons.length > 0 && (
                  <ul className="text-xs text-stone-700 space-y-1 list-disc list-inside">
                    {integrated.reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* AIアドバイス */}
            {result?.advice && (
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 text-xs leading-relaxed text-stone-800">
                <div className="font-bold text-amber-900 mb-1 flex items-center gap-1">
                  <span>💡 メンタルコーチのアドバイス</span>
                </div>
                {result.advice}
              </div>
            )}

            {/* アクションボタン */}
            <div className="space-y-2 pt-2">
              {isHighBlame && (
                <button
                  onClick={() => setIsDetoxOpen(true)}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20"
                >
                  🔥 他罰イライラ高 (70%+) ➔ 怒りを書き出して吐き出す (アンガーデトックス)
                </button>
              )}

              <button
                onClick={onProceedToReflection}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-extrabold text-xs transition flex items-center justify-center gap-1 shadow-md shadow-amber-600/20"
              >
                📝 今すぐ試合の振り返りを記録する ➔
              </button>

              <div className="flex gap-2">
                <button
                  onClick={onSnooze}
                  className="flex-1 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold transition"
                >
                  💤 今セッションは自動表示しない
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-bold transition"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* アンガーデトックス モーダル */}
      {isDetoxOpen && (
        <AngerDetoxModal
          isOpen={isDetoxOpen}
          onClose={() => setIsDetoxOpen(false)}
          onComplete={(focusText: string) => {
            setIsDetoxOpen(false);
          }}
        />
      )}
    </>
  );
}
