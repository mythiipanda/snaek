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

# Autocomplete: list of gun names and gun -> [skin_names] (filled at startup)
GUNS_LIST: list[str] = []
SKINS_BY_GUN: dict[str, list[str]] = {}
AUTOCOMPLETE_MAX = 25


def _load_autocomplete_data() -> None:
    """Load distinct guns and skin names from Supabase for autocomplete."""
    global GUNS_LIST, SKINS_BY_GUN
    try:
        r = supabase.table("items").select("gun, skin_name").execute()
        if not r.data:
            return
        by_gun: dict[str, set[str]] = {}
        for row in r.data:
            g = (row.get("gun") or "").strip().lower()
            s = (row.get("skin_name") or "").strip()
            if g and s:
                by_gun.setdefault(g, set()).add(s)
        GUNS_LIST = sorted(by_gun.keys())
        SKINS_BY_GUN = {g: sorted(skins) for g, skins in by_gun.items()}
        logger.info("Autocomplete: %s guns, %s total skins", len(GUNS_LIST), sum(len(s) for s in SKINS_BY_GUN.values()))
    except Exception as e:
        logger.warning("Could not load autocomplete data: %s", e)


def find_item(gun: str, skin: str) -> Optional[dict]:
    """Find one item by gun + skin_name (case-insensitive)."""
    gun_norm = gun.strip().lower()
    skin_norm = skin.strip().lower()
    if not gun_norm or not skin_norm:
        return None
    r = supabase.table("items").select(
        "id, group_name, gun, skin_name, base_value, dg_value, ck_value, upg_value, status, image_url"
    ).eq("gun", gun_norm).execute()
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
    gun_display = (item.get("gun") or "").strip()
    skin_display = (item.get("skin_name") or "").strip()
    title = f"{gun_display.upper()} · {skin_display}"
    embed = discord.Embed(
        title=title,
        description="Value lookup from SNAEK's demand list",
        color=discord.Color.blue(),
    )
    image_url = (item.get("image_url") or "").strip()
    if image_url:
        embed.set_thumbnail(url=image_url)
    embed.add_field(name="Base", value=format_value(item.get("base_value")), inline=True)
    embed.add_field(name="DG", value=format_value(item.get("dg_value")), inline=True)
    embed.add_field(name="CK", value=format_value(item.get("ck_value")), inline=True)
    embed.add_field(name="Upg", value=format_value(item.get("upg_value")), inline=True)
    embed.add_field(name="Status", value=format_value(item.get("status")), inline=True)
    return embed


# Bot
intents = discord.Intents.default()
bot = commands.Bot(command_prefix="!", intents=intents)


async def gun_autocomplete(_interaction: discord.Interaction, current: str) -> list[app_commands.Choice[str]]:
    """Return guns/knives/gloves that match the current typed string."""
    current_lower = current.strip().lower()
    if not GUNS_LIST:
        return []
    if not current_lower:
        return [app_commands.Choice(name=g, value=g) for g in GUNS_LIST[:AUTOCOMPLETE_MAX]]
    matches = [g for g in GUNS_LIST if current_lower in g][:AUTOCOMPLETE_MAX]
    return [app_commands.Choice(name=g, value=g) for g in matches]


async def skin_autocomplete(interaction: discord.Interaction, current: str) -> list[app_commands.Choice[str]]:
    """Return skin names for the selected gun that match the current typed string."""
    gun = (getattr(interaction.namespace, "gun", None) or "").strip().lower()
    if not gun:
        return []
    skins = SKINS_BY_GUN.get(gun, [])
    if not skins:
        return []
    current_lower = current.strip().lower()
    if not current_lower:
        return [app_commands.Choice(name=s, value=s) for s in skins[:AUTOCOMPLETE_MAX]]
    matches = [s for s in skins if current_lower in s.lower()][:AUTOCOMPLETE_MAX]
    return [app_commands.Choice(name=s, value=s) for s in matches]


FIELD_CHOICES = ["base", "dg", "ck", "upg", "status"]


async def field_autocomplete(_interaction: discord.Interaction, current: str) -> list[app_commands.Choice[str]]:
    """Return value field options (base, dg, ck, upg, status) that match the current string."""
    current_lower = current.strip().lower()
    if not current_lower:
        return [app_commands.Choice(name=f, value=f) for f in FIELD_CHOICES]
    matches = [f for f in FIELD_CHOICES if current_lower in f]
    return [app_commands.Choice(name=f, value=f) for f in matches]


@bot.event
async def on_ready():
    logger.info("Bot ready as %s", bot.user)
    _load_autocomplete_data()
    try:
        synced = await bot.tree.sync()
        logger.info("Synced %s command(s)", len(synced))
    except Exception as e:
        logger.exception("Failed to sync commands: %s", e)


@bot.tree.command(name="value", description="Look up values for a gun skin (e.g. AK47 Glo)")
@app_commands.describe(gun="Gun or item type (e.g. ak47, awp, karambit)")
@app_commands.describe(skin="Skin name (e.g. glo, ace)")
@app_commands.autocomplete(gun=gun_autocomplete, skin=skin_autocomplete)
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
    gun="Gun or item type (e.g. ak47)",
    skin="Skin name (e.g. glo)",
    field="Which value to set: base, dg, ck, upg, or status",
    value="New value (number or text)",
)
@app_commands.autocomplete(gun=gun_autocomplete, skin=skin_autocomplete, field=field_autocomplete)
async def set_cmd(interaction: discord.Interaction, gun: str, skin: str, field: str, value: str):
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
