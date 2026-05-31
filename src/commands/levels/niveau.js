const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { getUserXP } = require('../../database/queries');
const { calculateLevel } = require('../../utils/levels');
const supabase = require('../../database/supabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('niveau')
        .setDescription("Affiche votre niveau ou celui d'un autre utilisateur.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription("L'utilisateur dont vous voulez voir le niveau")
                .setRequired(false)
        ),

    async execute(interaction, client) {
        try {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            // Récupérer les données de la base de données
            const userData = await getUserXP(guildId, targetUser.id);
            const { level, currentXP, nextLevelXP, requiredXP, progress, progressPercentage } = calculateLevel(userData.xp);

            // Récupérer le classement pour trouver le rang
            const { data: allUsers, error: rankError } = await supabase
                .from('levels')
                .select('user_id')
                .eq('guild_id', guildId)
                .order('xp', { ascending: false });

            let rank = 0;
            if (!rankError && allUsers) {
                const foundIndex = allUsers.findIndex(u => u.user_id === targetUser.id);
                if (foundIndex !== -1) {
                    rank = foundIndex + 1;
                } else {
                    rank = allUsers.length + 1;
                }
            } else {
                rank = '?';
            }

            // Générer l'image Canvas
            const canvasWidth = 934;
            const canvasHeight = 282;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            // 1. Fond dégradé premium
            const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
            gradient.addColorStop(0, '#1a1c1e');
            gradient.addColorStop(0.5, '#141517');
            gradient.addColorStop(1, '#0c0d0e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Ajout d'un effet de grille moderne subtil en arrière-plan
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            const gridSize = 40;
            for (let x = 0; x < canvasWidth; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvasHeight);
                ctx.stroke();
            }
            for (let y = 0; y < canvasHeight; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvasWidth, y);
                ctx.stroke();
            }

            // 2. Avatar de l'utilisateur
            const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            let avatar;
            try {
                avatar = await loadImage(avatarURL);
            } catch {
                // Fallback avatar par défaut si le chargement échoue
                avatar = await loadImage('https://discord.com/assets/5d6a5e2c52cd9e416599ccad2354c8d0.png');
            }

            // Cercle d'avatar
            ctx.save();
            ctx.beginPath();
            ctx.arc(140, 141, 80, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 60, 61, 160, 160);
            ctx.restore();

            // Bordure brillante autour de l'avatar
            ctx.strokeStyle = '#5865F2';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(140, 141, 83, 0, Math.PI * 2);
            ctx.stroke();

            // 3. Dessiner les textes
            // Nom de l'utilisateur
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 38px Arial, "Helvetica Neue", sans-serif';
            ctx.textAlign = 'left';
            
            // Tronquer le pseudo s'il est trop long
            let username = targetUser.username;
            if (username.length > 15) username = username.slice(0, 15) + '...';
            ctx.fillText(username, 260, 95);

            // Reste des infos textuelles (Rang et Level)
            ctx.fillStyle = '#5865F2';
            ctx.font = 'bold 24px Arial, "Helvetica Neue", sans-serif';
            ctx.fillText(`RANG #${rank}`, 260, 145);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Arial, "Helvetica Neue", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`NIVEAU ${level}`, canvasWidth - 60, 145);

            // Affichage de l'XP actuel et requis
            ctx.fillStyle = '#99AAB5';
            ctx.font = '20px Arial, "Helvetica Neue", sans-serif';
            ctx.fillText(`${progress.toLocaleString('fr-FR')} / ${requiredXP.toLocaleString('fr-FR')} XP`, canvasWidth - 60, 205);

            // 4. Progress bar rounded
            const pbX = 260;
            const pbY = 220;
            const pbWidth = 614;
            const pbHeight = 26;
            const pbRadius = 13;

            // Fond de la barre
            ctx.fillStyle = '#2b2d31';
            drawRoundedRect(ctx, pbX, pbY, pbWidth, pbHeight, pbRadius);
            ctx.fill();

            // Remplissage de la barre
            ctx.fillStyle = '#5865F2';
            const fillWidth = Math.max(pbRadius * 2, (progressPercentage / 100) * pbWidth);
            if (progressPercentage > 0) {
                drawRoundedRect(ctx, pbX, pbY, fillWidth, pbHeight, pbRadius);
                ctx.fill();
            }

            // Générer le buffer
            const buffer = canvas.toBuffer('image/png');
            const attachment = new AttachmentBuilder(buffer, { name: 'level.png' });

            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('[Niveau Command] Erreur:', error);
            await interaction.editReply('❌ Une erreur est survenue lors de la génération de votre carte de niveau.');
        }
    }
};

// Helper function to draw rounded rectangles
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}
