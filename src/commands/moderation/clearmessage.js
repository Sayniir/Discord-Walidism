const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearmessage')
        .setDescription('Supprime un nombre défini de messages dans ce salon.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option.setName('nombre')
                .setDescription('Nombre de messages à supprimer (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription('Filtrer les messages à supprimer par cet utilisateur')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        // Vérification des permissions du bot
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return await interaction.reply({
                content: '❌ Je n\'ai pas la permission de gérer les messages dans ce serveur.',
                ephemeral: true
            });
        }

        const amount = interaction.options.getInteger('nombre');
        const user = interaction.options.getUser('utilisateur');

        await interaction.deferReply({ ephemeral: true });

        try {
            // Récupérer les messages
            const fetchLimit = Math.min(amount * 2, 100);
            const messages = await interaction.channel.messages.fetch({ limit: fetchLimit });
            let filtered = Array.from(messages.values());

            // Filtrer par utilisateur
            if (user) {
                filtered = filtered.filter(msg => msg.author.id === user.id);
            }

            // Limiter au nombre demandé
            const toDelete = filtered.slice(0, amount);

            if (toDelete.length === 0) {
                return await interaction.editReply({
                    content: user 
                        ? `❌ Aucun message récent de ${user.tag} trouvé.` 
                        : '❌ Aucun message à supprimer.'
                });
            }

            // Séparer les messages de moins de 14 jours des plus anciens (bulkDelete limite)
            const now = Date.now();
            const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);
            
            const recentMessages = toDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
            const oldMessages = toDelete.filter(msg => msg.createdTimestamp <= twoWeeksAgo);

            let deletedCount = 0;

            // Suppression en masse
            if (recentMessages.length > 0) {
                try {
                    await interaction.channel.bulkDelete(recentMessages, true);
                    deletedCount += recentMessages.length;
                } catch (bulkError) {
                    console.error('Erreur suppression en masse:', bulkError);
                    for (const msg of recentMessages) {
                        try {
                            await msg.delete();
                            deletedCount++;
                        } catch (err) {
                            console.error(`Erreur suppression message ${msg.id}:`, err);
                        }
                    }
                }
            }

            // Suppression individuelle pour les anciens
            if (oldMessages.length > 0) {
                const deletePromises = oldMessages.map(async (msg) => {
                    try {
                        await msg.delete();
                        deletedCount++;
                    } catch (err) {
                        console.error(`Erreur suppression message ancien ${msg.id}:`, err);
                    }
                });
                await Promise.allSettled(deletePromises);
            }

            // Embed de confirmation
            const embed = new EmbedBuilder()
                .setColor(deletedCount > 0 ? '#00ff00' : '#ffaa00')
                .setDescription(
                    deletedCount > 0 
                        ? `🗑️ ${deletedCount} message${deletedCount > 1 ? 's' : ''} supprimé${deletedCount > 1 ? 's' : ''}${user ? ` de ${user.tag}` : ''}`
                        : `⚠️ Aucun message n'a pu être supprimé.`
                )
                .setFooter({ 
                    text: `Action effectuée par ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ size: 32 })
                })
                .setTimestamp();

            if (deletedCount < toDelete.length) {
                embed.addFields({
                    name: '⚠️ Information',
                    value: `${toDelete.length - deletedCount} message(s) n'ont pas pu être supprimés (trop anciens ou permissions insuffisantes).`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

            // Log de modération dynamique
            try {
                const config = await getGuildConfig(interaction.guild.id);
                if (config?.log_channel_id) {
                    const logChannel = interaction.guild.channels.cache.get(config.log_channel_id);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#ffa500')
                            .setTitle('📋 Action de Modération : Clear Messages')
                            .addFields(
                                { name: 'Modérateur', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                                { name: 'Salon', value: `${interaction.channel} (\`${interaction.channel.id}\`)`, inline: true },
                                { name: 'Messages supprimés', value: deletedCount.toString(), inline: true }
                            )
                            .setTimestamp();

                        if (user) {
                            logEmbed.addFields({ name: 'Utilisateur ciblé', value: `${user} (\`${user.id}\`)`, inline: true });
                        }

                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (logError) {
                console.error('[ClearMessage] Erreur logging:', logError);
            }

            // Supprimer la confirmation après 10s
            setTimeout(() => {
                interaction.deleteReply().catch(err => {
                    if (err.code !== 10008) {
                        console.error('Erreur suppression réponse:', err);
                    }
                });
            }, 10000);

        } catch (error) {
            console.error('Erreur globale suppression messages:', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de la suppression des messages.' });
        }
    }
};
