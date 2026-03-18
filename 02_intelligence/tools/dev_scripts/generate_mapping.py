import requests

def generate_mapping():
    # 最新バージョンを取得
    ver_res = requests.get("https://ddragon.leagueoflegends.com/api/versions.json")
    version = ver_res.json()[0]
    print(f"Using version: {version}")
    
    url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/ja_JP/champion.json"
    res = requests.get(url)
    data = res.json()["data"]
    
    mapping = {}
    for name, info in data.items():
        mapping[int(info["key"])] = info["name"]
    
    with open(r"d:\my_work\apps\hybrid_bot\src\champ_id_map.py", "w", encoding="utf-8") as f:
        f.write("# Auto-generated Champion ID -> Name mapping\n")
        f.write(f"# Version: {version}\n")
        f.write("CHAMPION_ID_TO_NAME = " + str(mapping))

if __name__ == "__main__":
    generate_mapping()
