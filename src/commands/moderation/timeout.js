const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Exclut temporairement (timeout) un membre du serveur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('L\'utilisateur à exclure temporairement')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Durée de l\'exclusion en minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320) // 28 jours
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison de l\'exclusion')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            const targetUser = interaction.options.getUser('user');
            const durationInMinutes = interaction.options.getInteger('duration');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            await interaction.deferReply({ ephemeral: true });

            // Récupérer le membre du serveur
            let targetMember;
            try {
                targetMember = await interaction.guild.members.fetch(targetUser.id);
            } catch {
                return interaction.editReply({ content: '❌ Utilisateur non trouvé sur ce serveur.' });
            }

            // Vérifications de sécurité
            if (targetUser.bot) {
                return interaction.editReply({ content: '❌ Je ne peux pas exclure temporairement un bot.' });
            }

            if (targetUser.id === interaction.user.id) {
                return interaction.editReply({ content: '❌ Vous ne pouvez pas vous exclure temporairement vous-même.' });
            }

            if (targetUser.id === interaction.guild.ownerId) {
                return interaction.editReply({ content: '❌ Vous ne pouvez pas exclure temporairement le propriétaire du serveur.' });
            }

            const targetUserRolePosition = targetMember.roles.highest.position;
            const requestingUserRolePosition = interaction.member.roles.highest.position;
            const botRolePosition = interaction.guild.members.me.roles.highest.position;

            if (requestingUserRolePosition <= targetUserRolePosition && interaction.user.id !== interaction.guild.ownerId) {
                return interaction.editReply({
                    content: '❌ Vous ne pouvez pas exclure temporairement cet utilisateur car il a un rôle supérieur ou égal au vôtre.'
                });
            }

            if (botRolePosition <= targetUserRolePosition) {
                return interaction.editReply({
                    content: '❌ Je ne peux pas exclure temporairement cet utilisateur car il a un rôle supérieur ou égal au mien.'
                });
            }

            const msDuration = durationInMinutes * 60 * 1000;

            // Formater la durée pour l'affichage en français
            let displayDuration;
            if (durationInMinutes >= 1440) {
                const days = Math.floor(durationInMinutes / 1440);
                const remainingMinutes = durationInMinutes % 1440;
                displayDuration = `${days} jour${days > 1 ? 's' : ''}`;
                if (remainingMinutes > 0) {
                    displayDuration += ` et ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
                }
            } else if (durationInMinutes >= 60) {
                const hours = Math.floor(durationInMinutes / 60);
                const remainingMinutes = durationInMinutes % 60;
                displayDuration = `${hours} heure${hours > 1 ? 's' : ''}`;
                if (remainingMinutes > 0) {
                    displayDuration += ` et ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
                }
            } else {
                displayDuration = `${durationInMinutes} minute${durationInMinutes > 1 ? 's' : ''}`;
            }

            // Envoyer un message privé avant le timeout
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🔇 Exclusion temporaire')
                    .setDescription(`Vous avez été exclu temporairement du serveur **${interaction.guild.name}** pour une durée de **${displayDuration}**.\n**Raison :** ${reason}`)
                    .setColor('#e67e22')
                    .setTimestamp();
                await targetUser.send({ embeds: [dmEmbed] });
            } catch {
                console.log(`[Timeout Command] Impossible de MP ${targetUser.tag}`);
            }

            // Exclure temporairement
            await targetMember.timeout(msDuration, reason);

            // Confirmer l'action
            await interaction.editReply({
                content: `✅ **${targetUser.tag}** a été exclu temporairement pour **${displayDuration}** pour : *${reason}*`
            });

            // Log de modération dynamique
            try {
                const config = await getGuildConfig(interaction.guild.id);
                if (config?.log_channel_id) {
                    const logChannel = interaction.guild.channels.cache.get(config.log_channel_id);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#e67e22')
                            .setTitle('📋 Action de Modération : Exclusion Temporaire')
                            .addFields(
                                { name: 'Utilisateur exclu', value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
                                { name: 'Modérateur', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                                { name: 'Durée', value: displayDuration, inline: true },
                                { name: 'Raison', value: reason, inline: false }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (logError) {
                console.error('[Timeout Command] Erreur logging:', logError);
            }

        } catch (error) {
            console.error('[Timeout Command] Erreur:', error);
            return interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.' });
        }
    }
};