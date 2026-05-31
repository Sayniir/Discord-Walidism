const { readdirSync } = require('fs');
const path = require('path');

/**
 * Charge dynamiquement toutes les commandes slash depuis src/commands/
 * Chaque fichier doit exporter { data: SlashCommandBuilder, execute: async(interaction) }
 */
module.exports = (client) => {
    client.commands = new Map();

    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = readdirSync(folderPath).filter(f => f.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);

            if (!command.data || !command.execute) {
                console.warn(`[CommandHandler] ⚠️ Commande ${file} ignorée (data ou execute manquant)`);
                continue;
            }

            client.commands.set(command.data.name, command);
            console.log(`[CommandHandler] ✅ Commande chargée: /${command.data.name}`);
        }
    }

    console.log(`[CommandHandler] 📦 ${client.commands.size} commande(s) chargée(s)`);
};
