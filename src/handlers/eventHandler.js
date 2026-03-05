const fs = require('fs');
const path = require('path');

async function loadEvents(client) {
    const folders = fs.readdirSync(path.join(__dirname, '../events'));
    for (const folder of folders) {
        const files = fs.readdirSync(path.join(__dirname, `../events/${folder}`)).filter((file) => file.endsWith('.js'));
        for (const file of files) {
            if (folder !== 'client') continue;

            let event;
            try {
                event = require(`../events/${folder}/${file}`);
            } catch (e) {
                console.error(`❌ Failed loading event module: events/${folder}/${file}`, e);
                continue;
            }

            if (!event?.name || typeof event.execute !== 'function') {
                console.warn(`⚠️ Skipping invalid event module: events/${folder}/${file}`);
                continue;
            }
            if (event.rest) {
                if (event.once)
                    client.rest.once(event.name, (...args) => event.execute(...args, client));
                else
                    client.rest.on(event.name, (...args) => event.execute(...args, client));
            } else {
                if (event.once)
                    client.once(event.name, (...args) => event.execute(...args, client));
                else
                    client.on(event.name, (...args) => event.execute(...args, client));
            }

            if (process.env.EVENT_DEBUG === '1') {
                console.log(`✅ Loaded event: ${event.name} (events/${folder}/${file})`);
            }
        }
    }
    console.log('✅ Events Loaded');
}

module.exports = { loadEvents };
