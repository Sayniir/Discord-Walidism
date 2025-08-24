const { Client, IntentsBitField, EmbedBuilder, ActivityType } = require("discord.js");

// ================== STATUS CONFIGURATION ==================

const STATUS_CONFIG = {
    // Rotation interval (in milliseconds)
    rotationInterval: 100000, // 100 seconds (you can adjust this)
    
    // Bot online status
    onlineStatus: 'online', // 'online', 'idle', 'dnd', 'invisible'
    
    // Enable/disable status rotation
    enableRotation: true
};

// ================== STATUS LIST ==================

const statusList = [
    {
        name: "Nah, i'd win",
        type: ActivityType.Custom,
    },
    {
        name: "the best streamer",
        type: ActivityType.Streaming,
        url: "https://www.twitch.tv/anyme023",
    },
    {
        name: "with the best bot",
        type: ActivityType.Playing,
    },
    {
        name: "the best community",
        type: ActivityType.Competing,
    },
    {
        name: "WALIDISM",
        type: ActivityType.Custom,
    },
    {
        name: "Sayniir on top",
        type: ActivityType.Custom
    },
    {
        name: "Hoes > bros ahhhh ryan....",
        type: ActivityType.Custom
    },
    {
        name: "sur Discord",
        type: ActivityType.Playing,
    },
    {
        name: "les tickets",
        type: ActivityType.Watching,
    },
    {
        name: "Devil in disguise - Marino",
        type: ActivityType.Listening,
    }
];

// ================== UTILITY FUNCTIONS ==================

/**
 * Gets a random status from the status list
 * @returns {Object} Random status object
 */
function getRandomStatus() {
    const randomIndex = Math.floor(Math.random() * statusList.length);
    return statusList[randomIndex];
}

/**
 * Sets the bot's activity status
 * @param {Client} client - Discord client
 * @param {Object} status - Status object with name, type, and optional url
 */
function setActivity(client, status) {
    try {
        const activityOptions = {
            type: status.type
        };
        
        // Add URL for streaming activities
        if (status.url) {
            activityOptions.url = status.url;
        }
        
        client.user.setActivity(status.name, activityOptions);
    } catch (error) {
        console.error('❌ Error setting activity:', error);
    }
}

/**
 * Converts ActivityType enum to readable string
 * @param {ActivityType} type - Discord ActivityType
 * @returns {string} Human readable activity type
 */
function getActivityTypeString(type) {
    const typeMap = {
        [ActivityType.Playing]: 'Playing',
        [ActivityType.Streaming]: 'Streaming',
        [ActivityType.Listening]: 'Listening to',
        [ActivityType.Watching]: 'Watching',
        [ActivityType.Custom]: 'Custom',
        [ActivityType.Competing]: 'Competing in'
    };
    
    return typeMap[type] || 'Unknown';
}

/**
 * Starts the status rotation interval
 * @param {Client} client - Discord client
 * @returns {NodeJS.Timeout} Interval ID
 */
function startStatusRotation(client) {
    if (!STATUS_CONFIG.enableRotation) {
        console.log('📴 Status rotation disabled');
        return null;
    }
    
    console.log(`🔄 Starting status rotation (every ${STATUS_CONFIG.rotationInterval / 1000}s)`);
    
    return setInterval(() => {
        if (client.user) {
            const randomStatus = getRandomStatus();
            setActivity(client, randomStatus);
        }
    }, STATUS_CONFIG.rotationInterval);
}

/**
 * Sets initial status and starts rotation
 * @param {Client} client - Discord client
 */
function initializeStatus(client) {
    // Set initial online status
    client.user.setStatus(STATUS_CONFIG.onlineStatus);
    console.log(`🟢 Bot status set to: ${STATUS_CONFIG.onlineStatus}`);
    
    // Set initial activity
    if (statusList.length > 0) {
        const initialStatus = getRandomStatus();
        setActivity(client, initialStatus);
    }
    
    // Start rotation if enabled
    return startStatusRotation(client);
}

// ================== ADMIN COMMANDS ==================

/**
 * Handles status management commands
 * @param {Message} message - Discord message
 * @param {Client} client - Discord client
 * @param {NodeJS.Timeout} rotationInterval - Current rotation interval
 */
function handleStatusCommands(message, client, rotationInterval) {
    const isAdmin = message.member?.permissions.has('Administrator') || 
                   message.author.id === '667026657567178772'; // Your user ID
    
    if (!isAdmin) return rotationInterval;
    
    const content = message.content.toLowerCase();
    
    // List all available statuses
    if (content === '!status-list') {
        const embed = new EmbedBuilder()
            .setTitle('📋 Liste des Statuts')
            .setDescription('Voici tous les statuts configurés :')
            .setColor('#0099ff');
        
        statusList.forEach((status, index) => {
            const typeStr = getActivityTypeString(status.type);
            const urlStr = status.url ? ` (${status.url})` : '';
            embed.addFields({
                name: `${index + 1}. ${typeStr}`,
                value: `${status.name}${urlStr}`,
                inline: false
            });
        });
        
        embed.setFooter({ text: `Total: ${statusList.length} statuts` });
        message.reply({ embeds: [embed] });
        return rotationInterval;
    }
    
    // Set specific status by index
    if (content.startsWith('!status-set ')) {
        const index = parseInt(content.split(' ')[1]) - 1;
        
        if (index >= 0 && index < statusList.length) {
            setActivity(client, statusList[index]);
            message.reply(`✅ Statut changé vers: **${statusList[index].name}**`);
        } else {
            message.reply(`❌ Index invalide. Utilisez \`!status-list\` pour voir les options (1-${statusList.length})`);
        }
        return rotationInterval;
    }
    
    // Toggle status rotation
    if (content === '!status-toggle') {
        STATUS_CONFIG.enableRotation = !STATUS_CONFIG.enableRotation;
        
        if (STATUS_CONFIG.enableRotation) {
            clearInterval(rotationInterval);
            rotationInterval = startStatusRotation(client);
            message.reply('✅ Rotation des statuts **activée**');
        } else {
            if (rotationInterval) {
                clearInterval(rotationInterval);
                rotationInterval = null;
            }
            message.reply('⏸️ Rotation des statuts **désactivée**');
        }
        return rotationInterval;
    }
    
    // Status system info
    if (content === '!status-info') {
        const embed = new EmbedBuilder()
            .setTitle('ℹ️ Informations du Système de Statuts')
            .addFields(
                { name: '🔄 Rotation', value: STATUS_CONFIG.enableRotation ? 'Activée' : 'Désactivée', inline: true },
                { name: '⏱️ Intervalle', value: `${STATUS_CONFIG.rotationInterval / 1000}s`, inline: true },
                { name: '📊 Total Statuts', value: statusList.length.toString(), inline: true },
                { name: '🟢 Statut Bot', value: STATUS_CONFIG.onlineStatus, inline: true },
                { name: '🎮 Statut Actuel', value: client.user.presence?.activities[0]?.name || 'Aucun', inline: true }
            )
            .setColor('#00ff99')
            .setTimestamp()
            .setFooter({ text: 'Status System v2.0' });
        
        message.reply({ embeds: [embed] });
        return rotationInterval;
    }
    
    return rotationInterval;
}

// ================== MAIN MODULE EXPORT ==================

module.exports = (client) => {
    let rotationInterval = null;
    
    // Initialize when bot is ready
    client.once('ready', () => {
        console.log(`✅ Connected as ${client.user.tag}`);
        console.log(`🏠 Serving ${client.guilds.cache.size} servers`);
        console.log(`👥 Monitoring ${client.users.cache.size} users`);
        
        // Initialize status system
        rotationInterval = initializeStatus(client);
        
        console.log('🎮 Status system initialized successfully');
    });
    
    // Handle status commands
    client.on('messageCreate', (message) => {
        if (message.author.bot) return;
        
        rotationInterval = handleStatusCommands(message, client, rotationInterval);
    });
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('🛑 Shutting down status system...');
        if (rotationInterval) {
            clearInterval(rotationInterval);
        }
        process.exit(0);
    });
    
    // Handle client disconnect/reconnect
    client.on('disconnect', () => {
        console.log('📡 Bot disconnected, clearing status interval');
        if (rotationInterval) {
            clearInterval(rotationInterval);
            rotationInterval = null;
        }
    });
    
    client.on('reconnecting', () => {
        console.log('🔄 Bot reconnecting...');
    });
    
    // Reinitialize status on reconnect
    client.on('ready', () => {
        if (!rotationInterval && STATUS_CONFIG.enableRotation) {
            console.log('🔄 Reinitializing status rotation after reconnect');
            rotationInterval = startStatusRotation(client);
        }
    });
};

// ================== AVAILABLE COMMANDS ==================
/*
Admin Commands:
- !status-list       : Liste tous les statuts disponibles
- !status-set <num>  : Définit un statut spécifique (1-10)
- !status-toggle     : Active/désactive la rotation automatique
- !status-info       : Affiche les informations du système

Examples:
- !status-set 1      : Active le premier statut de la liste
- !status-toggle     : Bascule la rotation on/off
*/