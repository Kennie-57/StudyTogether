import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './Button';
import './Layout.css';

export default function Layout() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const nav = [
    { to: '/', label: 'Trang chủ' },
    { to: '/profile', label: 'Cá nhân' },
  ];

  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/" className="layout-brand">
          <span className="brand-icon">📖</span>
          Study Together
        </Link>
        <nav className="layout-nav">
          {nav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`nav-link ${location.pathname === to ? 'active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="layout-user">
          {user?.user_metadata?.avatar_url && (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className="user-avatar"
            />
          )}
          <Button variant="ghost" size="sm" onClick={signOut}>
            Đăng xuất
          </Button>
        </div>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
