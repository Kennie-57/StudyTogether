import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Lấy từ file .env của bạn
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Thay bằng UUID user của bạn (người làm Host)
const HOST_ID = '3ffa53ab-c838-404e-b350-b4810c89bce2';

async function setupRooms() {
    const rooms = [];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Sống 24h

    for (let i = 0; i < 25; i++) {
        const { data, error } = await supabase
            .from('rooms')
            .insert([{
                host_id: HOST_ID,
                name: `Bot Test Room ${i + 1}`,
                expires_at: expiresAt
            }])
            .select('id')
            .single();

        if (error) {
            console.error('Lỗi tạo phòng:', error);
            return;
        }
        rooms.push(data.id);
    }

    fs.writeFileSync('rooms.json', JSON.stringify(rooms, null, 2));
    console.log('✅ Đã tạo 25 phòng và lưu vào rooms.json');
}

setupRooms();