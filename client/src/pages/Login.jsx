import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { getConfigErrors } from '../lib/config.js';
import './Login.css';

function parseAuthError(err) {
  const msg = err?.message || '';
  if (msg.includes('provider is not enabled') || err?.error_code === 'validation_failed') {
    return 'Google OAuth chưa được bật trên Supabase. Vào Dashboard → Authentication → Providers → Google và bật provider.';
  }
  if (msg.includes('redirect') || msg.includes('Redirect')) {
    return 'Redirect URL chưa được phép. Vào Supabase → Authentication → URL Configuration, thêm https://study-together-jade.vercel.app/** vào Redirect URLs.';
  }
  return msg || 'Đăng nhập thất bại. Vui lòng thử lại.';
}

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const configErrors = getConfigErrors();

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const authError =
      params.get('error_description') ||
      hashParams.get('error_description') ||
      params.get('error') ||
      hashParams.get('error');
    if (authError) {
      setError(decodeURIComponent(authError.replace(/\+/g, ' ')));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleLogin = async () => {
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(parseAuthError(err));
    }
  };

  if (loading) {
    return <div className="login-page"><p>Đang tải...</p></div>;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-hero">
          <span className="login-icon">📚</span>
          <h1>Study Together</h1>
          <p>
            Không gian học tập ảo — cùng áp lực đồng đẳng, duy trì động lực
            theo thời gian thực.
          </p>
        </div>
        {configErrors.length > 0 && (
          <div className="login-error">
            <strong>Cấu hình deploy chưa đầy đủ:</strong>
            <ul>
              {configErrors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
        {error && <div className="login-error">{error}</div>}
        <Button fullWidth onClick={handleLogin} disabled={configErrors.length > 0}>
          Đăng nhập bằng Google
        </Button>
      </div>
    </div>
  );
}
