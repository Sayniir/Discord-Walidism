const { getUserXP, setUserXP } = require('../../database/queries');
const { calculateLevel } = require('../../utils/levels');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('claim_xp-')) return;

        try {
            const dropId = interaction.customId.split('-')[1];

            if (!client.activeDrops) {
                client.activeDrops = new Map();
            }

            const drop = client.activeDrops.get(dropId);

            if (!drop) {
                return interaction.reply({ content: '❌ Ce drop est introuvable ou a déjà expiré.', ephemeral: true });
            }

            if (drop.claimed) {
                return interaction.reply({ content: '❌ Ce drop a déjà été récupéré par un autre utilisateur.', ephemeral: true });
            }

            // Marquer comme récupéré immédiatement pour éviter les conditions de course
            drop.claimed = true;
            client.activeDrops.delete(dropId);

            const guildId = interaction.guild.id;
            const userId = interaction.user.id;
            const amount = drop.amount;

            // Ajouter l'XP dans la base de données
            const userData = await getUserXP(guildId, userId);
            const oldLevel = calculateLevel(userData.xp).level;
            const newXP = userData.xp + amount;
            const newLevel = calculateLevel(newXP).level;

            await setUserXP(guildId, userId, {
                xp: newXP,
                level: newLevel
            });

            // Mettre à jour le message d'origine du drop
            const claimedEmbed = new EmbedBuilder()
                .setTitle('🎉 Drop d\'XP récupéré !')
                .setDescription(`Félicitations à ${interaction.user} qui a récupéré le drop de **${amount} XP** !`)
                .setColor('#2ecc71')
                .setTimestamp();

            const disabledButton = new ButtonBuilder()
                .setCustomId(`claimed_xp-${dropId}`)
                .setLabel(`Récupéré par ${interaction.user.username}`)
                .setStyle(interaction.message.components[0].components[0].style)
                .setDisabled(true);

            const disabledRow = new ActionRowBuilder().addComponents(disabledButton);

            await interaction.message.edit({ embeds: [claimedEmbed], components: [disabledRow] }).catch(() => {});

            // Répondre à l'utilisateur
            let responseContent = `⚡ Vous avez récupéré **${amount} XP** !`;
            if (newLevel > oldLevel) {
                responseContent += `\n🎉 GG, vous passez au **niveau ${newLevel}** !`;
            }

            await interaction.reply({ content: responseContent, ephemeral: true });

        } catch (error) {
            console.error('[XPDropHandler] Erreur:', error);
            await interaction.reply({ content: '❌ Une erreur est survenue lors de la récupération du drop.', ephemeral: true }).catch(() => {});
        }
    }
};
