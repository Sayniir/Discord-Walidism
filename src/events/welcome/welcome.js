const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const { getGuildConfig } = require('../../database/queries');

// Enregistrer la police personnalisée
try {
    GlobalFonts.registerFromPath(path.join(__dirname, '../assets/fonts/DejaVuSans-Bold.ttf'), 'DejaVu Sans');
} catch {}

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            const config = await getGuildConfig(member.guild.id);
            if (!config?.welcome_channel_id) return;

            const channel = member.guild.channels.cache.get(config.welcome_channel_id);
            if (!channel?.isTextBased()) return;

            // Générer l'image de bienvenue
            try {
                const attachment = await createWelcomeImage(member);
                await channel.send({ content: `${member}`, files: [attachment] });
            } catch (imgError) {
                console.error('[Welcome] ❌ Erreur image, fallback embed:', imgError.message);
                // Fallback embed
                const embed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setDescription(`**Bienvenue ${member.user.displayName} sur le serveur !**\n\ntu es le ${member.guild.memberCount.toLocaleString('fr-FR')}ème membre.`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setTimestamp();
                await channel.send({ content: `${member}`, embeds: [embed] });
            }
        } catch (error) {
            console.error('[Welcome] ❌ Erreur:', error);
        }
    }
};

async function createWelcomeImage(member) {
    const padding = 40;
    const canvasWidth = 1000;
    const canvasHeight = 450;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fond dégradé
    const gradient = ctx.createLinearGradient(canvasWidth, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#0F2027');
    gradient.addColorStop(1, '#2C5364');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // Avatar
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
    const avatar = await loadImage(avatarURL);
    const avatarSize = 180;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY - 90, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, centerX - avatarSize / 2, centerY - 90 - avatarSize / 2, avatarSize, avatarSize);
    ctx.restore();

    // Bordure avatar
    ctx.strokeStyle = '#b9b9b9ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 90, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();

    // Texte de bienvenue
    ctx.fillStyle = '#ffffff';
    let fontSize = 48;
    const maxWidth = canvasWidth - (padding * 2) - 40;
    let welcomeText = `Bienvenue ${member.user.displayName} sur le serveur !`;

    ctx.font = `bold ${fontSize}px "DejaVu Sans"`;
    while (ctx.measureText(welcomeText).width > maxWidth && fontSize > 24) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px "DejaVu Sans"`;
    }

    ctx.textAlign = 'center';
    ctx.fillText(welcomeText, centerX, centerY + 60);

    // Texte membres
    ctx.font = `36px "DejaVu Sans"`;
    ctx.fillStyle = '#e1eaf0ff';
    ctx.fillText(`tu es le ${member.guild.memberCount.toLocaleString('fr-FR')}ème membre.`, centerX, centerY + 110);

    // Ligne décorative
    ctx.strokeStyle = '#207dacff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 150, centerY + 130);
    ctx.lineTo(centerX + 150, centerY + 130);
    ctx.stroke();

    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'welcome.png' });
}
