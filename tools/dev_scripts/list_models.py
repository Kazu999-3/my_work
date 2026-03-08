import os
from google import genai
from dotenv import load_dotenv

env_path = r"d:\my_work\apps\hybrid_bot\.env"
print(f"Loading env from: {env_path}")
load_dotenv(env_path)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("API Key still not found.")
    exit()

client = genai.Client(api_key=GEMINI_API_KEY)

print("--- Available Models ---")
try:
    for model in client.models.list():
        print(f"Name: {model.name}")
except Exception as e:
    print(f"Error: {e}")
