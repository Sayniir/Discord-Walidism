const { getGuildConfig } = require('../../database/queries');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            const config = await getGuildConfig(member.guild.id);
            if (!config?.autorole_id) return;

            const role = member.guild.roles.cache.get(config.autorole_id);
            if (!role) {
                console.warn(`[AutoRole] ⚠️ Rôle ${config.autorole_id} introuvable sur ${member.guild.name}`);
                return;
            }

            await member.roles.add(role);
            console.log(`[AutoRole] ✅ Rôle "${role.name}" ajouté à ${member.user.tag}`);
        } catch (error) {
            console.error(`[AutoRole] ❌ Erreur pour ${member.user.tag}:`, error.message);
        }
    }
};