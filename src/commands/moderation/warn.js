const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Avertit un utilisateur du serveur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('L\'utilisateur à avertir')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison de l\'avertissement')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        try {
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            await interaction.deferReply({ ephemeral: true });

            // Récupérer le membre du serveur
            let targetMember;
            try {
                targetMember = await interaction.guild.members.fetch(targetUser.id);
            } catch {
                return interaction.editReply({ content: '❌ Utilisateur non trouvé sur ce serveur.' });
            }

            // Vérifications de sécurité
            if (targetUser.id === client.user.id) {
                return interaction.editReply({ content: '❌ Vous ne pouvez pas avertir le bot.' });
            }

            if (targetUser.id === interaction.user.id) {
                return interaction.editReply({ content: '❌ Vous ne pouvez pas vous avertir vous-même.' });
            }

            if (targetUser.id === interaction.guild.ownerId) {
                return interaction.editReply({ content: '❌ Vous ne pouvez pas avertir le propriétaire du serveur.' });
            }

            const targetUserRolePosition = targetMember.roles.highest.position;
            const requestingUserRolePosition = interaction.member.roles.highest.position;

            if (requestingUserRolePosition <= targetUserRolePosition && interaction.user.id !== interaction.guild.ownerId) {
                return interaction.editReply({
                    content: '❌ Vous ne pouvez pas avertir cet utilisateur car il a un rôle supérieur ou égal au vôtre.'
                });
            }

            // Envoyer un message privé
            let dmSent = true;
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Avertissement')
                    .setDescription(`Vous avez reçu un avertissement sur le serveur **${interaction.guild.name}**.\n**Raison :** ${reason}`)
                    .setColor('#f1c40f')
                    .setTimestamp();
                await targetUser.send({ embeds: [dmEmbed] });
            } catch {
                dmSent = false;
            }

            // Confirmer l'action
            await interaction.editReply({
                content: `⚠️ **${targetUser.tag}** a été averti avec succès pour : *${reason}*${!dmSent ? ' (Impossible de lui envoyer un MP)' : ''}`
            });

            // Log de modération dynamique
            try {
                const config = await getGuildConfig(interaction.guild.id);
                if (config?.log_channel_id) {
                    const logChannel = interaction.guild.channels.cache.get(config.log_channel_id);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#f1c40f')
                            .setTitle('📋 Action de Modération : Avertissement')
                            .addFields(
                                { name: 'Utilisateur averti', value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
                                { name: 'Modérateur', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                                { name: 'Raison', value: reason, inline: false }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (logError) {
                console.error('[Warn Command] Erreur logging:', logError);
            }

        } catch (error) {
            console.error('[Warn Command] Erreur:', error);
            return interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.' });
        }
    }
};
