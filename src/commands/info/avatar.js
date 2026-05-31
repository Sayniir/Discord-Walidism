const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription("Affiche l'avatar d'un utilisateur.")
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription("L'utilisateur dont vous souhaitez voir l'avatar")
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

            await interaction.deferReply();

            const avatarURL = targetUser.displayAvatarURL({ size: 2048, dynamic: true });

            const embed = new EmbedBuilder()
                .setTitle(`Avatar de ${targetUser.tag}`)
                .setImage(avatarURL)
                .setColor('#5865F2')
                .setFooter({ text: `Demandé par ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[Avatar Command] Erreur:', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de la récupération de l\'avatar.' });
        }
    }
};
