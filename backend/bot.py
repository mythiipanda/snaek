"""
Snaek Discord bot: value lookup and set value via slash commands.
Uses Supabase for data (same DB as the web app).
"""

import os
import logging
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("snaek-bot")

# Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Value field names for DB and display
VALUE_FIELDS = {"base": "base_value", "dg": "dg_value", "ck": "ck_value", "upg": "upg_value", "status": "status"}


def find_item(gun: str, skin: str) -> Optional[dict]:
    """Find one item by gun + skin_name (case-insensitive)."""
    gun_norm = gun.strip().lower()
    skin_norm = skin.strip().lower()
    if not gun_norm or not skin_norm:
        return None
    r = supabase.table("items").select("id, group_name, gun, skin_name, base_value, dg_value, ck_value, upg_value, status").eq("gun", gun_norm).execute()
    if not r.data:
        return None
    for row in r.data:
        if (row.get("skin_name") or "").strip().lower() == skin_norm:
            return row
    return None


def format_value(v) -> str:
    if v is None:
        return "—"
    return str(v)


def build_value_embed(item: dict) -> discord.Embed:
    title = f"{item['gun'].upper()} · {item['skin_name']}"
    embed = discord.Embed(title=title, color=discord.Color.blue())
    embed.add_field(name="Base", value=format_value(item.get("base_value")), inline=True)
    embed.add_field(name="DG", value=format_value(item.get("dg_value")), inline=True)
    embed.add_field(name="CK", value=format_value(item.get("ck_value")), inline=True)
    embed.add_field(name="Upg", value=format_value(item.get("upg_value")), inline=True)
    embed.add_field(name="Status", value=format_value(item.get("status")), inline=True)
    return embed


# Bot
intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def on_ready():
    logger.info("Bot ready as %s", bot.user)
    try:
        synced = await bot.tree.sync()
        logger.info("Synced %s command(s)", len(synced))
    except Exception as e:
        logger.exception("Failed to sync commands: %s", e)


@bot.tree.command(name="value", description="Look up values for a gun skin (e.g. AK47 Glo)")
@app_commands.describe(gun="Gun or item type (e.g. ak47, awp, karambit)")
@app_commands.describe(skin="Skin name (e.g. glo, ace)")
async def value_cmd(interaction: discord.Interaction, gun: str, skin: str):
    await interaction.response.defer(ephemeral=False)
    item = find_item(gun, skin)
    if not item:
        await interaction.followup.send(f"No item found for **{gun}** / **{skin}**. Check spelling and try again.", ephemeral=True)
        return
    embed = build_value_embed(item)
    await interaction.followup.send(embed=embed)


@bot.tree.command(name="set", description="Set a value field for a gun skin (base/dg/ck/upg/status)")
@app_commands.describe(
    subcommand="Use 'value' to set item values",
    gun="Gun or item type (e.g. ak47)",
    skin="Skin name (e.g. glo)",
    field="Which value to set: base, dg, ck, upg, or status",
    value="New value (number or text)",
)
async def set_cmd(interaction: discord.Interaction, subcommand: str, gun: str, skin: str, field: str, value: str):
    if subcommand.lower() != "value":
        await interaction.response.send_message("Use `/set value <gun> <skin> <field> <value>`. Field: base, dg, ck, upg, status.", ephemeral=True)
        return
    field_lower = field.strip().lower()
    if field_lower not in VALUE_FIELDS:
        await interaction.response.send_message(f"Invalid field. Use one of: base, dg, ck, upg, status.", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    item = find_item(gun, skin)
    if not item:
        await interaction.followup.send(f"No item found for **{gun}** / **{skin}**.", ephemeral=True)
        return
    col = VALUE_FIELDS[field_lower]
    # Normalize value for base_value (numeric) vs others (string)
    if col == "base_value":
        try:
            payload = {col: int(value.strip())}
        except ValueError:
            try:
                payload = {col: float(value.strip())}
            except ValueError:
                await interaction.followup.send("For **base** use a number.", ephemeral=True)
                return
    else:
        payload = {col: value.strip() or None}
    upd = supabase.table("items").update(payload).eq("id", item["id"]).execute()
    if upd.data:
        await interaction.followup.send(f"Updated **{item['gun']}** · **{item['skin_name']}** — **{field_lower}** = `{value.strip()}`.", ephemeral=True)
    else:
        await interaction.followup.send("Update may have failed; check Supabase.", ephemeral=True)


def main():
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        raise RuntimeError("Set DISCORD_TOKEN in .env")
    bot.run(token)


if __name__ == "__main__":
    main()
