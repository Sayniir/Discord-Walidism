const { readdirSync } = require('fs');
const path = require('path');

/**
 * Charge dynamiquement tous les events depuis src/events/
 * Chaque sous-dossier = un event Discord, chaque fichier = un handler
 */
module.exports = (client) => {
    const eventsPath = path.join(__dirname, '..', 'events');
    const eventFolders = readdirSync(eventsPath);

    for (const folder of eventFolders) {
        const folderPath = path.join(eventsPath, folder);
        const eventFiles = readdirSync(folderPath).filter(f => f.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(folderPath, file);
            const event = require(filePath);

            if (!event.name || !event.execute) {
                console.warn(`[EventHandler] ⚠️ Fichier ${file} ignoré (name ou execute manquant)`);
                continue;
            }

            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }

            console.log(`[EventHandler] ✅ Event chargé: ${event.name} (${file})`);
        }
    }
};