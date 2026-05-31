module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isChatInputCommand()) return;

        const command = client.commands?.get(interaction.commandName);
        if (!command) {
            // Les commandes musique (play, stop, skip, etc.) sont gérées directement par MusicBot
            // On les ignore silencieusement ici pour éviter les doublons
            const musicCommands = new Set(['play', 'stop', 'skip', 'queue', 'nowplaying', 'pause', 'volume', 'shuffle', 'clear']);
            if (musicCommands.has(interaction.commandName)) return;

            console.warn(`[InteractionCreate] ⚠️ Commande inconnue: /${interaction.commandName}`);
            return interaction.reply({ content: '❌ Commande inconnue.', ephemeral: true }).catch(() => {});
        }

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(`[InteractionCreate] ❌ Erreur /${interaction.commandName}:`, error);
            const msg = { content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msg).catch(() => {});
            } else {
                await interaction.reply(msg).catch(() => {});
            }
        }
    }
};