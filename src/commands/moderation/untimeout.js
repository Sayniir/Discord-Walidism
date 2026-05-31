const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Retire l\'exclusion temporaire d\'un membre.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('L\'utilisateur pour qui retirer le timeout')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison du retrait de l\'exclusion')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            const targetUser = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            await interaction.deferReply({ ephemeral: true });

            let targetMember;
            try {
                targetMember = await interaction.guild.members.fetch(targetUser.id);
            } catch {
                return interaction.editReply({ content: '❌ Utilisateur non trouvé sur ce serveur.' });
            }

            // Vérifier si le membre est en timeout
            if (!targetMember.communicationDisabledUntil) {
                return interaction.editReply({ content: '❌ Cet utilisateur n\'est pas exclu temporairement (pas de timeout actif).' });
            }

            // Retirer le timeout (passer null comme durée)
            await targetMember.timeout(null, reason);

            await interaction.editReply({
                content: `✅ L'exclusion temporaire de **${targetUser.tag}** a été retirée avec succès pour : *${reason}*`
            });

            // Log de modération dynamique
            try {
                const config = await getGuildConfig(interaction.guild.id);
                if (config?.log_channel_id) {
                    const logChannel = interaction.guild.channels.cache.get(config.log_channel_id);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#2ecc71')
                            .setTitle('📋 Action de Modération : Fin d\'Exclusion Temporaire')
                            .addFields(
                                { name: 'Utilisateur gracié', value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
                                { name: 'Modérateur', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                                { name: 'Raison', value: reason, inline: false }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (logError) {
                console.error('[Untimeout Command] Erreur logging:', logError);
            }

        } catch (error) {
            console.error('[Untimeout Command] Erreur:', error);
            return interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.' });
        }
    }
};
