"""Discord bot MVP for valuelist.

Provides a `/price` slash command that returns price and an embedded image URL.
"""
from __future__ import annotations

import os
import asyncio

import discord
from discord import app_commands

from valuelist.database.db_manager import DBManager

TOKEN = os.environ.get("DISCORD_TOKEN")
DB_PATH = os.environ.get("VALUE_DB", "valuelist/database/valuelist.db")


class ValuelistBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        self.db = DBManager(DB_PATH)

    async def setup_hook(self) -> None:
        @self.tree.command(name="price", description="Get price for a Counter Blox item")
        async def price_command(interaction: discord.Interaction, item: str):
            await interaction.response.defer()
            res = await self.db.get_price_by_name(item)
            if not res:
                await interaction.followup.send(f"Item not found: {item}")
                return
            image_url = await self.db.get_primary_image(res["item_id"])
            embed = discord.Embed(title=item, description=f"Price: {res['price']} {res['currency']}")
            if image_url:
                embed.set_image(url=image_url)
            await interaction.followup.send(embed=embed)


def main():
    if not TOKEN:
        raise RuntimeError("DISCORD_TOKEN not set")
    bot = ValuelistBot()
    bot.run(TOKEN)


if __name__ == "__main__":
    main()
