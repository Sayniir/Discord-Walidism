const { getUserXP, setUserXP } = require('../../database/queries');
const { calculateLevel } = require('../../utils/levels');

const XP_COOLDOWN = 60 * 1000; // 60 secondes entre messages

// ============================================
// EVENT: messageCreate - gain XP
// ============================================

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        try {
            const guildId = message.guild.id;
            const userId = message.author.id;

            const userData = await getUserXP(guildId, userId);
            const now = Date.now();

            // Cooldown
            if (now - (userData.last_message || 0) < XP_COOLDOWN) return;

            const xpGained = Math.floor(Math.random() * 11) + 10;
            const oldLevel = calculateLevel(userData.xp).level;
            const newXP = userData.xp + xpGained;
            const newLevel = calculateLevel(newXP).level;

            // Sauvegarder
            await setUserXP(guildId, userId, { xp: newXP, level: newLevel, last_message: now });

            // Message de level up
            if (newLevel > oldLevel) {
                await message.channel.send(`**GG ${message.author}, tu es maintenant niveau ${newLevel} !** 🎉`).catch(() => {});
            }
        } catch (error) {
            console.error('[Levels] ❌ Erreur gain XP:', error.message);
        }
    }
};
