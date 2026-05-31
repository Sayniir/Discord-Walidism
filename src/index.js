require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');
const eventHandler = require('./handlers/eventHandler');
const commandHandler = require('./handlers/commandHandler');

// ==========================================
// Création du client Discord
// ==========================================
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.DirectMessages,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.GuildPresences,
    ],
});

// ==========================================
// Gestion des erreurs globales
// ==========================================
client.on('error', (error) => {
    console.error('[Client] ❌ Erreur Discord:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('[Process] ❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('[Process] ❌ Uncaught Exception:', error);
});

// ==========================================
// Chargement des handlers
// ==========================================
commandHandler(client);
eventHandler(client);

// ==========================================
// Connexion au bot
// ==========================================
client.login(process.env.DISCORD_TOKEN);
