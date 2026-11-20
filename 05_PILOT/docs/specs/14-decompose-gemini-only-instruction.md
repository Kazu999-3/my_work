# 指示文 14: 知見分解の Gemini 固定（Ollama バイパス）

作成: 2026-11-20（Muse）
対象: 05_PILOT/src/lib/knowledgeDecompose.ts

## 決定事項（ユーザー判断 2026-11-20）

SPEC 13 の比較検証結果を受け、知見分解は常に Gemini API を使用し、Ollama を使わないよう固定する。根拠: Ollama（qwen2.5:7b）は知見分解でロール誤認・オウム返しによる水増し・同一文のコピペ・文字崩れが多発し、知識ベース（personal_knowledge）汚染の恐れがあるため。詳細は 05_PILOT/docs/specs/reports/13-ollama-gemini-comparison-report.md。

## やること

- [ ] knowledgeDecompose.ts の decomposeArticle が使う LLM 呼び出しを `callHybridLlm` から `callGemini` に切り替える（呼び出しオプション temperature 0.2 / maxOutputTokens 6000 / responseMimeType 'application/json' は維持する）
- [ ] 不要になる callHybridLlm の import を整理する（callGemini は同ファイルで import 済み）
- [ ] knowledgeDecomposeHybrid.test.ts を新しいルーティングに合わせて更新する。分解が Gemini 前提になることに合わせ、指示文 12 の「LLM が使えない環境では理由を明示してスキップ」の仕組みは維持する（スキップ条件は GEMINI_API_KEY の有無を軸に再定義してよい）。ollamaClient 自体を対象にしたテスト観点は、他の呼び出し元のために残してよい
- [ ] ローカルでビルドとテストが通ることを確認し、プッシュ後に GitHub Actions の pilot-test が緑になることを確認して報告に含める

## やらないこと

- callHybridLlm / ollamaClient 自体の変更・削除（コーチの自由質問など他の呼び出し元が使い続ける）
- 他の呼び出し元のルーティング変更: app/api/coach/ask、championFactsMerge.ts、laneGuideIntegrate.ts は今回の決定の対象外（現状維持）
- scripts/llm_fallback_adapter.py（事実抽出）の変更。Ollama は事実抽出の 429 緊急フォールバックとして現状のまま残す
- Ollama モデルの変更（14B 化は見送りが決まっている）

## 完了条件

- 知見分解の経路から Ollama が完全に外れていることがコードで確認できること
- テストと CI（pilot-test）が緑であること
