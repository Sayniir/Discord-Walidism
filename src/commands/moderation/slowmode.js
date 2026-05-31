const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Active ou désactive le mode lent dans ce salon.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addIntegerOption(option =>
            option.setName('duree')
                .setDescription('Durée du mode lent en secondes (0 pour désactiver)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600) // 6 heures maximum
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison de l\'activation du mode lent')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            const duration = interaction.options.getInteger('duree');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';
            const channel = interaction.channel;

            await interaction.deferReply({ ephemeral: true });

            // Configurer le slowmode
            await channel.setRateLimitPerUser(duration, reason);

            let displayMsg = '';
            if (duration === 0) {
                displayMsg = `✅ Mode lent désactivé dans ${channel} pour : *${reason}*`;
            } else {
                let durationText;
                if (duration < 60) {
                    durationText = `${duration} seconde${duration > 1 ? 's' : ''}`;
                } else if (duration < 3600) {
                    const minutes = Math.floor(duration / 60);
                    const seconds = duration % 60;
                    durationText = `${minutes} minute${minutes > 1 ? 's' : ''}${seconds > 0 ? ` et ${seconds} seconde${seconds > 1 ? 's' : ''}` : ''}`;
                } else {
                    const hours = Math.floor(duration / 3600);
                    const minutes = Math.floor((duration % 3600) / 60);
                    durationText = `${hours} heure${hours > 1 ? 's' : ''}${minutes > 0 ? ` et ${minutes} minute${minutes > 1 ? 's' : ''}` : ''}`;
                }
                displayMsg = `⏱️ Mode lent configuré à **${durationText}** dans ${channel} pour : *${reason}*`;
            }

            await interaction.editReply({ content: displayMsg });

            // Log de modération dynamique
            try {
                const config = await getGuildConfig(interaction.guild.id);
                if (config?.log_channel_id) {
                    const logChannel = interaction.guild.channels.cache.get(config.log_channel_id);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#ffa500')
                            .setTitle('📋 Action de Modération : Mode Lent')
                            .addFields(
                                { name: 'Salon', value: `${channel} (\`${channel.id}\`)`, inline: true },
                                { name: 'Modérateur', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                                { name: 'Configuration', value: duration === 0 ? 'Désactivé' : `${duration}s`, inline: true },
                                { name: 'Raison', value: reason, inline: false }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (logError) {
                console.error('[Slowmode Command] Erreur logging:', logError);
            }

        } catch (error) {
            console.error('[Slowmode Command] Erreur:', error);
            return interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.' });
        }
    }
};
