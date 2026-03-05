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

            const { handlePrefixCommand } = require('../../handlers/prefixCommandHandler');
            await handlePrefixCommand(message, client);
        } catch (e) {
            console.error('❌ [ELORA CASINO] messageCreate handler error:', e);
        }
    }
};
