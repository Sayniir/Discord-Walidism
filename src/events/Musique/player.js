// music.js — Module musique streaming pour bot Discord
// Dépendances : @discordjs/voice, discord.js, play-dl, yt-search, spotify-web-api-node, ytpl, p-limit, ffmpeg-static

"use strict";

const { EmbedBuilder } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} = require("@discordjs/voice");
const playdl       = require("play-dl");
const ytSearch     = require("yt-search");
const SpotifyWebApi = require("spotify-web-api-node");
const ffmpegStatic = require("ffmpeg-static");
const ytpl         = require("ytpl");
const pLimit       = require("p-limit");

// ─── FFmpeg ───────────────────────────────────────────────────────────────────
if (ffmpegStatic) {
  process.env.FFMPEG_PATH = ffmpegStatic;
} else {
  console.error("[Music] ffmpeg-static introuvable !");
}

// ─── Spotify ──────────────────────────────────────────────────────────────────
const spotify = new SpotifyWebApi({
  clientId:     process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

async function refreshSpotifyToken() {
  const data = await spotify.clientCredentialsGrant();
  spotify.setAccessToken(data.body.access_token);
}

// ─── État par serveur ─────────────────────────────────────────────────────────
// Une seule Map par serveur contenant tout l'état — plus de désync possible
const servers = new Map();
// Structure : { queue: [], player: AudioPlayer, voiceChannel: VoiceChannel, paused: bool }

function getServer(guildId) {
  if (!servers.has(guildId)) {
    servers.set(guildId, { queue: [], player: null, voiceChannel: null, paused: false });
  }
  return servers.get(guildId);
}

function deleteServer(guildId) {
  servers.delete(guildId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  seconds = Math.floor(Number(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseDurationToSeconds(str = "0:00") {
  const parts = str.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function extractSpotifyId(url) {
  return url.split("/").pop().split("?")[0];
}

function isPlaylistLink(query) {
  return (
    query.includes("youtube.com/playlist") ||
    (query.includes("youtube.com/watch?") && query.includes("list=")) ||
    query.includes("open.spotify.com/playlist") ||
    query.includes("open.spotify.com/album")
  );
}

function embed(color, title, description) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
}

// ─── Recherche / Sources ──────────────────────────────────────────────────────
async function searchSong(query) {
  // 1. Lien YouTube direct
  if (playdl.yt_validate(query) === "video") {
    const info = await playdl.video_info(query);
    const v = info.video_details;
    return {
      title:     v.title,
      artist:    v.channel?.name || "Inconnu",
      url:       v.url,
      duration:  formatDuration(v.durationInSec),
      thumbnail: v.thumbnails[0]?.url,
      source:    "youtube",
    };
  }

  // 2. Lien Spotify track
  if (query.includes("spotify.com/track/")) {
    const trackId = query.split("/track/")[1].split("?")[0];
    try {
      const { body: track } = await spotify.getTrack(trackId);
      const results = await playdl.search(`${track.artists[0].name} ${track.name}`, {
        source: { youtube: "video" }, limit: 1,
      });
      if (results.length > 0) {
        const v = results[0];
        return {
          title:     track.name,
          artist:    track.artists[0].name,
          url:       v.url,
          duration:  formatDuration(v.durationInSec),
          thumbnail: track.album.images[0]?.url || v.thumbnails[0]?.url,
          source:    "spotify",
        };
      }
    } catch (err) {
      console.warn("[Music] Spotify track introuvable, fallback recherche texte:", err.message);
    }
  }

  // 3. Recherche textuelle
  const results = await playdl.search(query, { source: { youtube: "video" }, limit: 5 });
  if (results.length === 0) return null;

  const video = results.find((v) => v.durationInSec < 1800) || results[0];
  return {
    title:     video.title,
    artist:    video.channel?.name || "Inconnu",
    url:       video.url,
    duration:  formatDuration(video.durationInSec),
    thumbnail: video.thumbnails[0]?.url,
    source:    "youtube",
  };
}

async function searchYoutubeForSpotifyTrack(track, thumbnailFallback = null) {
  try {
    const result = await ytSearch(`${track.artists[0].name} ${track.name}`);
    const video  = result.videos.find((v) => v.seconds < 1200) || result.videos[0];
    if (!video) return null;
    return {
      title:     track.name,
      artist:    track.artists[0].name,
      url:       video.url,
      duration:  formatDuration(video.seconds),
      thumbnail: track.album?.images[0]?.url || thumbnailFallback || video.thumbnail,
      source:    "spotify",
    };
  } catch {
    return null;
  }
}

async function handlePlaylist(query) {
  if (query.includes("youtube.com/playlist") || (query.includes("youtube.com/watch?") && query.includes("list="))) {
    return handleYoutubePlaylist(query);
  }
  if (query.includes("open.spotify.com/playlist")) return handleSpotifyPlaylist(query);
  if (query.includes("open.spotify.com/album"))    return handleSpotifyAlbum(query);
  throw new Error("Type de playlist non supporté");
}

async function handleYoutubePlaylist(url) {
  const playlist = await ytpl(url, { limit: 100 });
  const songs = playlist.items
    .filter((item) => item?.title && !item.title.includes("[Private video]"))
    .map((item) => ({
      title:     item.title,
      artist:    item.author?.name || "Inconnu",
      url:       item.url,
      duration:  formatDuration(item.durationSec),
      thumbnail: item.bestThumbnail?.url,
      source:    "youtube",
    }));
  return { playlistTitle: playlist.title, songs };
}

async function handleSpotifyPlaylist(url) {
  const id           = extractSpotifyId(url);
  const [info, tracks] = await Promise.all([
    spotify.getPlaylist(id),
    spotify.getPlaylistTracks(id, { limit: 100 }),
  ]);
  const validTracks = tracks.body.items.map((i) => i.track).filter(Boolean);
  const limit       = pLimit(3);
  const results     = await Promise.allSettled(validTracks.map((t) => limit(() => searchYoutubeForSpotifyTrack(t))));
  const songs       = results.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);
  return { playlistTitle: info.body.name, songs };
}

async function handleSpotifyAlbum(url) {
  const id             = extractSpotifyId(url);
  const [album, tracks] = await Promise.all([
    spotify.getAlbum(id),
    spotify.getAlbumTracks(id, { limit: 100 }),
  ]);
  const cover  = album.body.images[0]?.url;
  const limit  = pLimit(3);
  const results = await Promise.allSettled(tracks.body.items.map((t) => limit(() => searchYoutubeForSpotifyTrack(t, cover))));
  const songs   = results.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);
  return { playlistTitle: album.body.name, songs };
}

// ─── Connexion vocale ─────────────────────────────────────────────────────────
async function getOrCreateConnection(guild, voiceChannel) {
  let connection = getVoiceConnection(guild.id);
  if (connection) return connection;

  connection = joinVoiceChannel({
    channelId:      voiceChannel.id,
    guildId:        guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });

  try {
    // On attend que la connexion soit prête (15s max — Discord peut être lent)
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch (err) {
    connection.destroy();
    throw new Error(`Impossible de rejoindre le salon vocal (${err.message})`);
  }

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      // Discord envoie Disconnected puis Connecting/Ready lors d'une coupure réseau
      // On attend l'un ou l'autre pendant 10s avant de considérer la connexion perdue
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling,  10_000),
        entersState(connection, VoiceConnectionStatus.Connecting,  10_000),
      ]);
      // Connexion en cours de rétablissement — on attend qu'elle soit Ready
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      console.log(`[Music] ♻️ Reconnexion réussie sur ${guild.name}`);
    } catch {
      // Toujours déconnecté après 25s → on lâche
      console.warn(`[Music] ⚠️ Reconnexion échouée sur ${guild.name}, nettoyage`);
      cleanup(guild.id);
    }
  });

  connection.on("error", (err) => {
    console.error("[Music] Erreur connexion vocale:", err.message);
    cleanup(guild.id);
  });

  return connection;
}

// ─── Lecteur audio ────────────────────────────────────────────────────────────
function createPlayer(guild, connection) {
  const player = createAudioPlayer();

  player.on(AudioPlayerStatus.Idle, () => playNext(guild));
  player.on("error", (err) => {
    console.error("[Music] Erreur player:", err.message);
    playNext(guild);
  });

  connection.subscribe(player);
  return player;
}

// ─── Lecture ──────────────────────────────────────────────────────────────────
async function playQueue(guild, voiceChannel) {
  const state = getServer(guild.id);
  const song  = state.queue[0];

  if (!song?.url) {
    // Chanson invalide → on skip
    state.queue.shift();
    return state.queue.length > 0 ? playQueue(guild, voiceChannel) : cleanup(guild.id);
  }

  state.voiceChannel = voiceChannel;
  state.paused       = false;

  try {
    const connection = await getOrCreateConnection(guild, voiceChannel);

    // Créer le player s'il n'existe pas encore (ou après un cleanup)
    if (!state.player) {
      state.player = createPlayer(guild, connection);
    }

    const stream   = await playdl.stream(song.url, { quality: 2 });
    const resource = createAudioResource(stream.stream, {
      inputType:    stream.type,
      metadata:     { title: song.title },
      inlineVolume: true,
    });
    resource.volume?.setVolume(0.5);

    state.player.play(resource);
    console.log(`[Music] ▶ "${song.title}" sur ${guild.name}`);
  } catch (err) {
    console.error(`[Music] Erreur lecture "${song.title}":`, err.message);
    state.queue.shift();

    // Prévenir le serveur et passer à la suivante
    const ch = guild.systemChannel || guild.channels.cache.find((c) => c.isTextBased());
    ch?.send({ embeds: [embed("#ff9900", "⚠️ Erreur", `Impossible de lire **${song.title}**, passage à la suivante…`)] }).catch(() => {});

    if (state.queue.length > 0) playQueue(guild, voiceChannel);
    else cleanup(guild.id);
  }
}

function playNext(guild) {
  const state = getServer(guild.id);
  if (!state.queue.length) return;

  const finished = state.queue.shift();
  state.paused   = false;
  console.log(`[Music] ⏭ Terminé : "${finished?.title}" sur ${guild.name}`);

  if (state.queue.length > 0) {
    setTimeout(() => playQueue(guild, state.voiceChannel), 500);
  } else {
    console.log(`[Music] File vide sur ${guild.name}, déconnexion dans 30s`);
    setTimeout(() => {
      if (!getServer(guild.id).queue.length) cleanup(guild.id);
    }, 30_000);
  }
}

function cleanup(guildId) {
  const connection = getVoiceConnection(guildId);
  try { connection?.destroy(); } catch {}
  deleteServer(guildId);
  console.log(`[Music] 🧹 Nettoyage serveur ${guildId}`);
}

// ─── Commandes ────────────────────────────────────────────────────────────────
async function handlePlay(interaction) {
  const query  = interaction.options.getString("recherche");
  const member = interaction.member;
  const guild  = interaction.guild;

  const voiceChannel = member.voice.channel
    ?? (await guild.members.fetch(member.id)).voice.channel;

  if (!voiceChannel) {
    return interaction.reply({
      embeds: [embed("#ff0000", "Erreur", "Vous devez être dans un salon vocal !")],
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    // ── Playlist ──────────────────────────────────────────────────────────────
    if (isPlaylistLink(query)) {
      const { playlistTitle, songs } = await handlePlaylist(query);
      const validSongs = songs.filter((s) => s?.url);

      if (!validSongs.length) throw new Error("Aucune chanson valide dans la playlist");

      const state   = getServer(guild.id);
      const wasEmpty = state.queue.length === 0;

      state.queue.push(...validSongs.map((s) => ({ ...s, requestedBy: member.displayName })));

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#00ff00")
            .setTitle(`🎵 Playlist : ${playlistTitle}`)
            .setDescription(`**${validSongs.length}** chansons ajoutées`)
            .setFooter({ text: `File d'attente : ${state.queue.length} chanson(s)` }),
        ],
      });

      if (wasEmpty) await playQueue(guild, voiceChannel);
      return;
    }

    // ── Chanson simple ────────────────────────────────────────────────────────
    const songInfo = await searchSong(query);
    if (!songInfo) {
      return interaction.editReply({
        embeds: [embed("#ff0000", "Aucun résultat", `Aucune musique trouvée pour : **${query}**`)],
      });
    }

    const perms = voiceChannel.permissionsFor(interaction.client.user);
    if (!perms?.has(["Connect", "Speak"])) {
      return interaction.editReply({
        embeds: [embed("#ff0000", "Permissions insuffisantes", "Je n'ai pas les droits pour rejoindre/parler dans ce salon.")],
      });
    }

    const state   = getServer(guild.id);
    const wasEmpty = state.queue.length === 0;
    state.queue.push({ ...songInfo, requestedBy: member.displayName });

    if (wasEmpty) {
      await playQueue(guild, voiceChannel);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#00ff00")
            .setTitle("🎵 Lecture en cours")
            .setDescription(`**${songInfo.title}**`)
            .addFields(
              { name: "👤 Artiste",     value: songInfo.artist || "Inconnu",    inline: true },
              { name: "⏱️ Durée",       value: songInfo.duration || "Inconnue", inline: true },
              { name: "🎧 Demandé par", value: member.displayName,              inline: true }
            )
            .setThumbnail(songInfo.thumbnail),
        ],
      });
    } else {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ffa500")
            .setTitle("➕ Ajouté à la file")
            .setDescription(`**${songInfo.title}**`)
            .addFields(
              { name: "📊 Position",    value: `${state.queue.length}`, inline: true },
              { name: "🎧 Demandé par", value: member.displayName,      inline: true }
            )
            .setThumbnail(songInfo.thumbnail),
        ],
      });
    }
  } catch (err) {
    console.error("[Music] Erreur /play:", err);
    const msg = err.message.includes("non supporté") ? err.message
      : err.message.includes("valide")              ? err.message
      : "Une erreur est survenue lors de la lecture.";
    await interaction.editReply({
      embeds: [embed("#ff0000", "Erreur de lecture", msg)],
    });
  }
}

async function handleStop(interaction) {
  const { guild } = interaction;
  const connection = getVoiceConnection(guild.id);

  if (!connection) {
    return interaction.reply({ content: "Je ne suis connecté à aucun salon vocal.", ephemeral: true });
  }

  const state = getServer(guild.id);
  const count = state.queue.length;
  cleanup(guild.id);

  await interaction.reply({
    embeds: [
      embed("#ff0000", "⏹️ Arrêt", "Musique arrêtée et salon vocal quitté.")
        .setFooter({ text: count ? `${count} chanson(s) supprimée(s)` : "" }),
    ],
  });
}

async function handleSkip(interaction) {
  const state = getServer(interaction.guild.id);

  if (!state.queue.length) {
    return interaction.reply({ content: "Aucune musique en cours de lecture.", ephemeral: true });
  }
  if (state.queue.length <= 1) {
    return interaction.reply({ content: "Aucune chanson suivante dans la file.", ephemeral: true });
  }

  const skipped = state.queue[0];
  state.player?.stop(); // déclenche AudioPlayerStatus.Idle → playNext()

  await interaction.reply({
    embeds: [embed("#ffa500", "⏭️ Chanson passée", `**${skipped.title}** a été passée`)],
  });
}

async function handleQueue(interaction) {
  const state = getServer(interaction.guild.id);

  if (!state.queue.length) {
    return interaction.reply({ content: "📭 La file d'attente est vide.", ephemeral: true });
  }

  const list = state.queue
    .slice(0, 10)
    .map((s, i) => {
      const prefix    = i === 0 ? "🎵 **En cours :** " : `${i}. `;
      const requester = s.requestedBy ? ` *(${s.requestedBy})*` : "";
      return `${prefix}${s.title} — ${s.artist || "Inconnu"}${requester}`;
    })
    .join("\n");

  const totalSec = state.queue.reduce((acc, s) => acc + parseDurationToSeconds(s.duration), 0);

  const queueEmbed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle("📋 File d'attente")
    .setDescription(list)
    .addFields(
      { name: "📊 Total",       value: `${state.queue.length} chanson(s)`, inline: true },
      { name: "⏱️ Durée totale", value: formatDuration(totalSec),          inline: true }
    );

  if (state.queue.length > 10) {
    queueEmbed.setFooter({ text: `… et ${state.queue.length - 10} autres chansons` });
  }

  await interaction.reply({ embeds: [queueEmbed] });
}

async function handleNowPlaying(interaction) {
  const state = getServer(interaction.guild.id);

  if (!state.queue.length) {
    return interaction.reply({ content: "Aucune musique en cours de lecture.", ephemeral: true });
  }

  const song   = state.queue[0];
  const paused = state.paused;

  const npEmbed = new EmbedBuilder()
    .setColor(paused ? "#ffa500" : "#00ff00")
    .setTitle(paused ? "⏸️ En pause" : "🎵 En cours de lecture")
    .setDescription(`**${song.title}**`)
    .addFields(
      { name: "👤 Artiste",     value: song.artist   || "Inconnu",  inline: true },
      { name: "⏱️ Durée",       value: song.duration || "Inconnue", inline: true },
      { name: "🎧 Demandé par", value: song.requestedBy || "Inconnu", inline: true },
      { name: "📱 Source",      value: song.source === "spotify" ? "Spotify → YouTube" : "YouTube", inline: true }
    )
    .setThumbnail(song.thumbnail);

  if (state.queue[1]) {
    npEmbed.addFields({ name: "⏭️ Suivant", value: `${state.queue[1].title} — ${state.queue[1].artist || "Inconnu"}` });
  }

  await interaction.reply({ embeds: [npEmbed] });
}

async function handlePause(interaction) {
  const state = getServer(interaction.guild.id);

  if (!state.player) {
    return interaction.reply({ content: "Aucune musique en cours de lecture.", ephemeral: true });
  }

  if (state.paused) {
    state.player.unpause();
    state.paused = false;
    await interaction.reply({ embeds: [embed("#00ff00", "▶️ Reprise", "La musique a été reprise.")] });
  } else {
    state.player.pause();
    state.paused = true;
    await interaction.reply({ embeds: [embed("#ffa500", "⏸️ Pause", "La musique a été mise en pause.")] });
  }
}

async function handleVolume(interaction) {
  const state  = getServer(interaction.guild.id);
  const volume = interaction.options.getInteger("niveau");

  if (!state.player) {
    return interaction.reply({ content: "Aucune musique en cours de lecture.", ephemeral: true });
  }

  const resource = state.player.state.resource;
  if (resource?.volume) {
    resource.volume.setVolume(volume / 100);
    await interaction.reply({ embeds: [embed("#00ff00", "🔊 Volume", `Volume défini à **${volume}%**`)] });
  } else {
    await interaction.reply({ content: "Impossible d'ajuster le volume maintenant.", ephemeral: true });
  }
}

async function handleShuffle(interaction) {
  const state = getServer(interaction.guild.id);

  if (state.queue.length <= 2) {
    return interaction.reply({ content: "Pas assez de chansons pour mélanger.", ephemeral: true });
  }

  const current   = state.queue[0];
  const rest      = state.queue.slice(1);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  state.queue = [current, ...rest];

  await interaction.reply({
    embeds: [embed("#ff9900", "🔀 File mélangée", `**${rest.length}** chansons ont été mélangées.`)],
  });
}

async function handleClear(interaction) {
  const state = getServer(interaction.guild.id);

  if (state.queue.length <= 1) {
    return interaction.reply({ content: "Aucune chanson à supprimer de la file.", ephemeral: true });
  }

  const removed = state.queue.length - 1;
  state.queue   = [state.queue[0]];

  await interaction.reply({
    embeds: [embed("#ff0000", "🗑️ File vidée", `**${removed}** chanson(s) supprimée(s).`)],
  });
}

// ─── Classe principale ────────────────────────────────────────────────────────
class MusicBot {
  constructor(client) {
    this.client = client;
    this._registerListeners();
  }

  async init() {
    console.log("[Music] 🎵 Module initialisé");

    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      try {
        await refreshSpotifyToken();
        console.log("[Music] Spotify API prête");
        // Renouvellement toutes les heures
        setInterval(refreshSpotifyToken, 3_600_000);
      } catch (err) {
        console.warn("[Music] ⚠️ Spotify non disponible:", err.message);
      }
    }
  }

  _registerListeners() {
    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const handlers = {
        play:       handlePlay,
        stop:       handleStop,
        skip:       handleSkip,
        queue:      handleQueue,
        nowplaying: handleNowPlaying,
        pause:      handlePause,
        volume:     handleVolume,
        shuffle:    handleShuffle,
        clear:      handleClear,
      };

      const handler = handlers[interaction.commandName];
      if (!handler) return;

      try {
        await handler(interaction);
      } catch (err) {
        console.error(`[Music] Erreur /${interaction.commandName}:`, err);
        const respond = interaction.deferred || interaction.replied
          ? interaction.editReply.bind(interaction)
          : interaction.reply.bind(interaction);
        await respond({ content: "Une erreur est survenue.", ephemeral: true }).catch(() => {});
      }
    });

    this.client.on("voiceStateUpdate", (oldState, newState) => {
      // Bot manuellement déconnecté
      if (oldState.member?.id === this.client.user.id && !newState.channel) {
        cleanup(oldState.guild.id);
        return;
      }

      // Salon devenu vide → déconnexion après 60s
      const state = servers.get(newState.guild.id);
      if (!state?.voiceChannel) return;

      if (newState.channelId === state.voiceChannel.id) {
        const humans = state.voiceChannel.members.filter((m) => !m.user.bot);
        if (humans.size === 0) {
          setTimeout(() => {
            const current = state.voiceChannel.members.filter((m) => !m.user.bot);
            if (current.size === 0) cleanup(newState.guild.id);
          }, 60_000);
        }
      }
    });
  }

  /** Statistiques en temps réel */
  getStats() {
    return {
      activeConnections: servers.size,
      totalSongsQueued:  Array.from(servers.values()).reduce((t, s) => t + s.queue.length, 0),
    };
  }

  /** Nettoyage global (arrêt du bot) */
  cleanupAll() {
    for (const guildId of servers.keys()) cleanup(guildId);
    console.log("[Music] 🧹 Nettoyage global terminé");
  }
}

module.exports = MusicBot;