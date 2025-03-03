# Telegram Join Request Accept Bot

This bot automatically accepts join requests for private Telegram channels after a 1-minute delay and includes a broadcast system.

## Features

- Listens for join requests to your private channel
- Automatically approves requests after a 1-minute delay
- Stores users' information in a local database
- Includes a broadcast panel for sending messages to all users
- Respects Telegram's rate limits when broadcasting

## Setup Instructions

1. Make sure you have Node.js installed
2. Install dependencies: `npm install`
3. Start the bot: `npm start`

## Configuration

The bot token is stored in the `.env` file. Make sure this file is kept secure and not shared publicly.

## Usage

1. Add the bot to your private channel as an admin
2. Give the bot "Add Members" permission
3. The bot will automatically accept join requests after a 1-minute delay
4. Use the admin commands to broadcast messages to all users

## Admin Commands

- `/setadmin` - Set yourself as the admin (use this first)
- `/broadcast [message]` - Send a message to all users
- `/stats` - View bot statistics

## User Commands

- `/start` - Start the bot
- `/help` - Show help message

## Troubleshooting

If the bot doesn't work:
- Ensure the bot has admin privileges in your channel
- Verify the bot has the "Add Members" permission
- Check the console logs for any error messages