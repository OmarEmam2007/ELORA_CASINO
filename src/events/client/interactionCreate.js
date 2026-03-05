module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (process.env.EVENT_DEBUG === '1') {
            try {
                console.log(`🧩 interactionCreate: type=${interaction?.type} chat=${interaction?.isChatInputCommand?.()} button=${interaction?.isButton?.()} name=${interaction?.commandName || interaction?.customId || 'n/a'}`);
            } catch (_) { }
        }

        const safeReply = async (payload) => {
            try {
                if (interaction.deferred || interaction.replied) return await interaction.followUp(payload);
                return await interaction.reply(payload);
            } catch (_) { }
        };

        try {
            if (interaction.isButton()) {
                if (interaction.customId.startsWith('bj_')) {
                    const blackjackCommand = require('../../commands/gambling/blackjack');
                    if (blackjackCommand.handleButton) {
                        return blackjackCommand.handleButton(interaction);
                    }
                    return;
                }

                if (interaction.customId.startsWith('heist_')) {
                    const heistCommand = require('../../commands/economy/heist');
                    if (heistCommand.handleButton) {
                        return heistCommand.handleButton(interaction);
                    }
                    return;
                }
            }

            if (!interaction.isChatInputCommand()) return;
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction, client);
        } catch (error) {
            console.error('❌ [ELORA CASINO] interactionCreate error:', error);
            await safeReply({ content: 'Error executing command!', ephemeral: true });
        }
    }
};
