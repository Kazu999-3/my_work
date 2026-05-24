import glob

def replace_in_files():
    files = glob.glob('d:/my_work/02_ENGINE/v2_CORE/**/*.py', recursive=True)
    for file in files:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content.replace('gemini-2.0-flash', 'gemini-2.5-flash')
        new_content = new_content.replace('gemini-flash-latest', 'gemini-2.5-flash')
        new_content = new_content.replace('gemini-flash-lite-latest', 'gemini-2.5-flash')
        
        if new_content != content:
            with open(file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated {file}')

if __name__ == '__main__':
    replace_in_files()
