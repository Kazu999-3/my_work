import discord
from discord import app_commands
import inspect

def investigate():
    @app_commands.command(name="test")
    @app_commands.allowed_installs(guilds=True, users=True)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    async def test_cmd(itx): pass
    
    print(f"Command object: {test_cmd}")
    print(f"Attributes of Command object:")
    for attr in dir(test_cmd):
        if not attr.startswith("__"):
            val = getattr(test_cmd, attr)
            if any(k in attr.lower() for k in ["install", "context"]):
                print(f"  {attr}: {val} (Type: {type(val)})")

    # 内部メンバを確認
    print("\nInternal members (starting with _):")
    for attr in dir(test_cmd):
        if attr.startswith("_") and not attr.startswith("__"):
            val = getattr(test_cmd, attr)
            if any(k in attr.lower() for k in ["install", "context"]):
                print(f"  {attr}: {val}")

if __name__ == "__main__":
    investigate()
