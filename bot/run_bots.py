import asyncio
import logging

import discord
from discord import app_commands
from telegram import BotCommand, Update
from telegram.error import Conflict
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from db import SessionLocal
from api.bot_links import BOT_COMMANDS, build_bot_response, upsert_platform_identity
from bot.config import DISCORD_BOT_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_USER_BOT_TOKEN
from bot.discord_bot import handle_discord_dm, sync_discord_dm_identity


logging.basicConfig(level=logging.INFO)

TELEGRAM_COMMANDS = [
    BotCommand(item["command"].lstrip("/").split()[0], item["description"])
    for item in BOT_COMMANDS
]

DISCORD_COMMANDS = [
    (item["command"].lstrip("/").split()[0], item["description"])
    for item in BOT_COMMANDS
]

logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("bot-runner")


def _discord_response_embed(command_name: str, reply: str) -> discord.Embed:
    titles = {
        "start": "Hướng dẫn bot",
        "help": "Danh sách lệnh",
        "link": "Liên kết tài khoản",
        "status": "Trạng thái liên kết",
        "account": "Thông tin tài khoản",
        "orders": "Đơn hàng gần đây",
        "support": "Thông tin hỗ trợ",
        "unlink": "Gỡ liên kết",
    }
    embed = discord.Embed(
        title=titles.get(command_name, "Thông báo"),
        description=reply or "OK",
        color=0x5865F2,
    )
    return embed



def _discord_username(user: discord.User) -> str:
    return getattr(user, "global_name", None) or getattr(user, "name", "") or ""


async def _run_discord_bot():
    if not DISCORD_BOT_TOKEN:
        logger.info("Discord bot token missing, skip Discord runner")
        return

    intents = discord.Intents.default()
    intents.message_content = True
    intents.dm_messages = True

    class ShopBot(discord.Client):
        def __init__(self):
            super().__init__(intents=intents)
            self.tree = app_commands.CommandTree(self)

        async def setup_hook(self):
            def make_simple_callback(command_name: str):
                async def callback(interaction: discord.Interaction):
                    sync_discord_dm_identity(
                        str(interaction.user.id),
                        platform_username=_discord_username(interaction.user),
                        metadata={"source": "discord_slash"},
                    )
                    reply = handle_discord_dm(str(interaction.user.id), f"/{command_name}")
                    await interaction.response.send_message(embed=_discord_response_embed(command_name, reply), ephemeral=False)
                return callback

            async def link_callback(interaction: discord.Interaction, code: str):
                sync_discord_dm_identity(
                    str(interaction.user.id),
                    platform_username=_discord_username(interaction.user),
                    metadata={"source": "discord_slash"},
                )
                reply = handle_discord_dm(str(interaction.user.id), f"/link {code}")
                await interaction.response.send_message(embed=_discord_response_embed("link", reply), ephemeral=False)

            link_callback = app_commands.describe(code="Mã liên kết từ trang tài khoản")(link_callback)
            for name, description in DISCORD_COMMANDS:
                callback = link_callback if name == "link" else make_simple_callback(name)
                command = app_commands.Command(name=name, description=description[:100], callback=callback)
                self.tree.add_command(command)
            await self.tree.sync()
            logger.info("Discord slash commands synced")

    client = ShopBot()

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
    await app.bot.set_my_commands(TELEGRAM_COMMANDS)
    await app.start()

    def polling_error_callback(exc):
        if isinstance(exc, Conflict):
            logger.warning("%s bot polling conflict; another instance is already polling this token", label)
            return
        logger.error("%s bot polling error: %s", label, exc, exc_info=True)

    await app.updater.start_polling(drop_pending_updates=True, error_callback=polling_error_callback)
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
    try:
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
        for task in done:
            exc = task.exception()
            if exc:
                logger.error("Bot task failed: %s", exc)
        for task in pending:
            task.cancel()
    except asyncio.CancelledError:
        for task in tasks:
            task.cancel()
        raise


if __name__ == "__main__":
    asyncio.run(main())
