# Study Together — MVP

Không gian học tập ảo real-time giúp sinh viên duy trì động lực thông qua peer pressure. Monorepo gồm React (Vite) frontend và Node.js + Socket.io backend, dùng Supabase cho Auth và PostgreSQL.

## Cấu trúc

```
study-together-app/
├── client/          # React + Vite
├── server/          # Express + Socket.io
├── supabase/        # SQL schema
└── README.md
```

## Yêu cầu

- Node.js 18+
- Tài khoản [Supabase](https://supabase.com) (miễn phí)
- Google OAuth đã cấu hình trong Supabase

## Thiết lập Supabase

1. Tạo project mới trên Supabase.
2. **Bật Google OAuth** (bắt buộc — nếu thiếu sẽ lỗi `provider is not enabled`):
   - Vào [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
   - Tạo **OAuth 2.0 Client ID** (loại Web application)
   - **Authorized redirect URI** (quan trọng): `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
     - Thay `<PROJECT_REF>` bằng mã project Supabase (vd: `abcdefghijklmnop`)
   - Copy **Client ID** và **Client Secret**
   - Supabase Dashboard → **Authentication → Providers → Google**
   - Bật **Enable Sign in with Google**, dán Client ID + Secret → **Save**
3. **URL Configuration** (Authentication → URL Configuration):
   - **Site URL** (local): `http://localhost:5173`
   - **Redirect URLs**: thêm `http://localhost:5173/**`
   - Khi deploy production, cập nhật:
     - **Site URL**: `https://study-together-jade.vercel.app`
     - **Redirect URLs**: thêm `https://study-together-jade.vercel.app/**`
4. Vào **SQL Editor**, chạy **toàn bộ** nội dung file `supabase/schema.sql`.
   - Nếu đã đăng nhập Google **trước** khi chạy schema, file SQL có đoạn backfill tự tạo `profiles` cho user hiện có.
   - Lỗi `500` khi tạo phòng thường do chưa chạy schema hoặc thiếu bản ghi `profiles`.
5. Lấy keys từ **Project Settings → API**:
   - `Project URL`
   - `anon` key (cho client)
   - `service_role` key (cho server — **không** public)

## Biến môi trường

**server/.env** (copy từ `server/.env.example`):

```env
PORT=3001
CLIENT_URL=http://localhost:5173
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
```

**client/.env** (copy từ `client/.env.example`):

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:3001
```

## Chạy local

```bash
# Terminal 1 — Server
cd server
npm install
npm run dev

# Terminal 2 — Client
cd client
npm install
npm run dev
```

Mở http://localhost:5173

## Tính năng MVP

| Tính năng | Mô tả |
|-----------|-------|
| Auth | Đăng nhập Google qua Supabase |
| Dashboard | Danh sách phòng, tạo/vào phòng, gửi feedback |
| Profile | Tên, avatar Google, số phòng đã tham gia |
| Phòng RT | Đếm ngược đồng bộ server, chat, icon trạng thái |
| Host | Tăng thời gian, kết thúc phòng; bàn giao alpha-beta khi disconnect |

## Quy tắc kiến trúc

- **Server** là nguồn sự thật cho `expires_at` — client chỉ hiển thị.
- Chat và icon trạng thái lưu **RAM server**, không ghi DB.
- REST API tách biệt Socket.io real-time.
- Không hardcode API keys — dùng `.env`.

## Deploy (gợi ý miễn phí)

- **Client**: Vercel / Netlify / Cloudflare Pages
- **Server**: Render / Railway free tier (lưu ý RAM state mất khi restart)
- **DB + Auth**: Supabase free tier

Khi deploy, cập nhật `CLIENT_URL`, `VITE_API_URL`, và Supabase redirect URLs.
