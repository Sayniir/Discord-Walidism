const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bannit un utilisateur du serveur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('L\'utilisateur à bannir')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison du bannissement')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            await interaction.deferReply({ ephemeral: true });

            // Vérifications de sécurité de base
            if (targetUser.id === client.user.id) {
                return interaction.editReply({ content: '❌ Vous ne pouvez pas bannir le bot.' });
            }

            if (targetUser.id === interaction.user.id) {
                return interaction.editReply({ content: '❌ Vous ne pouvez pas vous bannir vous-même.' });
            }

            if (targetUser.id === interaction.guild.ownerId) {
                return interaction.editReply({ content: '❌ Vous ne pouvez pas bannir le propriétaire du serveur.' });
            }

            // Récupérer le membre du serveur s'il y est présent
            let targetMember;
            try {
                targetMember = await interaction.guild.members.fetch(targetUser.id);
            } catch {
                // L'utilisateur n'est pas sur le serveur, on peut quand même le bannir par son ID
            }

            if (targetMember) {
                const targetUserRolePosition = targetMember.roles.highest.position;
                const requestingUserRolePosition = interaction.member.roles.highest.position;
                const botRolePosition = interaction.guild.members.me.roles.highest.position;

                if (requestingUserRolePosition <= targetUserRolePosition && interaction.user.id !== interaction.guild.ownerId) {
                    return interaction.editReply({
                        content: '❌ Vous ne pouvez pas bannir cet utilisateur car il a un rôle supérieur ou égal au vôtre.'
                    });
                }

                if (botRolePosition <= targetUserRolePosition) {
                    return interaction.editReply({
                        content: '❌ Je ne peux pas bannir cet utilisateur car il a un rôle supérieur ou égal au mien.'
                    });
                }
            }

            // Envoyer un message privé avant de bannir
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🚫 Bannissement')
                    .setDescription(`Vous avez été banni du serveur **${interaction.guild.name}**.\n**Raison :** ${reason}`)
                    .setColor('#ff3333')
                    .setTimestamp();
                await targetUser.send({ embeds: [dmEmbed] });
            } catch {
                console.log(`[Ban Command] Impossible de MP ${targetUser.tag}`);
            }

            // Bannir de la guilde
            await interaction.guild.members.ban(targetUser.id, { reason });

            // Confirmer l'action
            await interaction.editReply({
                content: `✅ **${targetUser.tag}** a été banni avec succès pour : *${reason}*`
            });

            // Log de modération dynamique
            try {
                const config = await getGuildConfig(interaction.guild.id);
                if (config?.log_channel_id) {
                    const logChannel = interaction.guild.channels.cache.get(config.log_channel_id);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#ff3333')
                            .setTitle('📋 Action de Modération : Bannissement')
                            .addFields(
                                { name: 'Utilisateur banni', value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
                                { name: 'Modérateur', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                                { name: 'Raison', value: reason, inline: false }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (logError) {
                console.error('[Ban Command] Erreur logging:', logError);
            }

        } catch (error) {
            console.error('[Ban Command] Erreur:', error);
            return interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.' });
        }
    }
};
