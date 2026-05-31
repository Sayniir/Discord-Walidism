const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription("Affiche des informations détaillées sur le serveur."),

    async execute(interaction, client) {
        try {
            await interaction.deferReply();

            const guild = interaction.guild;
            const owner = await guild.fetchOwner();
            const createdAt = `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:F>`;

            const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
            const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
            const categories = guild.channels.cache.filter(c => c.type === 4).size;
            const rolesCount = guild.roles.cache.size;
            const emojisCount = guild.emojis.cache.size;

            const verificationLevels = ['Aucun', 'Faible (Email vérifié)', 'Moyen (Inscrit depuis 5 min)', 'Élevé (Membre depuis 10 min)', 'Maximum (Téléphone vérifié)'];
            const verificationLevelText = verificationLevels[guild.verificationLevel] || 'Inconnu';

            const embed = new EmbedBuilder()
                .setTitle(`Informations du serveur : ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || '')
                .setColor('#5865F2')
                .addFields(
                    { name: '👑 Propriétaire', value: `${owner.user.toString()}\n\`${owner.user.id}\``, inline: true },
                    { name: '📅 Créé le', value: createdAt, inline: true },
                    { name: '👥 Membres', value: `**${guild.memberCount.toLocaleString('fr-FR')}** membres`, inline: true },
                    { name: '💬 Salons Textuels', value: `**${textChannels}** salons`, inline: true },
                    { name: '🔊 Salons Vocaux', value: `**${voiceChannels}** salons`, inline: true },
                    { name: '📁 Catégories', value: `**${categories}** catégories`, inline: true },
                    { name: '🎭 Rôles', value: `**${rolesCount}** rôles`, inline: true },
                    { name: '😀 Emojis', value: `**${emojisCount}** emojis`, inline: true },
                    { name: '🚀 Boosts', value: `Niveau **${guild.premiumTier}** (${guild.premiumSubscriptionCount} boosts)`, inline: true },
                    { name: '🔒 Niveau de vérification', value: verificationLevelText, inline: false }
                )
                .setFooter({ text: `ID du serveur : ${guild.id}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[ServerInfo Command] Erreur:', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de la récupération des informations du serveur.' });
        }
    }
};
