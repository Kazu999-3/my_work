import re
import sys
import os
import traceback

class StyleAuditor:
    def __init__(self, prohibited_patterns_path, tone_path):
        print(f"Loading patterns from: {prohibited_patterns_path}")
        self.prohibited_patterns = self._load_patterns(prohibited_patterns_path)
        print(f"Loaded {len(self.prohibited_patterns)} patterns.")
        
        self.tone_rules = self._load_text(tone_path)

    def _load_patterns(self, path):
        patterns = []
        if not os.path.exists(path):
            return patterns
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    if "|" in line:
                        parts = [p.strip() for p in line.split("|")]
                        if len(parts) >= 4: # | 禁止 | 理由 | 案 |
                            word = parts[1].replace("**", "").replace("「", "").replace("」", "").replace("！", "").replace("!", "").strip()
                            replacement = parts[3].strip()
                            if word and word not in ["禁止表現", "---", ":---"]:
                                patterns.append({"word": word, "replacement": replacement})
        except Exception as e:
            print(f"Error loading patterns: {e}")
        return patterns

    def _load_text(self, path):
        if not os.path.exists(path): return ""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
        except: return ""

    def audit(self, file_path):
        abs_path = os.path.abspath(file_path)
        if not os.path.exists(abs_path):
            return [f"Error: File {abs_path} not found."], ""

        try:
            with open(abs_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
        except Exception as e:
            return [f"Error reading file: {e}"], ""

        results = []
        modified_content = original_content

        # 1. 禁止表現のチェック
        for p in self.prohibited_patterns:
            # 大文字小文字や記号の差異を許容するために正規表現で検索
            if p["word"] in modified_content:
                count = modified_content.count(p["word"])
                results.append(f"Found prohibited word: '{p['word']}' ({count} times). Suggestion: {p['replacement']}")
                modified_content = modified_content.replace(p["word"], f"[[FIX: {p['replacement']}]]")

        # 2. 無駄な太字のチェック (**)
        bold_count = len(re.findall(r'\*\*.*?\*\*', modified_content))
        if bold_count > 5:
            results.append(f"Warning: Excessive bold markers found ({bold_count}). Consider reducing for readability.")

        # 3. 文字数チェック
        char_count = len(original_content)
        results.append(f"Character count: {char_count}")
        if char_count < 3000:
            results.append("Warning: Content is less than 3000 characters (Target for note articles).")

        return results, modified_content

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            print("Usage: py style_auditor.py <target_file>")
            sys.exit(1)

        base_dir = "d:/my_work"
        prohibited_path = os.path.join(base_dir, "01_spirit/style/prohibited_patterns.md")
        tone_path = os.path.join(base_dir, "01_spirit/style/tone.md")
        
        auditor = StyleAuditor(prohibited_path, tone_path)
        report, preview = auditor.audit(sys.argv[1])

        print("\n--- STYLE AUDIT REPORT ---")
        for line in report:
            print(f"- {line}")
        print("\n--- CONTENT PREVIEW (WITH FIX TAGS) ---")
        print(preview[:1500] + "..." if len(preview) > 1500 else preview)
    except Exception:
        traceback.print_exc()
        sys.exit(1)
