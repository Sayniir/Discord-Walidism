const { REST, Routes } = require('discord.js');
const path = require('path');
const { readdirSync } = require('fs');
require('dotenv').config();

/**
 * Déploie toutes les slash commands sur Discord (à la fois globalement ou par guilde)
 * Usage: node src/deploy-commands.js
 */
async function deployCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = readdirSync(folderPath).filter(f => f.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(path.join(folderPath, file));
            if (command.data) {
                commands.push(command.data.toJSON());
                console.log(`[Deploy] 📦 Commande trouvée: /${command.data.name}`);
            }
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`[Deploy] 🚀 Déploiement de ${commands.length} commande(s)...`);

        // Déploiement global (peut prendre jusqu'à 1h pour se propager)
        await rest.put(
            Routes.applicationCommands(process.env.BOT_ID),
            { body: commands }
        );

        console.log(`[Deploy] ✅ ${commands.length} commande(s) déployée(s) avec succès !`);
    } catch (error) {
        console.error('[Deploy] ❌ Erreur lors du déploiement:', error);
    }
}

deployCommands();
