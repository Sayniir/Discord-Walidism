module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;

        const content = message.content.toLowerCase().trim();

        // 1. !blague command
        if (content === '!blague') {
            const jokes = [
                "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ? Parce que sinon ils tombent dans le bateau !",
                "Qu'est-ce qu'un chameau à trois bosses ? Un chameau qui s'est cogné !",
                "Pourquoi les oiseaux volent-ils vers le sud en hiver ? Parce que c'est trop long d'y aller à pied !",
                "Que fait un canard quand il a froid ? Il se caille !",
                "Pourquoi les flamants roses dorment-ils sur une patte ? Parce que s'ils levaient la deuxième, ils tomberaient !",
                "Quel est le comble pour un électricien ? De ne pas être au courant.",
                "Qu'est-ce qui est jaune et qui attend ? Jonathan !",
                "Pourquoi les poissons vivent-ils dans l'eau salée ? Parce que le poivre les fait éternuer !",
                "Comment appelle-t-on un chat qui va dans l'espace ? Un chat-lute !",
                "Pourquoi la boîte de conserve n'a-t-elle pas pu entrer dans la boîte de nuit ? Parce que c'était une boîte de conserve de petits pois !"
            ];
            const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
            return message.reply(randomJoke).catch(() => {});
        }

        // 2. batabintou meme trigger
        if (content.includes('batabintou') || content.includes('bata bintou')) {
            return message.reply("💃 **BATA BINTOU !** 🕺").catch(() => {});
        }

        // 3. ri meme trigger (reply exactly "ri" if they say exactly "ri" or similar)
        if (content === 'ri') {
            return message.reply("ri").catch(() => {});
        }
    }
};
