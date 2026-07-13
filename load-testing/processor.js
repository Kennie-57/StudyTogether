import fs from 'fs';

// Đọc danh sách phòng đã sinh ra từ bước trước
const rooms = JSON.parse(fs.readFileSync('./rooms.json', 'utf-8'));

let botCounter = 0;

export function assignBotData(context, events, done) {
    // Chia 10 bot vào 1 phòng (0-9 -> phòng 0; 10-19 -> phòng 1...)
    const roomIndex = Math.floor(botCounter / 10);

    context.vars.roomId = rooms[roomIndex];
    // TẠO TOKEN MOCK DUY NHẤT CHO TỪNG BOT
    context.vars.token = `BOT_TOKEN_${botCounter}`;
    context.vars.expiresAt = new Date(Date.now() + 86400000).toISOString();

    botCounter++;
    done();
}