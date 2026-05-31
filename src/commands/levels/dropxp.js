const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dropxp')
        .setDescription("Fait apparaître un drop d'XP dans le salon actuel.")
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription("Le montant d'XP à faire gagner")
                .setRequired(true)
                .setMinValue(1)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, client) {
        try {
            const amount = interaction.options.getInteger('montant');
            const dropId = Math.random().toString(36).substring(2, 11);

            if (!client.activeDrops) {
                client.activeDrops = new Map();
            }

            client.activeDrops.set(dropId, {
                amount,
                claimed: false,
                channelId: interaction.channel.id
            });

            const embed = new EmbedBuilder()
                .setTitle('🎁 Drop d\'XP !')
                .setDescription(`Un drop de **${amount} XP** a été lancé par ${interaction.user} !\n\n**Soyez le premier à cliquer sur le bouton ci-dessous pour le récupérer !**`)
                .setColor('#FFD700')
                .setFooter({ text: 'Ce drop expire dans 2 minutes.' })
                .setTimestamp();

            const button = new ButtonBuilder()
                .setCustomId(`claim_xp-${dropId}`)
                .setLabel('Récupérer ! ⚡')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(button);

            await interaction.reply({ embeds: [embed], components: [row] });

            // Expire le drop après 2 minutes s'il n'a pas été récupéré
            setTimeout(async () => {
                const drop = client.activeDrops.get(dropId);
                if (drop && !drop.claimed) {
                    client.activeDrops.delete(dropId);
                    
                    const expiredEmbed = EmbedBuilder.from(embed)
                        .setTitle('❌ Drop d\'XP expiré')
                        .setDescription(`Le drop de **${amount} XP** lancé par ${interaction.user} a expiré et n'a pas été récupéré.`)
                        .setColor('#ff3333')
                        .setFooter({ text: 'Expiré' });

                    const disabledButton = ButtonBuilder.from(button).setDisabled(true).setLabel('Expiré');
                    const disabledRow = new ActionRowBuilder().addComponents(disabledButton);

                    await interaction.editReply({ embeds: [expiredEmbed], components: [disabledRow] }).catch(() => {});
                }
            }, 120_000);

        } catch (error) {
            console.error('[DropXP Command] Erreur:', error);
            await interaction.reply({ content: '❌ Une erreur est survenue lors du lancement du drop.', ephemeral: true });
        }
    }
};
