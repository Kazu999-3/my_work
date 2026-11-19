"""
LLM Fallback Adapter: Gemini API ➔ Ollama Local Fallback
Gemini APIが429/503等で利用できない場合、または先行事実抽出において
ローカルのOllamaへ自動切り替えする安全アダプター。
"""

import os
import json
import urllib.request
import urllib.error
from typing import Optional

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
ENABLE_LOCAL_EXTRACT = os.environ.get("ENABLE_LOCAL_EXTRACT", "1") not in ("0", "false", "False")


def is_ollama_available() -> bool:
    """ローカルの Ollama が起動しているかヘルスチェック（タイムアウト2秒）"""
    if not ENABLE_LOCAL_EXTRACT:
        return False
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=2) as r:
            if r.status == 200:
                return True
    except Exception:
        return False
    return False


def call_ollama_json(prompt: str, model: Optional[str] = None, temperature: float = 0.2) -> dict:
    """Ollama の OpenAI 互換エンドポイントを叩いて JSON を取得"""
    target_model = model or OLLAMA_MODEL
    url = f"{OLLAMA_BASE_URL}/v1/chat/completions"
    payload = {
        "model": target_model,
        "messages": [
            {
                "role": "system",
                "content": "You are a specialized game analyst. Output only pure, valid JSON with no markdown formatting or commentary."
            },
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": temperature
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=180) as r:
        res = json.loads(r.read().decode("utf-8"))
        content = res["choices"][0]["message"]["content"]
        # Markdownの ```json ... ``` が混ざっていた場合の防御
        clean = content.strip()
        if clean.startswith("```"):
            lines = clean.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            clean = "\n".join(lines).strip()
        return json.loads(clean)


def call_extract_facts_hybrid(prompt: str, api_key: str, model: str, temperature: float = 0.2, log_prefix: str = "抽出") -> dict:
    """事実抽出（ステップ①）:
    ローカルOllamaが稼働していれば先行実行してGeminiトークン消費をゼロにし、
    未起動またはエラー時は自動で Gemini API へ安全フォールバックする。
    """
    if is_ollama_available():
        try:
            print(f"[{log_prefix}] 🏠 ローカルLLM (Ollama: {OLLAMA_MODEL}) で先行事実抽出中（Geminiトークン消費0）...")
            return call_ollama_json(prompt, temperature=temperature)
        except Exception as e:
            print(f"[{log_prefix}] ⚠️ ローカルLLM抽出失敗 ({e})。Gemini APIへ自動フォールバックします。")
    
    # 通常の Gemini API 呼び出し
    from article_pipeline import call_gemini_json
    return call_gemini_json(prompt, api_key, model, max_tokens=8192, temperature=temperature, log_prefix=log_prefix)


if __name__ == "__main__":
    print(f"Checking Ollama at {OLLAMA_BASE_URL}...")
    if is_ollama_available():
        print(f"✅ Ollama is online! Active model: {OLLAMA_MODEL}")
    else:
        print("ℹ️ Ollama is currently offline (will safely fallback to Gemini API).")
