const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { getLeaderboard } = require('../../database/queries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('classement')
        .setDescription("Affiche le classement des 10 meilleurs joueurs du serveur."),

    async execute(interaction, client) {
        try {
            await interaction.deferReply();

            const guildId = interaction.guild.id;
            const dbLeaderboard = await getLeaderboard(guildId);

            if (!dbLeaderboard || dbLeaderboard.length === 0) {
                return interaction.editReply("ℹ️ Aucun membre n'a encore gagné d'XP sur ce serveur.");
            }

            // Récupérer les informations Discord des utilisateurs
            const leaderboardData = [];
            for (let i = 0; i < dbLeaderboard.length; i++) {
                const entry = dbLeaderboard[i];
                let user = client.users.cache.get(entry.user_id);
                if (!user) {
                    user = await client.users.fetch(entry.user_id).catch(() => null);
                }

                leaderboardData.push({
                    rank: i + 1,
                    username: user ? user.username : 'Utilisateur inconnu',
                    avatarURL: user ? user.displayAvatarURL({ extension: 'png', size: 128 }) : 'https://discord.com/assets/5d6a5e2c52cd9e416599ccad2354c8d0.png',
                    level: entry.level,
                    xp: entry.xp
                });
                if (i >= 9) break; // Sécurité top 10
            }

            // Dimensions de l'image
            const canvasWidth = 800;
            const canvasHeight = 120 + (leaderboardData.length * 70);
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            // 1. Fond dégradé
            const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
            gradient.addColorStop(0, '#1e1f22');
            gradient.addColorStop(1, '#0f1011');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Subtile effet de quadrillage
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.lineWidth = 1;
            const gridSize = 50;
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

            // 2. Titre du classement
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Arial, "Helvetica Neue", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`CLASSEMENT - ${interaction.guild.name.toUpperCase()}`, canvasWidth / 2, 60);

            // Ligne décorative sous le titre
            ctx.strokeStyle = '#5865F2';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(canvasWidth / 2 - 180, 80);
            ctx.lineTo(canvasWidth / 2 + 180, 80);
            ctx.stroke();

            // 3. Dessiner chaque ligne
            let currentY = 110;
            for (const row of leaderboardData) {
                // Fond de la ligne (alternance de couleurs subtiles pour lisibilité)
                ctx.fillStyle = row.rank % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.06)';
                drawRoundedRect(ctx, 40, currentY, canvasWidth - 80, 60, 8);
                ctx.fill();

                // Rang avec couleur spéciale pour le Top 3
                let rankColor = '#ffffff';
                if (row.rank === 1) rankColor = '#FFD700'; // Or
                else if (row.rank === 2) rankColor = '#C0C0C0'; // Argent
                else if (row.rank === 3) rankColor = '#CD7F32'; // Bronze

                ctx.fillStyle = rankColor;
                ctx.font = 'bold 24px Arial, "Helvetica Neue", sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`#${row.rank}`, 70, currentY + 37);

                // Avatar
                let avatar;
                try {
                    avatar = await loadImage(row.avatarURL);
                } catch {
                    avatar = await loadImage('https://discord.com/assets/5d6a5e2c52cd9e416599ccad2354c8d0.png');
                }

                ctx.save();
                ctx.beginPath();
                ctx.arc(160, currentY + 30, 20, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, 140, currentY + 10, 40, 40);
                ctx.restore();

                // Pseudo
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 22px Arial, "Helvetica Neue", sans-serif';
                let displayUsername = row.username;
                if (displayUsername.length > 18) displayUsername = displayUsername.slice(0, 18) + '...';
                ctx.fillText(displayUsername, 200, currentY + 37);

                // Niveau
                ctx.fillStyle = '#5865F2';
                ctx.font = 'bold 20px Arial, "Helvetica Neue", sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(`Niveau ${row.level}`, canvasWidth - 250, currentY + 37);

                // XP total
                ctx.fillStyle = '#99AAB5';
                ctx.font = '20px Arial, "Helvetica Neue", sans-serif';
                ctx.fillText(`${row.xp.toLocaleString('fr-FR')} XP`, canvasWidth - 80, currentY + 37);

                currentY += 70;
            }

            const buffer = canvas.toBuffer('image/png');
            const attachment = new AttachmentBuilder(buffer, { name: 'classement.png' });

            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('[Classement Command] Erreur:', error);
            await interaction.editReply('❌ Une erreur est survenue lors de la génération du classement.');
        }
    }
};

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
