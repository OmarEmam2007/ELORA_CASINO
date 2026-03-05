module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        try {
            if (process.env.EVENT_DEBUG === '1') {
                const content = String(message?.content || '').slice(0, 120);
                console.log(`📝 messageCreate: author=${message?.author?.tag || 'unknown'} bot=${Boolean(message?.author?.bot)} content=${JSON.stringify(content)}`);
            }

            if (!message || !client) return;
            if (message.author?.bot) return;

            const { handlePrefixCommand, loadPrefixCommands } = require('../../handlers/prefixCommandHandler');

            if (!client.prefixCommands || client.prefixCommands.size === 0) {
                await loadPrefixCommands(client);
                if (process.env.PREFIX_DEBUG === '1') {
                    console.log(`✅ [PREFIX] Loaded prefix commands: ${client.prefixCommands?.size || 0}`);
                }
            }
            await handlePrefixCommand(message, client);
        } catch (e) {
            console.error('❌ [ELORA CASINO] messageCreate handler error:', e);
        }
    }
};
