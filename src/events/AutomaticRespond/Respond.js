module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;

        const content = message.content.toLowerCase();

        // Anglais
        if (content.includes('hello')) {
            await message.react('👋').catch(() => {});
            await message.channel.send('Hi !').catch(() => {});
        } else if (content.includes('help') || content.includes('aide')) {
            await message.channel.send('Pour obtenir de l\'aide, consulte les salons d\'aide du serveur !').catch(() => {});
        } else if (content.includes('rule') || content.includes('regle')) {
            await message.channel.send('Tu peux trouver les règles dans le salon dédié du serveur !').catch(() => {});
        } else if (content.includes('new') || content.includes('nouveau')) {
            await message.channel.send('Les nouveautés sont disponibles dans le salon d\'annonces du serveur !').catch(() => {});
        }

        // Français
        if (content.includes('salut')) {
            await message.react('👋').catch(() => {});
            await message.channel.send('Salut !').catch(() => {});
        }

        // Easter eggs
        if (content.includes('bite')) {
            await message.react('👀').catch(() => {});
        }
    }
};
