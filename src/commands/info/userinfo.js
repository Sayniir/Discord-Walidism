const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription("Affiche des informations détaillées sur un utilisateur.")
        .addUserOption(option =>
            option.setName('utilisateur')
                .setDescription("L'utilisateur à inspecter")
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

            await interaction.deferReply();

            let targetMember;
            try {
                targetMember = await interaction.guild.members.fetch(targetUser.id);
            } catch {
                return interaction.editReply({ content: '❌ Cet utilisateur n\'est pas membre de ce serveur.' });
            }

            const joinedAt = targetMember.joinedAt ? `<t:${Math.floor(targetMember.joinedAt.getTime() / 1000)}:F>` : 'Inconnu';
            const createdAt = `<t:${Math.floor(targetUser.createdAt.getTime() / 1000)}:F>`;
            
            // Récupérer et filtrer les rôles (exclure le rôle @everyone)
            const roles = targetMember.roles.cache
                .filter(role => role.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString());

            const rolesDisplay = roles.length > 0 
                ? (roles.length > 10 ? `${roles.slice(0, 10).join(' ')} et ${roles.length - 10} autres...` : roles.join(' '))
                : 'Aucun rôle';

            const embed = new EmbedBuilder()
                .setTitle(`Informations de ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .setColor(targetMember.displayHexColor === '#000000' ? '#99aab5' : targetMember.displayHexColor)
                .addFields(
                    { name: '👤 Utilisateur', value: `${targetUser.toString()}\n\`${targetUser.id}\``, inline: true },
                    { name: '📅 Création du compte', value: createdAt, inline: true },
                    { name: '📥 Arrivée sur le serveur', value: joinedAt, inline: true },
                    { name: `🎭 Rôles [${roles.length}]`, value: rolesDisplay, inline: false }
                )
                .setFooter({ text: `ID: ${targetUser.id}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[UserInfo Command] Erreur:', error);
            await interaction.editReply({ content: '❌ Une erreur est survenue lors de la récupération des informations de l\'utilisateur.' });
        }
    }
};
