import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import './Dashboard.css';

export default function Dashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [error, setError] = useState('');

  const [createForm, setCreateForm] = useState({
    name: '',
    password: '',
    durationMinutes: '60',
  });
  const [joinPassword, setJoinPassword] = useState('');
  const [feedbackContent, setFeedbackContent] = useState('');

  const fetchRooms = useCallback(async () => {
    try {
      const data = await apiFetch('/api/rooms', {}, token);
      setRooms(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 15000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const room = await apiFetch(
        '/api/rooms',
        {
          method: 'POST',
          body: JSON.stringify({
            name: createForm.name,
            password: createForm.password || null,
            durationMinutes: Number(createForm.durationMinutes),
          }),
        },
        token
      );
      setCreateOpen(false);
      setCreateForm({ name: '', password: '', durationMinutes: '60' });
      navigate(`/room/${room.id}`, { state: { expiresAt: room.expires_at } });
    } catch (err) {
      setError(err.message);
    }
  };

  const openJoin = (room) => {
    setSelectedRoom(room);
    setJoinPassword('');
    if (room.hasPassword) {
      setJoinOpen(true);
    } else {
      joinRoom(room.id, null);
    }
  };

  const joinRoom = async (roomId, password) => {
    setError('');
    try {
      const room = await apiFetch(
        `/api/rooms/${roomId}/join`,
        {
          method: 'POST',
          body: JSON.stringify({ password }),
        },
        token
      );
      setJoinOpen(false);
      navigate(`/room/${room.id}`, { state: { expiresAt: room.expires_at } });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFeedback = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch(
        '/api/feedbacks',
        {
          method: 'POST',
          body: JSON.stringify({ content: feedbackContent }),
        },
        token
      );
      setFeedbackOpen(false);
      setFeedbackContent('');
      alert('Cảm ơn bạn đã gửi phản hồi!');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Phòng học đang mở</h1>
          <p className="dashboard-sub">Tham gia hoặc tạo phòng học cùng bạn bè</p>
        </div>
        <div className="dashboard-actions">
          <Button variant="secondary" onClick={() => setFeedbackOpen(true)}>
            Gửi Feedback
          </Button>
          <Button onClick={() => setCreateOpen(true)}>Tạo phòng</Button>
        </div>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      {loading ? (
        <p className="dashboard-loading">Đang tải danh sách phòng...</p>
      ) : rooms.length === 0 ? (
        <div className="dashboard-empty">
          <span>🏠</span>
          <p>Chưa có phòng nào đang mở. Hãy tạo phòng đầu tiên!</p>
        </div>
      ) : (
        <div className="room-grid">
          {rooms.map((room) => (
            <div key={room.id} className="room-card">
              <div className="room-card-top">
                <h3>{room.name}</h3>
                {room.hasPassword && <span className="room-lock">🔒</span>}
              </div>
              <div className="room-card-meta">
                <span>👥 {room.activeUsers}/10</span>
                <span>
                  ⏱ {formatExpiry(room.expires_at)}
                </span>
              </div>
              <p className="room-host">
                Host: {room.profiles?.full_name || 'Unknown'}
              </p>
              <Button fullWidth onClick={() => openJoin(room)}>
                Vào phòng
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo phòng học"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreate}>Tạo</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="form-stack">
          <Input
            label="Tên phòng"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            placeholder="VD: Ôn thi cuối kỳ"
            required
          />
          <Input
            label="Mật khẩu (tùy chọn)"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            placeholder="Để trống nếu không cần"
          />
          <Input
            label="Thời gian đếm ngược (phút)"
            type="number"
            value={createForm.durationMinutes}
            onChange={(e) =>
              setCreateForm({ ...createForm, durationMinutes: e.target.value })
            }
            required
          />
        </form>
      </Modal>

      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title={`Vào phòng: ${selectedRoom?.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setJoinOpen(false)}>
              Hủy
            </Button>
            <Button onClick={() => joinRoom(selectedRoom.id, joinPassword)}>
              Vào phòng
            </Button>
          </>
        }
      >
        <Input
          label="Mật khẩu phòng"
          type="password"
          value={joinPassword}
          onChange={(e) => setJoinPassword(e.target.value)}
          placeholder="Nhập mật khẩu"
          required
        />
      </Modal>

      <Modal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title="Gửi phản hồi"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFeedbackOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleFeedback}>Gửi</Button>
          </>
        }
      >
        <form onSubmit={handleFeedback}>
          <label className="input-group">
            <span className="input-label">Ý kiến của bạn</span>
            <textarea
              className="feedback-textarea"
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              placeholder="Chia sẻ trải nghiệm, góp ý cải thiện..."
              rows={4}
              required
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}

function formatExpiry(iso) {
  const diff = new Date(iso) - Date.now();
  if (diff <= 0) return 'Hết hạn';
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}
