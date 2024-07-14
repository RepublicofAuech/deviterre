import { Client, GatewayIntentBits } from 'discord.js';
import { registerCommands, handleCommand, handleGuess } from './commands.js';
import express from 'express';
import { createServer } from 'http';
import process from 'process';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log('Ready!');
    registerCommands(client);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        await handleCommand(interaction);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return; // Ignore bot messages

    // デバッグログを追加
    console.log('Message received:', message.content);

    // `handleGuess` 関数を呼び出す
    await handleGuess(message);
});

client.login(process.env.TOKEN);

// Flaskサーバーの追加
const app = express();

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

const port = process.env.PORT || 3000;
const server = createServer(app);

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
