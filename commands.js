import { REST, Routes, EmbedBuilder } from 'discord.js';
import { getRandomStreetViewImage } from './getStreetView.js';
import { promises as fs } from 'fs';

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.TOKEN;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const GUESS_CHANNEL_ID = process.env.GUESS_CHANNEL_ID;

let currentAnswers = null;
let correctUser = null;
let currentLocation = null;
let currentLink = null;
let currentQuestionMessage = null;
let currentMode = null;
let gameInProgress = false; 

let userScores = {
    japan: {},
    world: {}
};

const commands = [
    {
        name: 'gamestart',
        description: 'Googleストリートビューの画像を使った場所当てゲームを始めるよ！',
        options: [
            {
                name: 'モード',
                type: 3, 
                description: 'モードを選んでね！',
                required: true,
                choices: [
                    {
                        name: '日本',
                        value: 'japan'
                    },
                    {
                        name: '世界',
                        value: 'world'
                    }
                ]
            }
        ]
    },
    {
        name: 'score',
        description: '自分の得点を確認するよ！',
        options: [
            {
                name: 'モード',
                type: 3, 
                description: '確認したいモードを選んでね！',
                required: true,
                choices: [
                    {
                        name: '日本',
                        value: 'japan'
                    },
                    {
                        name: '世界',
                        value: 'world'
                    }
                ]
            }
        ]
    },
    {
        name: 'leaderboard',
        description: '上位10ユーザーの得点を表示するよ！',
        options: [
            {
                name: 'モード',
                type: 3, 
                description: '確認したいモードを選んでね！',
                required: true,
                choices: [
                    {
                        name: '日本',
                        value: 'japan'
                    },
                    {
                        name: '世界',
                        value: 'world'
                    }
                ]
            }
        ]
    },
    {
        name: 'reset',
        description: '全員の得点をリセットするよ！（鯖主のみ使えます）',
        defaultPermission: false
    }
];

export async function registerCommands(client) {
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

export async function handleCommand(interaction) {
    if (interaction.commandName === 'gamestart') {
        if (gameInProgress) {
            await interaction.reply('すでに始まってます');
            return;
        }

        gameInProgress = true;
        console.log('Game started');
        await interaction.deferReply();

        const region = interaction.options.getString('モード');

        try {
            const { imagePath, link, location, answer } = await getRandomStreetViewImage(region);
            const embed = new EmbedBuilder()
                .setTitle('Deviterreの場所当てゲーム')
                .setDescription(`この場所がどこか答えてね！\n__**地域か市区町村まで答えると得点が高くなるよ！**__`)
                .setImage(`attachment://${imagePath}`);

            currentAnswers = answer.map(ans => ans.toLowerCase());
            currentLocation = location;
            currentLink = link;
            correctUser = null;
            currentMode = region;

            currentQuestionMessage = await interaction.editReply({
                embeds: [embed],
                files: [{ attachment: imagePath, name: 'streetview.png' }]
            });

            console.log(`Answers for this round: ${currentAnswers.join(', ')}`);
        } catch (error) {
            console.error('Error fetching street view image:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp('ストリートビューの画像を取得できませんでした');
            } else {
                await interaction.reply('ストリートビューの画像を取得できませんでした');
            }
            gameInProgress = false; 
        }
    } else if (interaction.commandName === 'score') {
        const mode = interaction.options.getString('モード');
        if (!mode || !userScores[mode]) {
            await interaction.reply('無効なモードが指定されました');
            return;
        }

        const userId = interaction.user.id;
        const score = userScores[mode][userId] || 0;

        const embed = new EmbedBuilder()
            .setTitle(`${mode === 'japan' ? '日本' : '世界'}モードでの現時点での得点は${score}点です`);

        await interaction.reply({ embeds: [embed] });
    } else if (interaction.commandName === 'leaderboard') {
        const mode = interaction.options.getString('モード');
        if (!mode || !userScores[mode]) {
            await interaction.reply('無効なモードが指定されました');
            return;
        }

        try {
            const sortedUsers = Object.entries(userScores[mode])
                .sort(([, aScore], [, bScore]) => bScore - aScore)
                .slice(0, 10);

            const leaderboard = await Promise.all(
                sortedUsers.map(async ([userId, score], index) => {
                    try {
                        const user = await interaction.client.users.fetch(userId);
                        return `${index + 1}. ${user.username} - ${score}点`;
                    } catch (error) {
                        console.error(`Error fetching user ${userId}:`, error);
                        return `${index + 1}. ユーザー情報を取得できません - ${score}点`;
                    }
                })
            );

            const embed = new EmbedBuilder()
                .setTitle(`${mode === 'japan' ? '日本' : '世界'}モードの得点ランキングTOP10`)
                .setDescription(leaderboard.join('\n'));

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            await interaction.reply('ランキングの取得中にエラーが発生しました');
        }
    } else if (interaction.commandName === 'reset') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            await interaction.reply('このコマンドを使用する権限がありません');
            return;
        }

        userScores = { japan: {}, world: {} };
        await interaction.reply('全員の得点がリセットされました');
    }
}

export async function handleGuess(message) {
    if (!gameInProgress) return;

    const guess = message.content.trim().toLowerCase();
    const userId = message.author.id;
    const isCorrect = currentAnswers.some(answer => guess.includes(answer));

    if (isCorrect && !correctUser) {
        correctUser = message.author;

        const scoreToAdd = currentAnswers.reduce((acc, answer, index) => {
            if (guess.includes(answer)) {
                return acc + (index === 2 ? 3 : index === 1 ? 2 : 1);
            }
            return acc;
        }, 0);

        if (!userScores[currentMode][userId]) {
            userScores[currentMode][userId] = 0;
        }
        userScores[currentMode][userId] += scoreToAdd;

        const embed = new EmbedBuilder()
            .setTitle('正解！')
            .setDescription(`${message.author.username}さんが正解したよ！\n答えはここ: ${currentLocation}\n[Google Mapsで確認しよう！](${currentLink})\n\n${scoreToAdd}点獲得！`)
            .setColor('GREEN');

        await message.channel.send({ embeds: [embed] });

        console.log(`Correct guess by ${message.author.username}. Score added: ${scoreToAdd}`);
        
        gameInProgress = false;
        currentAnswers = null;
        correctUser = null;
        currentLocation = null;
        currentLink = null;
        currentQuestionMessage = null;
        currentMode = null;
        
    } else if (!isCorrect && guess.split(' ').length > 1) {
        await message.channel.send('回答できるのは1メッセージにつき1つです');
    }
}
