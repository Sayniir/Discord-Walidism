const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { setGuildConfig, getGuildConfig } = require('../../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configure les paramètres du bot pour ce serveur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('welcome')
                .setDescription('Configure le salon de bienvenue.')
                .addChannelOption(option =>
                    option.setName('salon')
                        .setDescription('Le salon où envoyer les messages de bienvenue')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('autorole')
                .setDescription('Configure le rôle attribué automatiquement aux nouveaux membres.')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Le rôle à donner aux nouveaux membres')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('staff')
                .setDescription('Configure le rôle du staff pour la modération et les tickets.')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Le rôle du staff')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('logs')
                .setDescription('Configure le salon de logs.')
                .addChannelOption(option =>
                    option.setName('salon')
                        .setDescription('Le salon pour les logs du bot')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('tickets')
                .setDescription('Configure la catégorie des tickets ouverts et fermés.')
                .addChannelOption(option =>
                    option.setName('open_category')
                        .setDescription('La catégorie pour les tickets ouverts')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName('closed_category')
                        .setDescription('La catégorie pour les tickets fermés')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Affiche la configuration actuelle du serveur.')
        ),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });
            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;

            if (subcommand === 'welcome') {
                const channel = interaction.options.getChannel('salon');
                await setGuildConfig(guildId, { welcome_channel_id: channel.id });
                return interaction.editReply(`✅ Le salon de bienvenue a été configuré sur ${channel}.`);
            }

            if (subcommand === 'autorole') {
                const role = interaction.options.getRole('role');
                await setGuildConfig(guildId, { autorole_id: role.id });
                return interaction.editReply(`✅ Le rôle automatique a été configuré sur **${role.name}**.`);
            }

            if (subcommand === 'staff') {
                const role = interaction.options.getRole('role');
                await setGuildConfig(guildId, { staff_role_id: role.id });
                return interaction.editReply(`✅ Le rôle staff a été configuré sur **${role.name}**.`);
            }

            if (subcommand === 'logs') {
                const channel = interaction.options.getChannel('salon');
                await setGuildConfig(guildId, { log_channel_id: channel.id });
                return interaction.editReply(`✅ Le salon de logs a été configuré sur ${channel}.`);
            }

            if (subcommand === 'tickets') {
                const openCat = interaction.options.getChannel('open_category');
                const closedCat = interaction.options.getChannel('closed_category');
                await setGuildConfig(guildId, {
                    ticket_category_id: openCat.id,
                    closed_category_id: closedCat.id
                });
                return interaction.editReply(`✅ Catégories de tickets configurées :\n• Ouverts : **${openCat.name}**\n• Fermés : **${closedCat.name}**`);
            }

            if (subcommand === 'view') {
                const config = await getGuildConfig(guildId);
                const embed = new EmbedBuilder()
                    .setTitle(`Configuration de ${interaction.guild.name}`)
                    .setColor('#5865F2')
                    .addFields(
                        { name: '👋 Salon Bienvenue', value: config?.welcome_channel_id ? `<#${config.welcome_channel_id}>` : '❌ Non configuré', inline: true },
                        { name: '🤖 Rôle Auto', value: config?.autorole_id ? `<@&${config.autorole_id}>` : '❌ Non configuré', inline: true },
                        { name: '📋 Rôle Staff', value: config?.staff_role_id ? `<@&${config.staff_role_id}>` : '❌ Non configuré', inline: true },
                        { name: '📝 Salon Logs', value: config?.log_channel_id ? `<#${config.log_channel_id}>` : '❌ Non configuré', inline: true },
                        { name: '🎫 Tickets Ouverts', value: config?.ticket_category_id ? `<#${config.ticket_category_id}>` : '❌ Non configuré', inline: true },
                        { name: '🔒 Tickets Fermés', value: config?.closed_category_id ? `<#${config.closed_category_id}>` : '❌ Non configuré', inline: true }
                    )
                    .setFooter({ text: `ID: ${guildId}` })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('[Setup Command] Erreur:', error);
            return interaction.editReply('❌ Une erreur est survenue lors de la configuration.');
        }
    }
};
