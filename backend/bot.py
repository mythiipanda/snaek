"""
Snaek Discord bot: value lookup and set value via slash commands.
Uses Supabase for data (same DB as the web app).
"""

import asyncio
import os
import signal
import logging
import threading
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
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

# Owner: only this Discord user can add/remove admins. Owner + admins can use /set.
OWNER_ID = 470431863316414465

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
        "id, group_name, gun, skin_name, base_value, dg_value, ck_value, upg_value, status, image_url, updated_at"
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


def _is_owner(user_id: int) -> bool:
    return user_id == OWNER_ID


def _is_admin_sync(user_id: int) -> bool:
    """Check if user_id is in the admins table (sync; for use after we have cached or quick check)."""
    try:
        r = supabase.table("admins").select("user_id").eq("user_id", str(user_id)).execute()
        return bool(r.data and len(r.data) > 0)
    except Exception:
        return False


async def _can_set_values(user_id: int) -> bool:
    """True if user is owner or listed in admins table."""
    if _is_owner(user_id):
        return True
    return _is_admin_sync(user_id)


def format_updated_at(updated_at) -> str:
    """Format updated_at (ISO string or None) for display."""
    if not updated_at:
        return "—"
    try:
        # Parse ISO and show short date
        dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        return dt.strftime("%b %d, %Y")
    except (ValueError, TypeError):
        return "—"


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
    embed.add_field(name="Last updated", value=format_updated_at(item.get("updated_at")), inline=True)
    embed.set_footer(text="DM mythiipanda for features/bugs")
    return embed


VALUE_LIST_URL = "https://snaekvaluelist.netlify.app/"


def build_link_view() -> discord.ui.View:
    """View with link button to the value list website."""
    view = discord.ui.View()
    view.add_item(
        discord.ui.Button(
            style=discord.ButtonStyle.link,
            url=VALUE_LIST_URL,
            label="Snaek's Value List (Website)",
        )
    )
    return view


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
    await interaction.followup.send(embed=embed, view=build_link_view())


@bot.tree.command(name="set", description="Set a value field for a gun skin (base/dg/ck/upg/status)")
@app_commands.describe(
    gun="Gun or item type (e.g. ak47)",
    skin="Skin name (e.g. glo)",
    field="Which value to set: base, dg, ck, upg, or status",
    value="New value (number or text)",
)
@app_commands.autocomplete(gun=gun_autocomplete, skin=skin_autocomplete, field=field_autocomplete)
async def set_cmd(interaction: discord.Interaction, gun: str, skin: str, field: str, value: str):
    if not await _can_set_values(interaction.user.id):
        await interaction.response.send_message(
            "You don't have permission to set values. Only the owner and added admins can use `/set`.",
            ephemeral=True,
        )
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
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    upd = supabase.table("items").update(payload).eq("id", item["id"]).execute()
    if upd.data:
        await interaction.followup.send(f"Updated **{item['gun']}** · **{item['skin_name']}** — **{field_lower}** = `{value.strip()}`.", ephemeral=True)
    else:
        await interaction.followup.send("Update may have failed; check Supabase.", ephemeral=True)


@bot.tree.command(name="addadmin", description="Add an admin who can use /set (owner only)")
@app_commands.describe(user="User to grant admin (they will be able to set values)")
async def addadmin_cmd(interaction: discord.Interaction, user: discord.User):
    if interaction.user.id != OWNER_ID:
        await interaction.response.send_message("Only the owner can add admins.", ephemeral=True)
        return
    if user.bot:
        await interaction.response.send_message("Cannot add bots as admins.", ephemeral=True)
        return
    if user.id == OWNER_ID:
        await interaction.response.send_message("The owner is already allowed; no need to add.", ephemeral=True)
        return
    try:
        supabase.table("admins").insert({
            "user_id": str(user.id),
            "added_by": str(interaction.user.id),
        }).execute()
        await interaction.response.send_message(f"**{user.display_name}** (`{user.id}`) is now an admin and can use `/set`.", ephemeral=True)
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            await interaction.response.send_message(f"**{user.display_name}** is already an admin.", ephemeral=True)
        else:
            logger.exception("addadmin failed: %s", e)
            await interaction.response.send_message("Failed to add admin. Check logs.", ephemeral=True)


@bot.tree.command(name="removeadmin", description="Remove an admin (owner only)")
@app_commands.describe(user="User to remove admin from")
async def removeadmin_cmd(interaction: discord.Interaction, user: discord.User):
    if interaction.user.id != OWNER_ID:
        await interaction.response.send_message("Only the owner can remove admins.", ephemeral=True)
        return
    try:
        r = supabase.table("admins").delete().eq("user_id", str(user.id)).execute()
        deleted = r.data if r.data is not None else []
        if len(deleted) > 0:
            await interaction.response.send_message(f"**{user.display_name}** is no longer an admin.", ephemeral=True)
        else:
            await interaction.response.send_message(f"**{user.display_name}** was not in the admin list.", ephemeral=True)
    except Exception as e:
        logger.exception("removeadmin failed: %s", e)
        await interaction.response.send_message("Failed to remove admin. Check logs.", ephemeral=True)


@bot.tree.command(name="listadmins", description="List users who can use /set (owner only)")
async def listadmins_cmd(interaction: discord.Interaction):
    if interaction.user.id != OWNER_ID:
        await interaction.response.send_message("Only the owner can list admins.", ephemeral=True)
        return
    try:
        r = supabase.table("admins").select("user_id, added_by, created_at").order("created_at").execute()
        rows = r.data or []
    except Exception as e:
        logger.exception("listadmins failed: %s", e)
        await interaction.response.send_message("Failed to load admins. Ensure the `admins` table exists (run supabase_admins.sql in Supabase).", ephemeral=True)
        return
    lines = ["**Owner** (you): can use `/set`, add/remove admins."]
    for row in rows:
        uid = row.get("user_id") or ""
        lines.append(f"• Admin: `{uid}` (added by `{row.get('added_by', '')}`)")
    if len(lines) == 1:
        lines.append("_No other admins._")
    await interaction.response.send_message("\n".join(lines), ephemeral=True)


def _start_health_server_if_needed() -> None:
    """If PORT is set (e.g. Azure App Service), run a minimal HTTP server so health checks succeed."""
    port_str = os.environ.get("PORT")
    if not port_str:
        return
    try:
        port = int(port_str)
    except ValueError:
        return

    class _HealthHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"ok")
        def log_message(self, *args):  # noqa: N802
            pass

    def serve():
        with HTTPServer(("", port), _HealthHandler) as httpd:
            httpd.serve_forever()

    t = threading.Thread(target=serve, daemon=True)
    t.start()
    logger.info("Health server listening on port %s", port)


def main():
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        raise RuntimeError("Set DISCORD_TOKEN in .env")

    # Graceful shutdown when Azure (or other host) sends SIGTERM
    def _on_sigterm(*_args):
        logger.info("SIGTERM received, closing bot")
        asyncio.run_coroutine_threadsafe(bot.close(), bot.loop)

    signal.signal(signal.SIGTERM, _on_sigterm)

    _start_health_server_if_needed()
    bot.run(token)


if __name__ == "__main__":
    main()
