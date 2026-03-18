import os
import sys
import datetime
import argparse
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

# Windowsコンソールでの絵文字出力エラー（cp932）回避
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# パスの設定
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
AGENT_DIR = ROOT_DIR / ".agent"
SKILLS_DIR = AGENT_DIR / "skills"
DRAFT_DIR = ROOT_DIR / "outputs" / "draft"

# .env の読み込み
load_dotenv(ROOT_DIR / ".env")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# モデル定数の読み込み
MODEL_PRO = os.getenv("MODEL_PRO", "gemini-2.5-pro")
MODEL_FLASH = os.getenv("MODEL_FLASH", "gemini-1.5-flash")
DEFAULT_MODEL_NAME = os.getenv("DEFAULT_MODEL", "gemini-1.5-flash")

if not GEMINI_API_KEY:
    print("エラー: GEMINI_API_KEY が .env に設定されていません。")
    print(f"期待するファイルパス: {ROOT_DIR / '.env'}")
    sys.exit(1)

# 引数解析
parser = argparse.ArgumentParser(description="AI Article Pipeline")
parser.add_argument("topic", help="執筆するお題")
parser.add_argument("-m", "--model", choices=["Flash", "Pro", "Auto"], default="Auto", help="使用するモデルを選択")
args, unknown = parser.parse_known_args()

def get_model(model_type: str):
    """モデルタイプに応じたGenerativeModelインスタンスを返す"""
    name = MODEL_PRO if model_type == "Pro" else MODEL_FLASH
    return genai.GenerativeModel(name)

def generate_with_fallback(prompt: str, preferred_model: str = "Auto") -> str:
    """
    モデルの実行と失敗時のフォールバック処理を行う
    Auto の場合は Pro -> Flash の順で試行する
    """
    # 試行するモデルの順番を決定
    model_sequence = []
    if preferred_model == "Pro":
        model_sequence = ["Pro", "Flash"]
    elif preferred_model == "Flash":
        model_sequence = ["Flash"]
    else: # Auto
        model_sequence = ["Pro", "Flash"]

    for m_type in model_sequence:
        try:
            m_name = MODEL_PRO if m_type == "Pro" else MODEL_FLASH
            print(f"🤖 使用モデル: {m_name} ({m_type})")
            temp_model = genai.GenerativeModel(m_name)
            response = temp_model.generate_content(prompt)
            return response.text
        except Exception as e:
            if "429" in str(e) and m_type == "Pro" and "Flash" in model_sequence:
                print(f"⚠️ Proのクォータ上限に達しました。Flashに切り替えて再試行します...")
                continue
            raise e
    return ""

genai.configure(api_key=GEMINI_API_KEY)

def read_skill(skill_name: str) -> str:
    """指定されたスキルの要件定義（マークダウン）を読み込む"""
    skill_path = SKILLS_DIR / skill_name
    if not skill_path.exists():
        raise FileNotFoundError(f"スキルファイルが見つかりません: {skill_path}")
    with open(skill_path, "r", encoding="utf-8") as f:
        return f.read()

def run_deep_research(topic: str) -> str:
    """
    Step 1: LoLの深いリサーチを実行する
    """
    print(f"🔍 [{topic}] のディープリサーチを開始します...")
    skill_prompt = read_skill("lol_deep_research.md")
    
    prompt = f"""
あなたは世界最高のLeague of Legendsリサーチャーです。
以下のスキル（手順書）に厳密に従い、指定されたトピックのリサーチを実行してください。

[実行トピック]
{topic}

[適用するスキル（手順書）]
{skill_prompt}

出力のみを提出してください。
"""
    return generate_with_fallback(prompt, args.model)

def run_article_drafting(topic: str, research_data: str) -> str:
    """
    Step 2: リサーチ結果からnoteの記事ドラフト＆X投稿文を生成する
    """
    print(f"✍️ [{topic}] の記事およびX投稿ドラフトを生成します...")
    skill_prompt = read_skill("note_article_drafter.md")
    
    prompt = f"""
あなたはLoL情報発信のトップクリエイター・軍師です。
以下のスキル（フォーマットとルール）に厳密に従い、提供されたリサーチ結果を基にXのプロモーション文とnote記事の下書きを作成してください。

[テーマ]
{topic}

[提供されたリサーチ結果]
{research_data}

[適用するスキル（フォーマットとルール）]
{skill_prompt}

出力のみを提出してください。
"""
    return generate_with_fallback(prompt, args.model)

def main(topic: str):
    """
    AIコンベアベルトのメイン処理
    """
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    # Windowsのファイル名で使用禁止の文字をサニタイズ
    invalid_chars = r'<>:"/\|?*'
    safe_topic = topic
    for char in invalid_chars:
        safe_topic = safe_topic.replace(char, "_")
    safe_topic = safe_topic.replace(" ", "_").strip("_")
    
    # DRAFT_DIR の作成確認
    DRAFT_DIR.mkdir(parents=True, exist_ok=True)
    
    try:
        # 1. リサーチフェーズ
        research_result = run_deep_research(topic)
        research_path = DRAFT_DIR / f"{safe_topic}_research_{timestamp}.md"
        with open(research_path, "w", encoding="utf-8") as f:
            f.write(research_result)
        print(f"✅ リサーチ結果を保存しました: {research_path}")
        
        # 2. ドラフト生成フェーズ
        draft_result = run_article_drafting(topic, research_result)
        draft_path = DRAFT_DIR / f"{safe_topic}_draft_{timestamp}.md"
        with open(draft_path, "w", encoding="utf-8") as f:
            f.write(draft_result)
        print(f"✅ 記事ドラフトを保存しました: {draft_path}")
        
        print("\n🎉 AIパイプラインの実行が正常に完了しました！")
        
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main(args.topic)
