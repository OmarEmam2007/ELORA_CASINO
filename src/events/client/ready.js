module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`🤖 Logged in as ${client.user.tag}`);

        const ownerId = client?.config?.ownerId || process.env.OWNER_ID;
        if (!ownerId) {
            console.warn('⚠️ WARNING: Owner ID is not set in config.json! /panic and /blacklist will NOT work.');
        } else {
            console.log(`👑 Owner ID detected: ${ownerId}`);
        }

        const { ActivityType } = require('discord.js');

        const updateStatus = () => {
            // Calculate dynamic values
            const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
            const serverNames = client.guilds.cache.map(g => g.name).join(', ') || 'Unknown Server';

            const activities = [
                { name: `Protecting ${serverNames}`, type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' },
                { name: 'Security: 100% Active', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' },
                { name: '/help for commands', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' },
                { name: `Monitoring ${userCount} Members`, type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }
            ];

            const randomIndex = Math.floor(Math.random() * activities.length);
            const activity = activities[randomIndex];

            client.user.setActivity(activity.name, { type: activity.type, url: activity.url });
        };

        // Initial set
        updateStatus();

        // Rotate every 30 seconds
        setInterval(updateStatus, 30 * 1000);

        // --- 🔊 Persistent Voice Channel Join (24/7) ---
        const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');
        const STAY_VOICE_CHANNEL_ID = '1479234725288869993';

        const ensureStayInVoice = async () => {
            try {
                const ch = await client.channels.fetch(STAY_VOICE_CHANNEL_ID).catch(() => null);
                if (!ch || !ch.guild || !ch.isVoiceBased?.()) {
                    console.warn(`⚠️ Stay-voice channel not found/invalid: ${STAY_VOICE_CHANNEL_ID}`);
                    return;
                }

                const guild = ch.guild;
                const existing = getVoiceConnection(guild.id);
                if (existing && existing.state?.status !== VoiceConnectionStatus.Destroyed) {
                    // If connected but in different channel, re-join.
                    const currentChannelId = existing.joinConfig?.channelId;
                    if (currentChannelId === STAY_VOICE_CHANNEL_ID) return;
                    try { existing.destroy(); } catch (_) { }
                }

                const connection = joinVoiceChannel({
                    channelId: STAY_VOICE_CHANNEL_ID,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    selfDeaf: true
                });

                connection.on(VoiceConnectionStatus.Disconnected, async () => {
                    // Best-effort rejoin after brief delay
                    setTimeout(() => ensureStayInVoice().catch(() => { }), 3_000);
                });

                connection.on(VoiceConnectionStatus.Destroyed, async () => {
                    setTimeout(() => ensureStayInVoice().catch(() => { }), 3_000);
                });

                console.log(`✅ Joined stay voice channel: ${STAY_VOICE_CHANNEL_ID} (${guild.name})`);
            } catch (e) {
                console.error('❌ Failed to join stay voice channel:', e);
            }
        };

        await ensureStayInVoice();
        setInterval(() => ensureStayInVoice().catch(() => { }), 60 * 1000);

        // --- 🔢 Member Count Voice Channel Bootstrap (best-effort) ---
        try {
            for (const [guildId] of client.guilds.cache) {
                try {
                    if (typeof client.queueMemberCountUpdate === 'function') {
                        client.queueMemberCountUpdate(guildId);
                    }
                } catch (_) {
                    // ignore
                }
            }
        } catch (_) {
            // ignore
        }

        // --- 🎫 Invite Cache Bootstrap ---
        // Used by guildMemberAdd to determine which invite was used.
        // Requires the bot to have Manage Server permission to fetch invites.
        try {
            if (!client.inviteCache) client.inviteCache = new Map();

            for (const [guildId, guild] of client.guilds.cache) {
                try {
                    const invites = await guild.invites.fetch();
                    const inviteMap = new Map();
                    for (const invite of invites.values()) {
                        inviteMap.set(invite.code, invite.uses || 0);
                    }
                    client.inviteCache.set(guildId, inviteMap);
                } catch (e) {
                    // Missing permissions or invites disabled.
                    client.inviteCache.set(guildId, new Map());
                }
            }

            console.log('🎫 Invite cache initialized.');
        } catch (e) {
            console.error('❌ Invite cache init error:', e);
        }

        // --- 🎫 Invite Reward Roles Sync (highest-tier-only) ---
        // Fixes existing members who already had multiple tiers from older logic.
        try {
            const InviteStats = require('../../models/InviteStats');

            const roleTiers = [
                { invites: 5, roleId: '1472157647804432528' },
                { invites: 10, roleId: '1472158092035751988' },
                { invites: 25, roleId: '1472158530256502848' },
                { invites: 50, roleId: '1472163006740959395' },
                { invites: 100, roleId: '1472160112205365278' }
            ];

            for (const [guildId, guild] of client.guilds.cache) {
                let stats;
                try {
                    stats = await InviteStats.find({ guildId }).lean();
                } catch {
                    continue;
                }

                if (!stats?.length) continue;

                for (const s of stats) {
                    const inviterMember = await guild.members.fetch(s.userId).catch(() => null);
                    if (!inviterMember) continue;

                    const netInvites = Math.max(0, (s.regularInvites || 0) - (s.leaves || 0));
                    const eligibleTiers = roleTiers.filter(t => netInvites >= t.invites);
                    const highestTier = eligibleTiers.length ? eligibleTiers[eligibleTiers.length - 1] : null;

                    const tierRoleIds = roleTiers.map(t => t.roleId);
                    const rolesToRemove = tierRoleIds.filter(roleId => roleId !== highestTier?.roleId);

                    if (highestTier && !inviterMember.roles.cache.has(highestTier.roleId)) {
                        await inviterMember.roles.add(highestTier.roleId, 'Invite rewards sync: set highest tier').catch(() => { });
                    }

                    for (const roleId of rolesToRemove) {
                        if (inviterMember.roles.cache.has(roleId)) {
                            await inviterMember.roles.remove(roleId, 'Invite rewards sync: remove non-highest tiers').catch(() => { });
                        }
                    }
                }
            }
        } catch (e) {
            console.error('❌ Invite reward roles sync error:', e);
        }
    },
};
