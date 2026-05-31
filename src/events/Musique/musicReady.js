const MusicBot = require('./player');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        try {
            const musicBot = new MusicBot(client);
            await musicBot.init();
            console.log('[Music] ✅ Module musique initialisé.');
        } catch (error) {
            console.error('[Music] ❌ Erreur initialisation module musique:', error);
        }
    }
};
