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
            await interaction.reply('ゲームはすでに進行中です！');
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
                .setImage('attachment://streetview.png')
                .setDescription(`この写真が撮影された国または地域を答えてね！\n__**地域か市区町村まで答えると得点が高くなるよ！**__`);

            currentAnswers = answer.map(ans => ans.toLowerCase());
            currentLocation = location;
            currentLink = link;
            correctUser = null;
            currentMode = region;

            currentQuestionMessage = await interaction.editReply({
                embeds: [embed],
                files: [{ attachment: imagePath, name: 'streetview.png' }]
            });

            await fs.unlink(imagePath);

            console.log(`Answers for this round: ${currentAnswers.join(', ')}`);
        } catch (error) {
            console.error('Error fetching street view image:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp('ストリートビューの画像を取得できませんでした');
            } else {
                await interaction.reply('ストリートビューの画像を取得できませんでした');
            }
            gameInProgress = false;
            console.log('Game ended due to error');
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
                .setTitle(`得点ランキングTOP10 (${mode === 'japan' ? '日本' : '世界'})`)
                .setDescription(leaderboard.length > 0 ? leaderboard.join('\n') : 'ランキングのデータを取得できません');

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error generating leaderboard:', error);
            await interaction.reply('ランキングが正常に作成できませんでした');
        }
    } else if (interaction.commandName === 'reset') {
        if (interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            userScores = { japan: {}, world: {} };

            const embed = new EmbedBuilder()
                .setTitle('全員の得点をリセットしました');

            await interaction.reply({ embeds: [embed] });

            console.log('All user scores have been reset.');
        } else {
            await interaction.reply('このコマンドを実行する権限がありません');
        }
    }
}

export async function handleGuess(message) {
    if (!currentAnswers || correctUser || !currentMode) return;

    if (message.channel.id !== GUESS_CHANNEL_ID) {
        return;
    }

    console.log('handleGuess called with message:', message.content);
    console.log('Current answers:', currentAnswers);
    console.log('Message reference:', message.reference ? message.reference.messageId : 'No reference');
    console.log('Current question message ID:', currentQuestionMessage.id);
    console.log('Game in progress:', gameInProgress);

    const guess = message.content.trim().toLowerCase();
    console.log('User guess:', guess);

    const answerIndex = currentAnswers.findIndex(answer => guess.includes(answer));
    console.log('Answer index:', answerIndex);

    let scoreToAdd = 0;
    if (answerIndex !== -1) {
        scoreToAdd = answerIndex + 1;
    }

    if (message.reference && message.reference.messageId === currentQuestionMessage.id) {
        if (scoreToAdd > 0) {
            correctUser = message.author;

            if (!userScores[currentMode]) {
                userScores[currentMode] = {};
            }
            const userId = correctUser.id;
            if (!userScores[currentMode][userId]) {
                userScores[currentMode][userId] = 0;
            }
            userScores[currentMode][userId] += scoreToAdd;

            const embed = new EmbedBuilder()
                .setTitle('正解！')
                .setDescription(`${correctUser}さんが一番乗りで正解したよ！\n__**答えはここ： ${currentLocation}**__\n[Google Mapsで確認しよう！](${currentLink})\n\n${scoreToAdd}点獲得！`);

            await message.channel.send({ embeds: [embed] });

            // ゲームデータをリセット
            currentAnswers = null;
            currentLocation = null;
            currentLink = null;
            currentQuestionMessage = null;
            correctUser = null;
            currentMode = null;
            gameInProgress = false;
            console.log('Game ended successfully');
        } else {
            await message.react('❌');
        }
    } else if (scoreToAdd > 0) {
        if (!userScores[currentMode]) {
            userScores[currentMode] = {};
        }
        const userId = message.author.id;
        if (!userScores[currentMode][userId]) {
            userScores[currentMode][userId] = 0;
        }
        userScores[currentMode][userId] += scoreToAdd;

        const embed = new EmbedBuilder()
            .setTitle('正解！')
            .setDescription(`${message.author}さんが一番乗りで正解したよ！\n__**答えはここ： ${currentLocation}**__\n[Google Mapsで確認しよう！](${currentLink})\n\n${scoreToAdd}点獲得！`);

        await message.channel.send({ embeds: [embed] });
    } else {
        await message.react('❌');
    }
}

export async function saveScores() {
    try {
        await fs.writeFile('userScores.json', JSON.stringify(userScores, null, 2));
        console.log('User scores saved successfully.');
    } catch (error) {
        console.error('Error saving user scores:', error);
    }
}

export async function loadScores() {
    try {
        const data = await fs.readFile('userScores.json', 'utf-8');
        userScores = JSON.parse(data);
        console.log('User scores loaded successfully.');
    } catch (error) {
        console.error('Error loading user scores:', error);
    }
}
