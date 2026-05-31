const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ChannelType, PermissionFlagsBits, AttachmentBuilder
} = require('discord.js');
const { getGuildConfig, getTicket, createTicket, updateTicket, deleteTicket, getUserActiveTickets } = require('../../database/queries');
const supabase = require('../../database/supabase');

const MAX_TICKETS_PER_USER = 3;
const TICKET_NAME_PREFIX = 'ticket-';
const AUTO_DELETE_AFTER = 7 * 24 * 60 * 60 * 1000;

function sanitizeChannelName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 50) || 'utilisateur';
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;

        const handlers = {
            'create_ticket': () => handleCreateTicket(interaction, client),
            'close_ticket': () => handleCloseTicket(interaction),
            'confirm_close': () => handleConfirmClose(interaction, client),
            'cancel_close': () => handleCancelClose(interaction),
            'reopen_ticket': () => handleReopenTicket(interaction, client),
            'delete_ticket': () => handleDeleteTicket(interaction),
            'confirm_delete': () => handleConfirmDelete(interaction),
            'cancel_delete': () => handleCancelDelete(interaction),
        };

        const handler = handlers[interaction.customId];
        if (!handler) return;

        try {
            await handler();
        } catch (error) {
            console.error(`[Tickets] ❌ Erreur bouton ${interaction.customId}:`, error);
            const msg = { content: '❌ Une erreur est survenue. Veuillez réessayer.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msg).catch(() => {});
            } else {
                await interaction.reply(msg).catch(() => {});
            }
        }
    }
};

// ============================================
// HANDLERS
// ============================================

async function handleCreateTicket(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const { user, guild } = interaction;

    // Récupérer la config du serveur
    const config = await getGuildConfig(guild.id);
    if (!config?.ticket_category_id || !config?.staff_role_id) {
        return interaction.editReply('❌ Le bot n\'est pas configuré sur ce serveur. Utilisez `/setup tickets`.');
    }

    const category = guild.channels.cache.get(config.ticket_category_id);
    if (!category || category.type !== ChannelType.GuildCategory) {
        return interaction.editReply('❌ Catégorie de tickets introuvable. Reconfigurez avec `/setup tickets`.');
    }

    const staffRole = guild.roles.cache.get(config.staff_role_id);
    if (!staffRole) {
        return interaction.editReply('❌ Rôle staff introuvable. Reconfigurez avec `/setup staff`.');
    }

    // Vérifier limite
    const userTickets = await getUserActiveTickets(guild.id, user.id);
    if (userTickets.length >= MAX_TICKETS_PER_USER) {
        return interaction.editReply(`❌ Vous avez déjà ${MAX_TICKETS_PER_USER} tickets ouverts !`);
    }

    // Nom du salon
    const member = await guild.members.fetch(user.id).catch(() => null);
    const displayName = member?.displayName || user.username;
    const sanitizedName = sanitizeChannelName(displayName);
    let channelName = `${TICKET_NAME_PREFIX}${sanitizedName}`;

    let counter = 1;
    while (guild.channels.cache.some(ch => ch.type === ChannelType.GuildText && ch.name === channelName)) {
        channelName = `${TICKET_NAME_PREFIX}${sanitizedName}-${counter++}`;
    }

    // Créer le salon
    const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: config.ticket_category_id,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
                id: user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks]
            },
            {
                id: config.staff_role_id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages]
            }
        ]
    });

    // Sauvegarder en BDD
    await createTicket({
        guild_id: guild.id,
        channel_id: ticketChannel.id,
        user_id: user.id,
        status: 'open',
        display_name: displayName,
        sanitized_name: sanitizedName,
    });

    // Message dans le ticket
    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🎫 Nouveau Ticket')
        .setDescription('Salut ! Notre équipe a été notifiée et vous répondra bientôt.\n\nMerci de décrire votre demande de manière **détaillée**.')
        .setColor('#00ff00');

    const ticketRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer le ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
    );

    await ticketChannel.send({ content: `${user}`, embeds: [welcomeEmbed], components: [ticketRow] });
    await interaction.editReply(`✅ Ticket créé : ${ticketChannel}`);

    // Notifier le staff
    if (config.log_channel_id) {
        const logChannel = client.channels.cache.get(config.log_channel_id);
        if (logChannel) {
            const notifEmbed = new EmbedBuilder()
                .setTitle('🎫 Nouveau Ticket')
                .addFields(
                    { name: 'Auteur', value: `${user}`, inline: true },
                    { name: 'Salon', value: `[Accéder](https://discord.com/channels/${guild.id}/${ticketChannel.id})`, inline: true }
                )
                .setColor('#00ff00')
                .setTimestamp();
            await logChannel.send({ content: `<@&${config.staff_role_id}>`, embeds: [notifEmbed] }).catch(() => {});
        }
    }
}

async function handleCloseTicket(interaction) {
    const { user, channel } = interaction;
    const ticket = await getTicket(channel.id);

    if (!ticket) {
        return interaction.reply({ content: '❌ Ce canal n\'est pas un ticket valide.', ephemeral: true });
    }

    const config = await getGuildConfig(interaction.guild.id);
    const isOwner = ticket.user_id === user.id;
    const isStaff = config?.staff_role_id && interaction.member.roles.cache.has(config.staff_role_id);

    if (!isOwner && !isStaff) {
        return interaction.reply({ content: '❌ Vous ne pouvez pas fermer ce ticket.', ephemeral: true });
    }

    const confirmEmbed = new EmbedBuilder()
        .setTitle('🔒 Fermer le ticket')
        .setDescription('Voulez-vous vraiment fermer ce ticket ?')
        .setColor('#ff9900');

    const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirmer').setStyle(ButtonStyle.Danger).setEmoji('✅'),
        new ButtonBuilder().setCustomId('cancel_close').setLabel('Annuler').setStyle(ButtonStyle.Secondary).setEmoji('❌')
    );

    await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true });
}

async function handleConfirmClose(interaction, client) {
    const { channel, user } = interaction;
    const ticket = await getTicket(channel.id);
    if (!ticket) return interaction.reply({ content: '❌ Ticket non trouvé.', ephemeral: true });

    await interaction.reply({ content: '🔒 Fermeture en cours...', ephemeral: true });

    // Créer le transcript
    await createTranscript(channel, ticket, user, client);

    // Retirer accès au créateur
    await channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: false, SendMessages: false }).catch(() => {});

    // Renommer et déplacer
    const newName = `ticket-fermé-${ticket.sanitized_name}`;
    await channel.setName(newName).catch(() => {});

    const config = await getGuildConfig(interaction.guild.id);
    if (config?.closed_category_id) {
        const closedCat = channel.guild.channels.cache.get(config.closed_category_id);
        if (closedCat?.type === ChannelType.GuildCategory) {
            await channel.setParent(closedCat).catch(() => {});
        }
    }

    // Embed fermeture
    const closedEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Fermé')
        .setDescription(`Ce ticket a été fermé par ${user}`)
        .setColor('#ff0000');

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('reopen_ticket').setLabel('Rouvrir').setStyle(ButtonStyle.Success).setEmoji('🔓'),
        new ButtonBuilder().setCustomId('delete_ticket').setLabel('Supprimer').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    await channel.send({ embeds: [closedEmbed], components: [actionRow] });

    // Mettre à jour BDD
    await updateTicket(channel.id, { status: 'closed', closed_by: user.id, closed_at: new Date().toISOString() });
}

async function handleCancelClose(interaction) {
    await interaction.update({ content: '❌ Fermeture annulée.', embeds: [], components: [] });
}

async function handleReopenTicket(interaction, client) {
    const { user, channel } = interaction;
    const ticket = await getTicket(channel.id);
    if (!ticket) return interaction.reply({ content: '❌ Ticket non trouvé.', ephemeral: true });

    const config = await getGuildConfig(interaction.guild.id);
    if (!config?.staff_role_id || !interaction.member.roles.cache.has(config.staff_role_id)) {
        return interaction.reply({ content: '❌ Seul le staff peut rouvrir un ticket.', ephemeral: true });
    }

    await channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: true, SendMessages: true }).catch(() => {});

    if (config?.ticket_category_id) {
        const cat = channel.guild.channels.cache.get(config.ticket_category_id);
        if (cat?.type === ChannelType.GuildCategory) {
            await channel.setParent(cat).catch(() => {});
        }
    }

    const owner = await channel.guild.members.fetch(ticket.user_id).catch(() => null);
    const cleanName = `ticket-${sanitizeChannelName(owner?.displayName || 'user')}`;
    await channel.setName(cleanName).catch(() => {});

    const reopenEmbed = new EmbedBuilder()
        .setTitle('🔓 Ticket Rouvert')
        .setDescription(`Ce ticket a été rouvert par ${user}`)
        .setColor('#00ff00');

    const ticketRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('Fermer le ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
    );

    await interaction.reply({ embeds: [reopenEmbed], components: [ticketRow] });
    await updateTicket(channel.id, { status: 'open', closed_by: null, closed_at: null });
}

async function handleDeleteTicket(interaction) {
    const { user, channel } = interaction;
    const ticket = await getTicket(channel.id);
    if (!ticket) return interaction.reply({ content: '❌ Ticket non trouvé.', ephemeral: true });

    const config = await getGuildConfig(interaction.guild.id);
    if (!config?.staff_role_id || !interaction.member.roles.cache.has(config.staff_role_id)) {
        return interaction.reply({ content: '❌ Seul le staff peut supprimer un ticket.', ephemeral: true });
    }

    const deleteEmbed = new EmbedBuilder()
        .setTitle('🗑️ Supprimer définitivement')
        .setDescription('⚠️ Cette action est irréversible !')
        .setColor('#ff0000');

    const deleteRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_delete').setLabel('Oui, supprimer').setStyle(ButtonStyle.Danger).setEmoji('💀'),
        new ButtonBuilder().setCustomId('cancel_delete').setLabel('Annuler').setStyle(ButtonStyle.Secondary).setEmoji('❌')
    );

    await interaction.reply({ embeds: [deleteEmbed], components: [deleteRow] });
}

async function handleConfirmDelete(interaction) {
    const { channel } = interaction;
    const ticket = await getTicket(channel.id);
    if (!ticket) return interaction.reply({ content: '❌ Ticket non trouvé.', ephemeral: true });

    await interaction.reply('🗑️ Suppression définitive...');
    await deleteTicket(channel.id);
    await channel.delete().catch(() => {});
}

async function handleCancelDelete(interaction) {
    await interaction.update({ content: '❌ Suppression annulée.', embeds: [], components: [] });
}

// ============================================
// TRANSCRIPT
// ============================================

async function createTranscript(channel, ticket, closedBy, client) {
    try {
        const ticketCreator = await client.users.fetch(ticket.user_id).catch(() => null);
        const messages = await fetchAllMessages(channel);

        let content = `=== TRANSCRIPT ===\n`;
        content += `Salon: ${channel.name}\nID: ${channel.id}\n`;
        content += `Créé par: ${ticketCreator?.tag || ticket.user_id}\n`;
        content += `Fermé par: ${closedBy.tag}\nFermé le: ${new Date().toLocaleString('fr-FR')}\n`;
        content += `Messages: ${messages.length}\nServeur: ${channel.guild.name}\n`;
        content += `\n${'='.repeat(60)}\n\n`;

        messages.forEach(msg => {
            content += `[${msg.createdAt.toLocaleString('fr-FR')}] ${msg.author.tag}: ${msg.content}\n`;
            msg.attachments.forEach(att => { content += `  ↳ Fichier: ${att.url}\n`; });
        });

        const fileName = `transcript-${channel.guild.id}-${channel.id}-${Date.now()}.txt`;
        const filePath = `${channel.guild.id}/${fileName}`;

        // Upload vers Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('transcripts')
            .upload(filePath, Buffer.from(content, 'utf-8'), {
                contentType: 'text/plain',
                upsert: false
            });

        if (uploadError) {
            console.error('[Tickets] ❌ Erreur upload transcript:', uploadError.message);
            return;
        }

        // Récupérer l'URL publique
        const { data: urlData } = supabase.storage
            .from('transcripts')
            .getPublicUrl(filePath);

        const transcriptUrl = urlData.publicUrl;

        // Envoi en MP
        if (ticketCreator) {
            const dmEmbed = new EmbedBuilder()
                .setTitle('📋 Transcript de votre ticket')
                .setDescription(`Historique du ticket **${channel.name}**\n\n[📥 Télécharger le transcript](${transcriptUrl})`)
                .setColor('#0099ff')
                .setTimestamp();
            await ticketCreator.send({ embeds: [dmEmbed] }).catch(() => {});
        }

        // Envoi dans le salon de logs
        const config = await getGuildConfig(channel.guild.id);
        if (config?.log_channel_id) {
            const logChannel = client.channels.cache.get(config.log_channel_id);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📋 Transcript ticket fermé')
                    .setDescription(`Ticket **${channel.name}** fermé par ${closedBy}`)
                    .addFields(
                        { name: '👤 Créé par', value: ticketCreator?.tag || ticket.user_id, inline: true },
                        { name: '🔒 Fermé par', value: closedBy.tag, inline: true },
                        { name: '💬 Messages', value: messages.length.toString(), inline: true },
                        { name: '📥 Transcript', value: `[Télécharger](${transcriptUrl})`, inline: false }
                    )
                    .setColor('#ff9900')
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        }

        console.log(`[Tickets] ✅ Transcript créé: ${transcriptUrl}`);
    } catch (error) {
        console.error('[Tickets] ❌ Erreur transcript:', error);
    }
}

async function fetchAllMessages(channel) {
    let messages = [];
    let lastId;
    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        const fetched = await channel.messages.fetch(options);
        if (fetched.size === 0) break;
        messages = messages.concat(Array.from(fetched.values()));
        lastId = fetched.lastKey();
    }
    return messages.reverse();
}