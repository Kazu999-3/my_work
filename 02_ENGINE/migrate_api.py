import os
import re

def migrate_to_safe(dir_path):
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if not file.endswith(".py"): continue
            
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
                
            if "models.generate_content" not in content:
                continue
                
            print(f"Migrating {filepath}...")
            
            # Make sure import is present
            if "from v2_CORE.ai_helper import generate_content_safe" not in content and "from .ai_helper import generate_content_safe" not in content:
                content = re.sub(r'(from google import genai)', r'\1\nfrom v2_CORE.ai_helper import generate_content_safe', content)
            
            # This regex looks for self.client.models.generate_content(...) or client.models.generate_content(...)
            # and replaces it. Since they span multiple lines, we need a robust approach.
            # We'll use a regex that matches:
            # response = <client>.models.generate_content(
            #     model=<model>,
            #     contents=<prompt>,
            #     config=<config>
            # )
            
            # Since regex for multi-line nested parens is hard, we'll do a simpler replacement if possible, 
            # or just write a small parser.
            
            # Actually, let's just replace the exact substrings since they usually follow a standard format.
            # Look at oracle.py for example:
            # response = self.client.models.generate_content(
            #     model=settings.DEFAULT_MODEL,
            #     contents=prompt
            # )
            
            pattern = re.compile(r'(\w+)\s*=\s*(self\.client|client)\.models\.generate_content\s*\(\s*model=([^,]+),\s*contents=([^,)]+)(?:,\s*config=([^)]+))?\s*\)', re.MULTILINE)
            
            def replacer(match):
                var_name = match.group(1)
                client_str = match.group(2)
                model_str = match.group(3)
                contents_str = match.group(4)
                config_str = match.group(5)
                
                config_arg = f", config={config_str}" if config_str else ""
                
                return f'{var_name}_text = generate_content_safe({client_str}, {contents_str}, {model_str}{config_arg})\n' + \
                       f'            class DummyResponse: text = {var_name}_text\n' + \
                       f'            {var_name} = DummyResponse()'
                       
            new_content = pattern.sub(replacer, content)
            
            if new_content != content:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"  -> Replaced successfully.")

migrate_to_safe("d:/my_work/02_ENGINE/v2_CORE")
migrate_to_safe("d:/my_work/02_ENGINE/LEGACY")
