const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Verrouille un salon textuel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option =>
            option.setName('salon')
                .setDescription('Le salon à verrouiller (par défaut le salon actuel)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison du verrouillage')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            const targetChannel = interaction.options.getChannel('salon') || interaction.channel;
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            await interaction.deferReply({ ephemeral: true });

            const everyoneRole = interaction.guild.roles.everyone;

            // Vérifier si le salon est déjà verrouillé
            const currentPermissions = targetChannel.permissionOverwrites.cache.get(everyoneRole.id);
            if (currentPermissions && currentPermissions.deny.has(PermissionFlagsBits.SendMessages)) {
                return interaction.editReply({ content: `❌ Le salon ${targetChannel} est déjà verrouillé.` });
            }

            // Appliquer le verrouillage
            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: false
            }, { reason });

            await interaction.editReply({ content: `🔒 Le salon ${targetChannel} a été verrouillé pour : *${reason}*` });

            // Log de modération dynamique
            try {
                const config = await getGuildConfig(interaction.guild.id);
                if (config?.log_channel_id) {
                    const logChannel = interaction.guild.channels.cache.get(config.log_channel_id);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#ff3333')
                            .setTitle('📋 Action de Modération : Salon Verrouillé')
                            .addFields(
                                { name: 'Salon', value: `${targetChannel} (\`${targetChannel.id}\`)`, inline: true },
                                { name: 'Modérateur', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                                { name: 'Raison', value: reason, inline: false }
                            )
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (logError) {
                console.error('[Lock Command] Erreur logging:', logError);
            }

        } catch (error) {
            console.error('[Lock Command] Erreur:', error);
            return interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.' });
        }
    }
};
