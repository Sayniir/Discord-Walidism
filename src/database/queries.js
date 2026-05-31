const supabase = require('./supabase');

// ============================================
// GUILD CONFIG
// ============================================

/**
 * Récupère la config d'un serveur depuis Supabase
 * @param {string} guildId 
 * @returns {Object|null}
 */
async function getGuildConfig(guildId) {
    const { data, error } = await supabase
        .from('guild_config')
        .select('*')
        .eq('guild_id', guildId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`[DB] Erreur getGuildConfig(${guildId}):`, error.message);
    }
    return data || null;
}

/**
 * Met à jour un ou plusieurs champs de config d'un serveur (upsert)
 * @param {string} guildId 
 * @param {Object} fields - champs à mettre à jour
 */
async function setGuildConfig(guildId, fields) {
    const { error } = await supabase
        .from('guild_config')
        .upsert({ guild_id: guildId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'guild_id' });

    if (error) {
        console.error(`[DB] Erreur setGuildConfig(${guildId}):`, error.message);
        throw error;
    }
}

// ============================================
// LEVELS
// ============================================

/**
 * Récupère les données XP d'un utilisateur dans un serveur
 * @param {string} guildId 
 * @param {string} userId 
 * @returns {Object}
 */
async function getUserXP(guildId, userId) {
    const { data, error } = await supabase
        .from('levels')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`[DB] Erreur getUserXP(${guildId}, ${userId}):`, error.message);
    }

    return data || { guild_id: guildId, user_id: userId, xp: 0, level: 0, last_message: 0 };
}

/**
 * Met à jour les données XP d'un utilisateur
 * @param {string} guildId 
 * @param {string} userId 
 * @param {Object} fields 
 */
async function setUserXP(guildId, userId, fields) {
    const { error } = await supabase
        .from('levels')
        .upsert({ guild_id: guildId, user_id: userId, ...fields }, { onConflict: 'guild_id,user_id' });

    if (error) {
        console.error(`[DB] Erreur setUserXP(${guildId}, ${userId}):`, error.message);
        throw error;
    }
}

/**
 * Récupère le classement XP d'un serveur (top 10)
 * @param {string} guildId 
 * @returns {Array}
 */
async function getLeaderboard(guildId) {
    const { data, error } = await supabase
        .from('levels')
        .select('*')
        .eq('guild_id', guildId)
        .order('xp', { ascending: false })
        .limit(10);

    if (error) {
        console.error(`[DB] Erreur getLeaderboard(${guildId}):`, error.message);
        return [];
    }
    return data || [];
}

/**
 * Réinitialise l'XP d'un utilisateur
 */
async function resetUserXP(guildId, userId) {
    const { error } = await supabase
        .from('levels')
        .update({ xp: 0, level: 0 })
        .eq('guild_id', guildId)
        .eq('user_id', userId);

    if (error) console.error(`[DB] Erreur resetUserXP:`, error.message);
}

/**
 * Réinitialise l'XP de tout un serveur
 */
async function resetGuildXP(guildId) {
    const { error } = await supabase
        .from('levels')
        .delete()
        .eq('guild_id', guildId);

    if (error) console.error(`[DB] Erreur resetGuildXP:`, error.message);
}

// ============================================
// TICKETS
// ============================================

/**
 * Récupère un ticket par son channel_id
 */
async function getTicket(channelId) {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('channel_id', channelId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`[DB] Erreur getTicket(${channelId}):`, error.message);
    }
    return data || null;
}

/**
 * Crée un nouveau ticket
 */
async function createTicket(ticket) {
    const { error } = await supabase
        .from('tickets')
        .insert(ticket);

    if (error) {
        console.error('[DB] Erreur createTicket:', error.message);
        throw error;
    }
}

/**
 * Met à jour un ticket
 */
async function updateTicket(channelId, fields) {
    const { error } = await supabase
        .from('tickets')
        .update(fields)
        .eq('channel_id', channelId);

    if (error) {
        console.error(`[DB] Erreur updateTicket(${channelId}):`, error.message);
        throw error;
    }
}

/**
 * Supprime un ticket
 */
async function deleteTicket(channelId) {
    const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('channel_id', channelId);

    if (error) console.error(`[DB] Erreur deleteTicket(${channelId}):`, error.message);
}

/**
 * Récupère les tickets actifs d'un utilisateur sur un serveur
 */
async function getUserActiveTickets(guildId, userId) {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .neq('status', 'closed');

    if (error) {
        console.error('[DB] Erreur getUserActiveTickets:', error.message);
        return [];
    }
    return data || [];
}

/**
 * Récupère tous les tickets d'un serveur
 */
async function getAllTickets(guildId) {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[DB] Erreur getAllTickets:', error.message);
        return [];
    }
    return data || [];
}

module.exports = {
    // Config
    getGuildConfig,
    setGuildConfig,
    // Levels
    getUserXP,
    setUserXP,
    getLeaderboard,
    resetUserXP,
    resetGuildXP,
    // Tickets
    getTicket,
    createTicket,
    updateTicket,
    deleteTicket,
    getUserActiveTickets,
    getAllTickets,
};
