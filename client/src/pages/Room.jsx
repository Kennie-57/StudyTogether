import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button';
import CountdownTimer from '../components/CountdownTimer';
import Input from '../components/Input';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './Room.css';

const STATUS_OPTIONS = [
  { icon: '📚', label: 'Đang ôn tập' },
  { icon: '☕', label: 'Đang nghỉ' },
  { icon: '📝', label: 'Đang cày đề' },
];

export default function Room() {
  const { roomId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { getSocket } = useSocket();

  const [expiresAt, setExpiresAt] = useState(state?.expiresAt || null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState('15');
  const chatEndRef = useRef(null);

  const currentUser = users.find((u) => u.userId === user?.id);
  const isHost = currentUser?.isHost ?? false;

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !token) return;

    const onJoined = (data) => {
      setExpiresAt(data.expiresAt);
      setUsers(data.users);
      setMessages(data.messages || []);
      setJoined(true);
      setError('');
    };

    const onState = (data) => {
      setExpiresAt(data.expiresAt);
      setUsers(data.users);
      setMessages(data.messages || []);
    };

    const onMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const onTimerUpdated = ({ expiresAt: newExpiry }) => {
      setExpiresAt(newExpiry);
    };

    const onClosed = ({ reason }) => {
      const msg =
        reason === 'ended_by_host'
          ? 'Phòng đã được host kết thúc.'
          : 'Phòng đã hết thời gian.';
      alert(msg);
      navigate('/', { replace: true });
    };

    const onError = ({ message }) => {
      setError(message);
    };

    socket.on('room:joined', onJoined);
    socket.on('room:state', onState);
    socket.on('room:message', onMessage);
    socket.on('room:timer-updated', onTimerUpdated);
    socket.on('room:closed', onClosed);
    socket.on('room:error', onError);

    socket.emit('room:join', {
      roomId,
      token,
      expiresAt: state?.expiresAt,
    });

    return () => {
      socket.off('room:joined', onJoined);
      socket.off('room:state', onState);
      socket.off('room:message', onMessage);
      socket.off('room:timer-updated', onTimerUpdated);
      socket.off('room:closed', onClosed);
      socket.off('room:error', onError);
    };
  }, [roomId, token, getSocket, navigate, state?.expiresAt]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const setStatus = (statusIcon) => {
    getSocket()?.emit('room:status', { statusIcon });
    setUsers((prev) =>
      prev.map((u) =>
        u.userId === user?.id ? { ...u, statusIcon } : u
      )
    );
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    getSocket()?.emit('room:chat', { content: chatInput });
    setChatInput('');
  };

  const handleExtend = () => {
    const minutes = Number(extendMinutes);
    if (!minutes || minutes < 1) return;
    getSocket()?.emit('room:extend', { additionalMinutes: minutes });
    setExtendOpen(false);
  };

  const handleEndRoom = () => {
    if (!confirm('Bạn có chắc muốn kết thúc phòng?')) return;
    getSocket()?.emit('room:end');
  };

  const leaveRoom = () => {
    navigate('/');
  };

  if (error && !joined) {
    return (
      <div className="room-error-page">
        <p>{error}</p>
        <Button onClick={() => navigate('/')}>Về trang chủ</Button>
      </div>
    );
  }

  return (
    <div className="room">
      <div className="room-top">
        <Button variant="ghost" size="sm" onClick={leaveRoom}>
          ← Rời phòng
        </Button>
        {isHost && (
          <div className="host-actions">
            <Button variant="secondary" size="sm" onClick={() => setExtendOpen(true)}>
              + Thời gian
            </Button>
            <Button variant="danger" size="sm" onClick={handleEndRoom}>
              Kết thúc phòng
            </Button>
          </div>
        )}
      </div>

      {expiresAt && <CountdownTimer expiresAt={expiresAt} />}

      <div className="room-body">
        <section className="room-users-panel">
          <h2>Thành viên ({users.length}/10)</h2>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.userId} className="user-item">
                <span className="user-status">{u.statusIcon}</span>
                <span className="user-name">
                  {u.username}
                  {u.isHost && <span className="host-badge">Host</span>}
                </span>
              </li>
            ))}
          </ul>

          <div className="status-picker">
            <p>Trạng thái của bạn</p>
            <div className="status-options">
              {STATUS_OPTIONS.map(({ icon, label }) => (
                <button
                  key={icon}
                  type="button"
                  className={`status-btn ${
                    currentUser?.statusIcon === icon ? 'active' : ''
                  }`}
                  title={label}
                  onClick={() => setStatus(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="room-chat-panel">
          <h2>Chat nhóm</h2>
          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="chat-empty">Chưa có tin nhắn. Hãy chào mọi người!</p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble ${
                  msg.userId === user?.id ? 'own' : ''
                }`}
              >
                <span className="chat-author">{msg.username}</span>
                <span className="chat-text">{msg.content}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-form" onSubmit={sendChat}>
            <input
              className="chat-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Nhập tin nhắn..."
              maxLength={500}
            />
            <Button type="submit" size="sm">
              Gửi
            </Button>
          </form>
        </section>
      </div>

      <Modal
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        title="Tăng thời gian phòng"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExtendOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleExtend}>Xác nhận</Button>
          </>
        }
      >
        <Input
          label="Thêm bao nhiêu phút?"
          type="number"
          value={extendMinutes}
          onChange={(e) => setExtendMinutes(e.target.value)}
        />
      </Modal>
    </div>
  );
}
