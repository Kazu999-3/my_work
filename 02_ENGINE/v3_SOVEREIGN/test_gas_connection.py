import requests
import json

url = "https://script.google.com/macros/s/AKfycbwpSuT-cSMkTHz2iUConeLDjdCE9mAHy0SeGOp_krX5OVjHJumpXq7LxIZ3eXFPuZAv/exec"
payload = {"type": "MISSION_GET_QUEUE"}

print(f"Calling: {url}")
try:
    response = requests.post(url, json=payload, timeout=30, allow_redirects=True)
    print(f"Status: {response.status_code}")
    print(f"History: {response.history}")
    print(f"Response: {response.text[:500]}")
    try:
        data = response.json()
        print(f"JSON Data: {data}")
    except:
        print("Failed to parse JSON")
except Exception as e:
    print(f"Error: {e}")
