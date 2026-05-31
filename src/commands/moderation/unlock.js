const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Déverrouille un salon textuel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option =>
            option.setName('salon')
                .setDescription('Le salon à déverrouiller (par défaut le salon actuel)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('La raison du déverrouillage')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            const targetChannel = interaction.options.getChannel('salon') || interaction.channel;
            const reason = interaction.options.getString('reason') || 'Aucune raison fournie';

            await interaction.deferReply({ ephemeral: true });

            const everyoneRole = interaction.guild.roles.everyone;

            // Vérifier si le salon est verrouillé
            const currentPermissions = targetChannel.permissionOverwrites.cache.get(everyoneRole.id);
            if (!currentPermissions || !currentPermissions.deny.has(PermissionFlagsBits.SendMessages)) {
                return interaction.editReply({ content: `❌ Le salon ${targetChannel} n'est pas verrouillé.` });
            }

            // Déverrouiller (SendMessages mis à null pour réhériter des permissions par défaut)
            await targetChannel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: null
            }, { reason });

            await interaction.editReply({ content: `🔓 Le salon ${targetChannel} a été déverrouillé pour : *${reason}*` });

            // Log de modération dynamique
            try {
                const config = await getGuildConfig(interaction.guild.id);
                if (config?.log_channel_id) {
                    const logChannel = interaction.guild.channels.cache.get(config.log_channel_id);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor('#2ecc71')
                            .setTitle('📋 Action de Modération : Salon Déverrouillé')
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
                console.error('[Unlock Command] Erreur logging:', logError);
            }

        } catch (error) {
            console.error('[Unlock Command] Erreur:', error);
            return interaction.editReply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.' });
        }
    }
};
