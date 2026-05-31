// Ce fichier est conservé pour compatibilité mais n'est plus utilisé.
// Le déploiement des commandes se fait via: node src/deploy-commands.js
// Le chargement dynamique est géré par src/handlers/commandHandler.js

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        // Intentionnellement vide — voir deploy-commands.js
    }
};
