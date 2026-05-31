const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Débannit un utilisateur du serveur via son ID.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
            option.setName('userid')
                .setDescription('L\'identifiant Discord (ID) de l\'utilisateur à débannir')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison du débannissement')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            const userId = interaction.options.getString('userid');
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            await interaction.deferReply({ ephemeral: true });

            // Valider le format de l'identifiant Discord
            if (!/^\d{17,19}$/.test(userId)) {
                return interaction.editReply({ content: '❌ Identifiant (ID) invalide. Veuillez fournir un ID Discord valide composé uniquement de chiffres.' });
            }

            // Vérifier s'il est banni
            let bannedUser;
            try {
                const bans = await interaction.guild.bans.fetch();
                bannedUser = bans.get(userId);
                if (!bannedUser) {
                    return interaction.editReply({ content: '❌ Cet utilisateur n\'est pas banni sur ce serveur.' });
                }
            } catch (err) {
                console.error('[Unban Command] Erreur fetch bans:', err);
                return interaction.editReply({ content: '❌ Impossible de récupérer la liste des bannissements pour le moment.' });
            }

            // Débannir
            await interaction.guild.members.unban(userId, reason);

            // Réponse
            await interaction.editReply({
                content: `✅ **${bannedUser.user.tag}** (${userId}) a été débanni avec succès pour : *${reason}*`
            });

            // Log de modération dynamique
            try {
                const config = await getGuildConfig(interaction.guild.id);
                if (config?.log_channel_id) {
                    const logChannel = interaction.guild.channels.cache.get(config.log_channel_id);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#2ecc71')
                            .setTitle('📋 Action de Modération : Débannissement')
                            .addFields(
                                { name: 'Utilisateur débanni', value: `\`${bannedUser.user.tag}\` (\`${userId}\`)`, inline: true },
                                { name: 'Modérateur', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                                { name: 'Raison', value: reason, inline: false }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (logError) {
                console.error('[Unban Command] Erreur logging:', logError);
            }

        } catch (error) {
            console.error('[Unban Command] Erreur:', error);
            return interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.' });
        }
    }
};
