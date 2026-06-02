import os

root_dir = "d:/my_work"
exclude_dirs = {".git", ".venv", "node_modules", ".next", "dist", ".wrangler", "__pycache__", ".temp"}
replacements = {
    "03_SYSTEMS": "03_SYSTEMS",
    ".agent/skills": ".agent/skills",
    "02_FACTORY": "02_FACTORY",
    "02_FACTORY": "02_FACTORY",
    "04_PORTAL": "04_PORTAL",
    "99_ARCHIVE/04_COMMAND_CENTER_old": "99_ARCHIVE/99_ARCHIVE/04_COMMAND_CENTER_old_old"
}

for root, dirs, files in os.walk(root_dir):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for file in files:
        if file.endswith((".py", ".md", ".tsx", ".ts", ".bat", ".yml", "Dockerfile", "package.json")):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                
                changed = False
                for old_val, new_val in replacements.items():
                    if old_val in content:
                        content = content.replace(old_val, new_val)
                        changed = True
                
                if changed:
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(content)
                    print(f"Updated: {filepath}")
            except Exception as e:
                pass
