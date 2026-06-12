import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import './Profile.css';

export default function Profile() {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/profiles/me', {}, token)
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p>Đang tải...</p>;

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'User';
  const avatar =
    profile?.avatar_url || user?.user_metadata?.avatar_url || null;

  return (
    <div className="profile">
      <h1>Trang cá nhân</h1>
      <div className="profile-card">
        {avatar ? (
          <img src={avatar} alt="" className="profile-avatar" />
        ) : (
          <div className="profile-avatar placeholder">👤</div>
        )}
        <div className="profile-info">
          <h2>{displayName}</h2>
          <p className="profile-email">{user?.email}</p>
          <div className="profile-stat">
            <span className="stat-value">{profile?.rooms_joined_count ?? 0}</span>
            <span className="stat-label">Phòng đã tham gia</span>
          </div>
        </div>
      </div>
    </div>
  );
}
