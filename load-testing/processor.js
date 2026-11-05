import fs from 'fs';

const rooms = JSON.parse(fs.readFileSync('./rooms.json', 'utf-8'));

let botCounter = 0;

export function assignBotData(context, events, done) {
    const roomIndex = Math.floor(botCounter / 10);

    context.vars.roomId = rooms[roomIndex];
    context.vars.token = `BOT_TOKEN_${botCounter}`;
    context.vars.expiresAt = new Date(Date.now() + 86400000).toISOString();

    botCounter++;
    done();
}
