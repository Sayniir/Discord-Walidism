const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Répond avec le ping du bot et de l'API Discord."),

    async execute(interaction, client) {
        try {
            await interaction.deferReply();

            const reply = await interaction.fetchReply();
            const ping = reply.createdTimestamp - interaction.createdTimestamp;

            await interaction.editReply(`🏓 Pong ! Latence du bot : **${ping}ms** | Ping WebSocket : **${client.ws.ping}ms**`);
        } catch (error) {
            console.error('[Ping Command] Erreur:', error);
        }
    }
};