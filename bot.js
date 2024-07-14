import { Client, GatewayIntentBits } from 'discord.js';
import { registerCommands, handleCommand, handleGuess } from './commands.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
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

client.login("MTI2MDQ0MjQ3OTA3ODAxNTE0OA.GGk91t.KsdUiZ0BMDJJc-ToFEp8Bbfu8sMT8s7uquXIcE");
