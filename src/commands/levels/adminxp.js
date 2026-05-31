const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getUserXP, setUserXP, resetUserXP, resetGuildXP } = require('../../database/queries');
const { calculateLevel } = require('../../utils/levels');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adminxp')
        .setDescription("Gère l'XP et les niveaux des utilisateurs.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ajouter')
                .setDescription("Ajoute de l'XP à un utilisateur.")
                .addUserOption(option => option.setName('user').setDescription("L'utilisateur ciblé").setRequired(true))
                .addIntegerOption(option => option.setName('montant').setDescription("Le montant d'XP à ajouter").setRequired(true).setMinValue(1))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('retirer')
                .setDescription("Retire de l'XP à un utilisateur.")
                .addUserOption(option => option.setName('user').setDescription("L'utilisateur ciblé").setRequired(true))
                .addIntegerOption(option => option.setName('montant').setDescription("Le montant d'XP à retirer").setRequired(true).setMinValue(1))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('definir')
                .setDescription("Définit l'XP d'un utilisateur.")
                .addUserOption(option => option.setName('user').setDescription("L'utilisateur ciblé").setRequired(true))
                .addIntegerOption(option => option.setName('montant').setDescription("Le montant d'XP à définir").setRequired(true).setMinValue(0))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reinitialiser')
                .setDescription("Réinitialise l'XP d'un utilisateur ou de tout le serveur.")
                .addUserOption(option => option.setName('user').setDescription("L'utilisateur ciblé (laisser vide pour tout le serveur)").setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('transferer')
                .setDescription("Transfère l'XP d'un utilisateur vers un autre.")
                .addUserOption(option => option.setName('de').setDescription("L'utilisateur source (qui va perdre son XP)").setRequired(true))
                .addUserOption(option => option.setName('vers').setDescription("L'utilisateur cible (qui va recevoir l'XP)").setRequired(true))
        ),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });
            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;

            if (subcommand === 'ajouter') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('montant');

                const data = await getUserXP(guildId, targetUser.id);
                const newXP = data.xp + amount;
                const newLevel = calculateLevel(newXP).level;

                await setUserXP(guildId, targetUser.id, { xp: newXP, level: newLevel });
                return interaction.editReply(`✅ **${amount} XP** ont été ajoutés à ${targetUser}. Nouveau total : **${newXP} XP** (Niveau ${newLevel}).`);
            }

            if (subcommand === 'retirer') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('montant');

                const data = await getUserXP(guildId, targetUser.id);
                const newXP = Math.max(0, data.xp - amount);
                const newLevel = calculateLevel(newXP).level;

                await setUserXP(guildId, targetUser.id, { xp: newXP, level: newLevel });
                return interaction.editReply(`✅ **${amount} XP** ont été retirés à ${targetUser}. Nouveau total : **${newXP} XP** (Niveau ${newLevel}).`);
            }

            if (subcommand === 'definir') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('montant');

                const newLevel = calculateLevel(amount).level;

                await setUserXP(guildId, targetUser.id, { xp: amount, level: newLevel });
                return interaction.editReply(`✅ L'XP de ${targetUser} a été définie à **${amount} XP** (Niveau ${newLevel}).`);
            }

            if (subcommand === 'reinitialiser') {
                const targetUser = interaction.options.getUser('user');

                if (targetUser) {
                    await resetUserXP(guildId, targetUser.id);
                    return interaction.editReply(`✅ L'XP de ${targetUser} a été réinitialisée à 0.`);
                } else {
                    await resetGuildXP(guildId);
                    return interaction.editReply(`⚠️ L'XP de **tous les membres** du serveur a été réinitialisée.`);
                }
            }

            if (subcommand === 'transferer') {
                const sourceUser = interaction.options.getUser('de');
                const targetUser = interaction.options.getUser('vers');

                if (sourceUser.id === targetUser.id) {
                    return interaction.editReply("❌ L'utilisateur source et l'utilisateur cible doivent être différents.");
                }

                const sourceData = await getUserXP(guildId, sourceUser.id);
                const targetData = await getUserXP(guildId, targetUser.id);

                if (sourceData.xp === 0) {
                    return interaction.editReply(`ℹ️ ${sourceUser} n'a pas d'XP à transférer.`);
                }

                const sourceXP = sourceData.xp;
                const newTargetXP = targetData.xp + sourceXP;
                const newTargetLevel = calculateLevel(newTargetXP).level;

                // Réinitialiser la source et mettre à jour la cible
                await resetUserXP(guildId, sourceUser.id);
                await setUserXP(guildId, targetUser.id, { xp: newTargetXP, level: newTargetLevel });

                return interaction.editReply(`✅ **${sourceXP} XP** ont été transférés de ${sourceUser} vers ${targetUser}.\n• ${sourceUser} : 0 XP\n• ${targetUser} : **${newTargetXP} XP** (Niveau ${newTargetLevel}).`);
            }

        } catch (error) {
            console.error('[AdminXP Command] Erreur:', error);
            return interaction.editReply('❌ Une erreur est survenue lors de l\'exécution de cette commande.');
        }
    }
};
