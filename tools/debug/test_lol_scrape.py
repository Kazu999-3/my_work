import requests
import re

def test_lolalytics():
    url = "https://lolalytics.com/lol/yasuo/vs/yone/build/?lane=middle"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        res = requests.get(url, headers=headers, timeout=10)
        print(f"Lolalytics Status: {res.status_code}")
        # 勝率を探す (XX.XX%)
        match = re.search(r'(\d+\.\d+)%', res.text)
        if match:
            print(f"Found percentage: {match.group(1)}%")
        else:
            print("Percentage not found in raw HTML.")
    except Exception as e:
        print(f"Lolalytics Error: {e}")

def test_dpm():
    url = "https://dpm.lol/studio/clear/champion"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        res = requests.get(url, headers=headers, timeout=10)
        print(f"DPM.LOL Status: {res.status_code}")
        if res.status_code == 200:
            print("Successfully fetched DPM.LOL!")
            # 適当なチャンピオンのタイムを探す
            match = re.search(r'Lee Sin.*?(\d+m\s*\d+s)', res.text, re.S)
            if match:
                print(f"Found Lee Sin time: {match.group(1)}")
    except Exception as e:
        print(f"DPM.LOL Error: {e}")

if __name__ == "__main__":
    test_lolalytics()
    test_dpm()
