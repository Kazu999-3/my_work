import discord
from discord import app_commands
import inspect

def debug_attributes():
    print(f"discord.py version: {discord.__version__}")
    print("\nAttributes in discord.app_commands:")
    for name, obj in inspect.getmembers(app_commands):
        if any(keyword in name for keyword in ["Context", "Install", "Integration"]):
            print(f"- {name}")

if __name__ == "__main__":
    debug_attributes()
