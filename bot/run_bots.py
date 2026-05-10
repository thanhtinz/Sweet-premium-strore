import asyncio
import logging

import discord
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from db import SessionLocal
from api.bot_links import build_bot_response, upsert_platform_identity
from bot.config import DISCORD_BOT_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_USER_BOT_TOKEN
from bot.discord_bot import handle_discord_dm, sync_discord_dm_identity


logging.basicConfig(level=logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("bot-runner")


def _discord_username(user: discord.User) -> str:
    return getattr(user, "global_name", None) or getattr(user, "name", "") or ""


async def _run_discord_bot():
    if not DISCORD_BOT_TOKEN:
        logger.info("Discord bot token missing, skip Discord runner")
        return

    intents = discord.Intents.default()
    intents.message_content = True
    intents.dm_messages = True
    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        logger.info("Discord bot connected")

    @client.event
    async def on_message(message: discord.Message):
        if message.author.bot:
            return
        if message.guild is not None:
            return
        sync_discord_dm_identity(
            str(message.author.id),
            platform_username=_discord_username(message.author),
            dm_channel_id=str(message.channel.id),
            metadata={"source": "discord_dm"},
        )
        reply = handle_discord_dm(str(message.author.id), message.content or "")
        if reply:
            await message.channel.send(reply)

    await client.start(DISCORD_BOT_TOKEN)


async def _telegram_reply(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.effective_message
    user = update.effective_user
    chat = update.effective_chat
    if not message or not user or not chat:
        return
    db = SessionLocal()
    try:
        upsert_platform_identity(
            db,
            platform="telegram",
            platform_user_id=str(chat.id),
            platform_username=user.username or user.full_name,
            dm_channel_id=str(chat.id),
            metadata={"source": "telegram_dm", "telegram_user_id": str(user.id)},
        )
        reply = build_bot_response(db, "telegram", str(chat.id), message.text or "")
    finally:
        db.close()
    if reply:
        await message.reply_text(reply)


async def _run_telegram_bot(token: str, label: str = "Telegram"):
    if not token:
        logger.info("%s bot token missing, skip Telegram runner", label)
        return

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", _telegram_reply))
    app.add_handler(CommandHandler("help", _telegram_reply))
    app.add_handler(CommandHandler("link", _telegram_reply))
    app.add_handler(CommandHandler("status", _telegram_reply))
    app.add_handler(CommandHandler("account", _telegram_reply))
    app.add_handler(CommandHandler("orders", _telegram_reply))
    app.add_handler(CommandHandler("support", _telegram_reply))
    app.add_handler(CommandHandler("unlink", _telegram_reply))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _telegram_reply))

    await app.initialize()
    await app.start()
    await app.updater.start_polling(drop_pending_updates=True)
    logger.info("%s bot polling started", label)
    try:
        await asyncio.Event().wait()
    finally:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()


async def main():
    tasks = []
    if DISCORD_BOT_TOKEN:
        tasks.append(asyncio.create_task(_run_discord_bot()))
    telegram_polling_token = TELEGRAM_USER_BOT_TOKEN or TELEGRAM_BOT_TOKEN
    telegram_label = "Telegram user" if TELEGRAM_USER_BOT_TOKEN else "Telegram admin fallback"
    if telegram_polling_token:
        tasks.append(asyncio.create_task(_run_telegram_bot(telegram_polling_token, telegram_label)))
    if not tasks:
        logger.info("No bot tokens configured, exiting bot runner")
        return
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
    for task in done:
        exc = task.exception()
        if exc:
            raise exc
    for task in pending:
        task.cancel()


if __name__ == "__main__":
    asyncio.run(main())
