// require necessary modules
const {
    Client,
    IntentsBitField,
    EmbedBuilder,
    ActivityType,
    interaction,
} = require("discord.js");
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { type } = require("os");
const { createCanvas, loadImage } = require("canvas");
const { AttachmentBuilder } = require("discord.js");
require("dotenv").config();
const AutoRespond = require("./events/AutomaticRespond/Respond.js");
const Welcome = require("./events/welcome/welcome.js");
const autorole = require("./events/welcome/autorole.js");
const tickets = require("./events/Tickets/tickets.js");
const ModerationBot = require("./events/interactionCreate/clear.js");
const MusicBot = require("./events/Musique/player.js");
const levelSystem = require("./events/Levels/levelSystem.js");
const Ready = require("./events/ready/consoleLog.js");

// intents for the Discord client - CORRIGÉ
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.DirectMessages,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildVoiceStates,
    ],
});

// Error handling
client.on("error", (error) => {
    console.error("Erreur du client Discord:", error);
});
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// load autoRespond
client.on("messageCreate", (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    AutoRespond(message);
});

client.on("guildMemberAdd", (member) => {
    Welcome(member);
    autorole(member);
});

tickets(client);
levelSystem(client, interaction);

client.on("messageCreate", async (message) => {
    if (message.content.startsWith("!blague")) {
        const args = message.content.split(" ");
        let targetUser;

        // Vérifier s'il y a une mention
        const mentionedUser = message.mentions.users.first();

        if (mentionedUser) {
            // Si mention trouvée, l'utiliser
            targetUser = mentionedUser;
        } else if (args[1]) {
            // Sinon, essayer de récupérer par ID
            try {
                targetUser = await client.users.fetch(args[1]);
            } catch (fetchErr) {
                return message.reply(
                    "❌ Utilisateur non trouvé ! Utilise: `!blague @utilisateur` ou `!blague ID_UTILISATEUR`",
                );
            }
        } else {
            // Aucune mention ni ID fourni
            return message.reply(
                "❌ Tu dois mentionner quelqu'un ou donner un ID !\n" +
                    "**Exemples :**\n" +
                    "• `!blague @utilisateur`\n" +
                    "• `!blague 1388142273748799621`",
            );
        }

        // Vérifications de sécurité
        if (targetUser.id === client.user.id) {
            return message.reply(
                "😅 Je ne peux pas me faire une blague à moi-même !",
            );
        }

        if (targetUser.id === message.author.id) {
            return message.reply("🤔 Tu veux te faire une blague à toi-même ?");
        }

        // Test préalable pour vérifier si on peut envoyer des MP
        try {
            const testMessage = await targetUser.send(
                "🎯 Préparation de la blague...",
            );
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Si le test passe, continuer
            const messages = [
                "SYBAU",
                "C'EST UNE BLAAGUUEE",
                "HIHIHIHIHI",
                "OK I STOP",
                "JUST KIDDING",
            ];

            await message.reply(
                `🎯 Blague lancée sur **${targetUser.displayName}** !`,
            );

            for (let i = 0; i < 10; i++) {
                for (const msg of messages) {
                    await targetUser.send(msg);
                    await new Promise((resolve) => setTimeout(resolve, 1200));
                }
            }

            console.log(
                `Blague terminée sur ${targetUser.tag} (${targetUser.id})`,
            );
            await message.channel.send(
                `✅ Blague terminée sur **${targetUser.displayName}** !`,
            );
        } catch (err) {
            console.error("Impossible d'envoyer les MP :", err);

            // Gestion spécifique des erreurs Discord
            if (err.code === 50007) {
                await message.reply(
                    `❌ **${targetUser.tag}** a désactivé ses MP ou m'a bloqué !`,
                );
            } else if (err.code === 50013) {
                await message.reply(
                    `❌ Je n'ai pas la permission d'envoyer des MP à **${targetUser.tag}**`,
                );
            } else if (
                err.message &&
                err.message.includes("Cannot send messages to this user")
            ) {
                await message.reply(
                    `❌ **${targetUser.tag}** a bloqué les MP des inconnus !`,
                );
            } else {
                await message.reply(
                    `❌ Impossible d'envoyer des MP à **${targetUser.tag}**.\n` +
                        `Il/elle a peut-être désactivé ses MP ou configuré ses paramètres de confidentialité.`,
                );
            }
        }
    }
});

client.on("messageCreate", async (message) => {
    if (message.content.toLowerCase() == "batabintou") {
        for (let i = 0; i < 50; i++) {
            await message.channel.send(
                `T'aurais pas du <@${message.author.id}>`,
            );
        }
    }
});

client.on("messageCreate", async (message) => {
    if (message.content.toLowerCase() == "ri") {
        for (let i = 0; i < 15; i++) {
            await message.channel.send(`REVEREND INSNAITY IS PEAK`);
        }
    }
});

client.on("ready", async () => {
    await client.application.fetch(); // <-- très important !

    const musicBot = new MusicBot(client);
    await musicBot.init();
});

Ready(client);

// launch the bot
client.login(process.env.DISCORD_TOKEN);
