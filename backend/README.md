# Snaek Discord Bot

Discord bot (discord.py) for value lookup and updating item values. Uses the same Supabase database as the web app.

## Commands

- **`/value <gun> <skin>`** — Look up values for a skin (e.g. `/value ak47 glo`). Shows base, DG, CK, upg, and status.
- **`/set value <gun> <skin> <field> <value>`** — Set a value field for a skin. Field: `base`, `dg`, `ck`, `upg`, or `status`. Example: `/set value ak47 glo base 270000` or `/set value ak47 glo status Decent`.

## Local setup

1. Create a Discord application and bot at [Discord Developer Portal](https://discord.com/developers/applications). Copy the bot token.
2. Copy `.env.example` to `.env` and set:
   - `DISCORD_TOKEN` — bot token
   - `SUPABASE_URL` — same as web app (e.g. `NEXT_PUBLIC_SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY` — required for `/set value` (writes to Supabase)
3. Create a virtualenv and install deps:

   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. Run the bot:

   ```bash
   python bot.py
   ```

5. Invite the bot to your server (OAuth2 → URL Generator, scopes: `bot`, `applications.commands`).

## Hosting on Render

1. Push this repo (with `backend/`) to GitHub.
2. In [Render](https://render.com): **New → Background Worker**.
3. Connect the repo and set:
   - **Root Directory**: `backend`
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python bot.py`
4. Add environment variables in the Render dashboard:
   - `DISCORD_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy. The worker runs the bot 24/7.

No web server or health check URL is required for a background worker.
