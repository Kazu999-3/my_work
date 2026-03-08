import discord
from discord import app_commands

def check_decorators():
    print(f"app_commands.allowed_installs: {hasattr(app_commands, 'allowed_installs')}")
    print(f"app_commands.allowed_contexts: {hasattr(app_commands, 'allowed_contexts')}")

if __name__ == "__main__":
    check_decorators()
