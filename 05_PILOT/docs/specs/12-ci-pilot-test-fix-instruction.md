# 指示文 12: CI（pilot-test）の失敗修正

作成: 2026-11-20（Muse）
対象: 05_PILOT/src/lib/__tests__/knowledgeDecomposeHybrid.test.ts（必要なら .github/workflows/ci.yml の確認のみ）

## 現状の問題

- GitHub Actions の `pilot-test` が master で連続失敗している（2026-11-20 朝に複数回確認）。本番デプロイ（Vercel）は成功しており実害はないが、赤いままだと本当の障害に気づけなくなる。
- 原因は特定済み: `knowledgeDecomposeHybrid.test.ts` の `decomposeArticle works with hybrid LLM` が、LLM を実際に呼ぶテストになっている。CI には Ollama が無く、GEMINI_API_KEY も設定されていない（ci.yml の pilot-test に env/secrets の設定なし）ため、`GEMINI_API_KEY が設定されていません` で必ず失敗する。ローカルは .env.local と Ollama があるため合格する。
- この失敗は死リンク修正や SPEC 08 の認証変更とは無関係（当該テストファイルはそれらのコミットで変更されていない）。

## やること

- [ ] 当該テストを「Ollama が利用可能、または GEMINI_API_KEY が設定されている場合のみ実行」し、それ以外の環境では理由を明示してスキップするよう修正する（node:test のスキップ機構を使い、スキップ理由が CI ログで読めること）
- [ ] ローカルで両方の挙動を確認する（Ollama あり＝実行されて合格／LLM なし＝スキップ表示で全体は合格）
- [ ] プッシュ後、GitHub Actions で pilot-test が緑になることを確認し、portal-test / bot-syntax も緑のままであることを報告に含める

## やらないこと

- テストをモックで誤魔化したり、検証内容を弱めたりすること（環境がある場所では従来どおり実際に呼んで検証する）
- CI に GEMINI_API_KEY のシークレットを追加すること。これは代替案としてあり得るが、シークレット管理を伴うため、ユーザーが別途判断するまで実施しない
- 他のテストファイルや ci.yml の他ジョブの変更

## 完了条件

- GitHub Actions の pilot-test が緑（スキップが混ざる場合は、その旨と理由が報告に明記されていること）
- ローカル実行でも全テストが合格すること
