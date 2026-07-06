-- 1. agent_prompts テーブルの作成
CREATE TABLE IF NOT EXISTS agent_prompts (
    prompt_id text PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    system_prompt text,
    user_prompt_template text NOT NULL,
    default_model text DEFAULT 'gemini-2.5-flash',
    fallback_model text DEFAULT 'ollama/gemma',
    temperature float DEFAULT 0.2,
    description text
);

-- 2. RLS（行レベルセキュリティ）の有効化
ALTER TABLE agent_prompts ENABLE ROW LEVEL SECURITY;

-- 3. 読み取りポリシー (全員許可)
CREATE POLICY "Allow read" ON agent_prompts FOR SELECT USING (true);

-- 4. 書き込み・更新ポリシー (認証済み管理者のみ)
CREATE POLICY "Allow insert" ON agent_prompts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update" ON agent_prompts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete" ON agent_prompts FOR DELETE TO authenticated USING (true);

-- 5. 初期データ（youtube_bible_forge）の投入
INSERT INTO agent_prompts (
    prompt_id,
    system_prompt,
    user_prompt_template,
    default_model,
    fallback_model,
    temperature,
    description
) VALUES (
'youtube_bible_forge',
    'あなたはLoL（League of Legends）の最上位プレイヤー（チャレンジャー／プロコーチ）です。提供された情報を基に、無駄な雑談を省き、マクロとミクロの戦略にフォーカスした詳細なバイブルを日本語で作成してください。',
    '以下のYouTube動画（タイトル: {title}）の英語字幕テキストと、必要に応じて攻略ライブラリからの関連ナレッジを読み込み、高度な戦略バイブル（Markdown形式）を作成してください。

【対象動画の情報】
URL: {url}

【関連する攻略ライブラリの情報（参考ナレッジ）】
{knowledge_context}

【作成要件】
- 徹底して「LoLのジャングル/マクロ/ミクロの戦略」にフォーカスすること。無駄な雑談や挨拶は省く。
- 攻略ライブラリの情報（参考ナレッジ）がある場合、その内容と重複する基礎情報は適宜まとめ、動画から得られるより深い戦術解説や新しい知見を中心に文章を組み立ててください。
- 全て**日本語**で出力すること。
- **重要**: この動画で言及されるLoLチャンピオンを全て判定し、Markdownの1行目（タイトルの上）に必ず以下の形式で出力すること。
  - チャンピオンが1体の場合: `[Champion: Nocturne]`
  - チャンピオンが複数の場合: `[Champions: Nocturne, Vi, Warwick, Amumu]`（カンマ区切りで全員列挙）
  - 特定のチャンピオンがない汎用解説の場合: `[Champion: Unknown]`
- 構成は以下の通りとする：
[Champion(s): チャンピオン名]
  # {title}
  ## 📌 動画の結論（1行サマリー）
  ## 🧠 マクロ戦略・ルート・判断基準
  （具体的なジャングルルート、なぜその選択をしたかの理由付け）
  ## 🗡️ ミクロ・戦闘のコツ
  （ガンクのタイミング、スキルコンボ、ポジション等）
  ## 💡 重要な金言（名言・Tips）
  ## 🏆 チャンピオン別ポイント（複数チャンピオンの場合）
  （各チャンピオンごとの個別ポイントを箇条書きで記載。1体のみの場合は省略可）

【字幕テキスト】
{transcript}',
    'gemini-2.5-flash',
    'ollama/gemma',
    0.2,
    'YouTube Absorber 用の戦略バイブル（解説記事）自動生成プロンプト（複数チャンピオン対応）'
) ON CONFLICT (prompt_id) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    user_prompt_template = EXCLUDED.user_prompt_template,
    default_model = EXCLUDED.default_model,
    fallback_model = EXCLUDED.fallback_model,
    temperature = EXCLUDED.temperature,
    updated_at = now();
