import { Client, GatewayIntentBits } from 'discord.js';
import express from 'express';
import { createServer } from 'http';
import { registerCommands, handleCommand, handleGuess } from './commands.js';
import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Discord bot setup
client.once('ready', () => {
    console.log('Discord bot is ready!');
    registerCommands(client);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        try {
            await handleCommand(interaction);
        } catch (error) {
            console.error('Error handling command:', error);
            await interaction.reply({ content: 'コマンドが正常に処理されませんでした', ephemeral: true });
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return; // Ignore bot messages

    // Debug log
    console.log('Message received:', message.content);

    try {
        await handleGuess(message);
    } catch (error) {
        console.error('Error handling guess:', error);
    }
});

client.login(process.env.TOKEN);

// Express server setup
const app = express();

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

const port = process.env.PORT || 3000;
const server = createServer(app);

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Ensure Puppeteer is installed and configured correctly
async function ensurePuppeteer() {
    try {
        // Check if Puppeteer is installed
        execSync('npx puppeteer --version', { stdio: 'ignore' });
    } catch (error) {
        console.error('Puppeteer is not installed. Installing...');
        execSync('npx puppeteer install', { stdio: 'inherit' });
    }
}

ensurePuppeteer().catch(console.error);
