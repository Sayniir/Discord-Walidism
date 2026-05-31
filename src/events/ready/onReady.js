const { ActivityType } = require('discord.js');

const statusList = [
    { name: "Nah, i'd win", type: ActivityType.Custom },
    { name: "the best streamer", type: ActivityType.Streaming, url: "https://www.twitch.tv/anyme023" },
    { name: "with the best bot", type: ActivityType.Playing },
    { name: "the best community", type: ActivityType.Competing },
    { name: "WALIDISM", type: ActivityType.Custom },
    { name: "Sayniir on top", type: ActivityType.Custom },
    { name: "les tickets", type: ActivityType.Watching },
    { name: "Devil in disguise - Marino", type: ActivityType.Listening },
];

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        try {
            await client.application.fetch();

            console.log(`[Ready] ✅ Connecté en tant que ${client.user.tag}`);
            console.log(`[Ready] 🏠 ${client.guilds.cache.size} serveur(s)`);
            console.log(`[Ready] 👥 ${client.users.cache.size} utilisateur(s)`);

            // Définir le statut initial
            client.user.setStatus('online');
            setRandomActivity(client);

            // Rotation des statuts toutes les 100s
            setInterval(() => setRandomActivity(client), 100_000);

        } catch (error) {
            console.error('[Ready] ❌ Erreur:', error);
        }
    }
};

function setRandomActivity(client) {
    if (!client.user) return;
    const status = statusList[Math.floor(Math.random() * statusList.length)];
    const options = { type: status.type };
    if (status.url) options.url = status.url;
    client.user.setActivity(status.name, options);
}
