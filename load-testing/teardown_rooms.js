import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function cleanTestRooms() {
    // Xóa các phòng có chứa chữ "Bot Test" trong tên
    const { data, error } = await supabase
        .from('rooms')
        .delete()
        .like('name', 'Bot Test Room%');

    if (error) {
        console.error('Lỗi khi xóa phòng:', error);
    } else {
        console.log('✅ Đã dọn dẹp toàn bộ phòng test khỏi Database.');
        // Xóa hoặc làm rỗng file rooms.json
        if (fs.existsSync('rooms.json')) {
            fs.writeFileSync('rooms.json', '[]');
        }
    }
}

cleanTestRooms();