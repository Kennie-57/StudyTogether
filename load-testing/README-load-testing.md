# Load Testing — Study Together

Công cụ mô phỏng tải trọng (load testing) cho máy chủ Node.js/Socket.io bằng [Artillery](https://www.artillery.io/). Script này giúp giả lập 250 kết nối WebSocket đồng thời (CCU) để đánh giá giới hạn RAM/CPU trên môi trường Render (Free tier).

## Chiến lược Bypass Auth (Tối ưu cho gói Free)

Để đo lường chính xác hiệu năng của máy chủ Node.js mà không bị chặn bởi giới hạn Rate Limit của Supabase (gói miễn phí), kịch bản test sử dụng cơ chế **Bypass Auth**:
- Bot sử dụng định dạng token đặc biệt (`BOT_TOKEN_x`).
- Khi server nhận diện token này ở sự kiện `room:join`, luồng xác thực thực tế (Supabase Auth) và truy vấn DB sẽ bị bỏ qua.
- Bot được khởi tạo dữ liệu giả và nhét thẳng vào In-memory State (RAM) của server, giúp cách ly (isolate) luồng test thuần túy vào khả năng xử lý mảng và I/O của Socket.io.

## Cài đặt

Di chuyển vào thư mục `load-testing` và cài đặt dependencies:

```bash
cd client/load-testing
npm install
```

**Biến môi trường (.env):**
Tạo file `.env` trong thư mục `load-testing` (copy keys từ `server/.env`):
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Quy trình Test (3 Bước)

### 1. Tạo phòng giả lập
Tạo sẵn 25 phòng test ("Bot Test Room X") trên Supabase để bot có không gian tham gia.
```bash
node setup_rooms.js
```
*Dữ liệu trả về (UUID của các phòng) sẽ được lưu cục bộ vào file `rooms.json`.*

### 2. Khởi chạy hạm đội Bot
Kích hoạt Artillery bắn 250 kết nối đồng thời lên server Socket.io.
```bash
npx artillery run test.yml
```
- Cơ chế của `processor.js` sẽ chia đều 10 bot cho mỗi phòng.
- Bot liên tục phát ra sự kiện `room:chat` và `room:status` để giữ liên lạc.
- Khi kết thúc luồng chạy (sau khoảng ~8-10 phút), bot chủ động gửi lệnh `room:leave` để giải phóng RAM cho server một cách an toàn.

### 3. Dọn dẹp (Teardown)
Xóa sạch toàn bộ các phòng test ra khỏi Supabase Database để giữ hệ thống nguyên vẹn sau khi test xong.
```bash
node teardown_rooms.js
```
*Script này cũng sẽ tự động làm rỗng file `rooms.json` để chuẩn bị cho lần test tiếp theo.*
