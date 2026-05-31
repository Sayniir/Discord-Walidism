// music.js - Module musique avec discord-player (inspiré de Lucky bot)
const { Player, QueryType } = require("discord-player");
const { EmbedBuilder } = require("discord.js");
const {
  SoundCloudExtractor,
  AppleMusicExtractor,
  VimeoExtractor,
  AttachmentExtractor,
} = require("@discord-player/extractor");
const { SpotifyExtractor } = require("discord-player-spotify");
const playdl = require("play-dl");

class MusicBot {
  constructor(client) {
    this.client = client;
    this.player = null;
  }

  async init() {
    try {
      console.log("🎵 Initialisation du module musique...");

      // Créer le player
      this.player = new Player(this.client);

      // Enregistrer les extracteurs
      await this.registerExtractors();

      // Configurer les événements du player
      this.setupPlayerEvents();

      console.log("[Music] ✅ Module musique initialisé.");
    } catch (error) {
      console.error("[Music] ❌ Erreur initialisation:", error);
      throw error;
    }
  }

  async registerExtractors() {
    try {
      // 1. Spotify (priorité haute)
      if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
        await this.player.extractors.register(SpotifyExtractor, {
          clientId: process.env.SPOTIFY_CLIENT_ID,
          clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
          market: "US",
        });
        console.log("[Music] ✅ Spotify extractor enregistré");
      }

      // 2. YouTube (via discord-player-youtubei)
      try {
        const { YoutubeExtractor } = require("discord-player-youtubei");
        await this.player.extractors.register(YoutubeExtractor, {});
        console.log("[Music] ✅ YouTube extractor enregistré");
      } catch (error) {
        console.warn("[Music] ⚠️ YouTube extractor non disponible:", error.message);
      }

      // 3. SoundCloud
      try {
        const clientId = await playdl.getFreeClientID();
        await playdl.setToken({ soundcloud: { client_id: clientId } });
        await this.player.extractors.register(SoundCloudExtractor, {});
        console.log("[Music] ✅ SoundCloud extractor enregistré");
      } catch (error) {
        console.warn("[Music] ⚠️ SoundCloud extractor non disponible:", error.message);
      }

      // 4. Autres extracteurs
      await this.player.extractors.register(AppleMusicExtractor, {});
      await this.player.extractors.register(VimeoExtractor, {});
      await this.player.extractors.register(AttachmentExtractor, {});
      console.log("[Music] ✅ Extracteurs supplémentaires enregistrés");
    } catch (error) {
      console.error("[Music] ❌ Erreur lors de l'enregistrement des extracteurs:", error);
    }
  }

  setupPlayerEvents() {
    // Événement: Début de lecture
    this.player.events.on("playerStart", (queue, track) => {
      const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("🎵 Lecture en cours")
        .setDescription(`**${track.title}**`)
        .addFields(
          { name: "👤 Artiste", value: track.author || "Inconnu", inline: true },
          { name: "⏱️ Durée", value: track.duration || "Inconnue", inline: true },
          { name: "🎧 Demandé par", value: track.requestedBy?.displayName || "Inconnu", inline: true }
        )
        .setThumbnail(track.thumbnail);

      queue.metadata.channel.send({ embeds: [embed] });
    });

    // Événement: Erreur
    this.player.events.on("error", (queue, error) => {
      console.error(`[Music] ❌ Erreur générale:`, error);
      queue.metadata.channel.send("❌ Une erreur est survenue lors de la lecture.");
    });

    this.player.events.on("playerError", (queue, error) => {
      console.error(`[Music] ❌ Erreur de lecture:`, error);
      queue.metadata.channel.send("❌ Impossible de lire cette piste.");
    });

    // Événement: File vide
    this.player.events.on("emptyQueue", (queue) => {
      console.log(`[Music] 📭 File vide sur ${queue.guild.name}`);
      queue.metadata.channel.send("📭 La file d'attente est vide. Déconnexion...");
    });

    // Événement: Salon vide
    this.player.events.on("emptyChannel", (queue) => {
      console.log(`[Music] 👤 Salon vide sur ${queue.guild.name}`);
      queue.metadata.channel.send("👤 Plus personne dans le salon. Déconnexion...");
    });

    console.log("[Music] ✅ Événements du player configurés");
  }

  async handlePlayCommand(interaction) {
    try {
      const query = interaction.options.getString("recherche");
      const member = interaction.member;
      const channel = member.voice.channel;

      if (!channel) {
        return interaction.reply({
          content: "❌ Vous devez être dans un salon vocal!",
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      // Rechercher la piste
      const searchResult = await this.player.search(query, {
        requestedBy: member,
        searchEngine: QueryType.AUTO,
      });

      if (!searchResult || !searchResult.tracks.length) {
        return interaction.editReply({
          content: `❌ Aucun résultat trouvé pour: "${query}"`,
        });
      }

      // Créer ou récupérer la queue
      const queue = this.player.nodes.create(interaction.guild, {
        metadata: {
          channel: interaction.channel,
          requestedBy: member,
        },
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 30000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 30000,
      });

      // Connecter au salon vocal si nécessaire
      if (!queue.connection) {
        await queue.connect(channel);
      }

      // Ajouter les pistes
      if (searchResult.playlist) {
        queue.addTrack(searchResult.tracks);
        await interaction.editReply({
          content: `✅ Playlist ajoutée: **${searchResult.playlist.title}** (${searchResult.tracks.length} pistes)`,
        });
      } else {
        queue.addTrack(searchResult.tracks[0]);
        await interaction.editReply({
          content: `✅ Ajouté à la file: **${searchResult.tracks[0].title}**`,
        });
      }

      // Démarrer la lecture si nécessaire
      if (!queue.isPlaying()) {
        await queue.node.play();
      }
    } catch (error) {
      console.error("[Music] ❌ Erreur handlePlayCommand:", error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: "❌ Une erreur est survenue lors de la lecture.",
        });
      } else {
        await interaction.reply({
          content: "❌ Une erreur est survenue lors de la lecture.",
          ephemeral: true,
        });
      }
    }
  }

  async handleStopCommand(interaction) {
    const queue = this.player.nodes.get(interaction.guild);

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: "❌ Aucune musique en cours de lecture.",
        ephemeral: true,
      });
    }

    queue.delete();
    await interaction.reply("⏹️ Musique arrêtée et file vidée.");
  }

  async handleSkipCommand(interaction) {
    const queue = this.player.nodes.get(interaction.guild);

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: "❌ Aucune musique en cours de lecture.",
        ephemeral: true,
      });
    }

    const currentTrack = queue.currentTrack;
    queue.node.skip();
    await interaction.reply(`⏭️ Piste passée: **${currentTrack.title}**`);
  }

  async handlePauseCommand(interaction) {
    const queue = this.player.nodes.get(interaction.guild);

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: "❌ Aucune musique en cours de lecture.",
        ephemeral: true,
      });
    }

    if (queue.node.isPaused()) {
      queue.node.resume();
      await interaction.reply("▶️ Lecture reprise.");
    } else {
      queue.node.pause();
      await interaction.reply("⏸️ Lecture en pause.");
    }
  }

  async handleQueueCommand(interaction) {
    const queue = this.player.nodes.get(interaction.guild);

    if (!queue || !queue.tracks.data.length) {
      return interaction.reply({
        content: "📭 La file d'attente est vide.",
        ephemeral: true,
      });
    }

    const tracks = queue.tracks.data.slice(0, 10);
    const queueList = tracks
      .map((track, index) => `${index + 1}. **${track.title}** - ${track.author}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("📋 File d'attente")
      .setDescription(
        `**En cours:**\n${queue.currentTrack.title}\n\n**À venir:**\n${queueList}`
      )
      .setFooter({
        text: `${queue.tracks.data.length} piste(s) dans la file`,
      });

    await interaction.reply({ embeds: [embed] });
  }

  async handleNowPlayingCommand(interaction) {
    const queue = this.player.nodes.get(interaction.guild);

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: "❌ Aucune musique en cours de lecture.",
        ephemeral: true,
      });
    }

    const track = queue.currentTrack;
    const progress = queue.node.createProgressBar();

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("🎵 Lecture en cours")
      .setDescription(`**${track.title}**`)
      .addFields(
        { name: "👤 Artiste", value: track.author || "Inconnu", inline: true },
        { name: "⏱️ Durée", value: track.duration || "Inconnue", inline: true },
        { name: "🎧 Demandé par", value: track.requestedBy?.displayName || "Inconnu", inline: true },
        { name: "📊 Progression", value: progress, inline: false }
      )
      .setThumbnail(track.thumbnail);

    await interaction.reply({ embeds: [embed] });
  }

  async handleVolumeCommand(interaction) {
    const queue = this.player.nodes.get(interaction.guild);
    const volume = interaction.options.getInteger("niveau");

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: "❌ Aucune musique en cours de lecture.",
        ephemeral: true,
      });
    }

    queue.node.setVolume(volume);
    await interaction.reply(`🔊 Volume défini à ${volume}%`);
  }

  async handleShuffleCommand(interaction) {
    const queue = this.player.nodes.get(interaction.guild);

    if (!queue || !queue.tracks.data.length) {
      return interaction.reply({
        content: "❌ Pas assez de pistes dans la file.",
        ephemeral: true,
      });
    }

    queue.tracks.shuffle();
    await interaction.reply(`🔀 File d'attente mélangée (${queue.tracks.data.length} pistes)`);
  }

  async handleClearCommand(interaction) {
    const queue = this.player.nodes.get(interaction.guild);

    if (!queue || !queue.tracks.data.length) {
      return interaction.reply({
        content: "❌ La file est déjà vide.",
        ephemeral: true,
      });
    }

    const count = queue.tracks.data.length;
    queue.tracks.clear();
    await interaction.reply(`🗑️ File vidée (${count} pistes supprimées)`);
  }

  setupEventListeners() {
    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      try {
        switch (interaction.commandName) {
          case "play":
            await this.handlePlayCommand(interaction);
            break;
          case "stop":
            await this.handleStopCommand(interaction);
            break;
          case "skip":
            await this.handleSkipCommand(interaction);
            break;
          case "queue":
            await this.handleQueueCommand(interaction);
            break;
          case "nowplaying":
            await this.handleNowPlayingCommand(interaction);
            break;
          case "pause":
            await this.handlePauseCommand(interaction);
            break;
          case "volume":
            await this.handleVolumeCommand(interaction);
            break;
          case "shuffle":
            await this.handleShuffleCommand(interaction);
            break;
          case "clear":
            await this.handleClearCommand(interaction);
            break;
        }
      } catch (error) {
        console.error("[Music] ❌ Erreur commande:", error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ Une erreur est survenue.",
            ephemeral: true,
          });
        }
      }
    });
  }
}

module.exports = MusicBot;
