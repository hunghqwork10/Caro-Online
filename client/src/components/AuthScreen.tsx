import React, { useState } from 'react';

type AuthUser = {
  id?: string;
  username: string;
  [key: string]: unknown;
};

type AuthResponse = {
  user: AuthUser;
  token: string;
  message?: string;
};

interface AuthScreenProps {
  onAuthSuccess: (user: AuthUser, token: string) => void;
}

function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = (await response.json()) as Partial<AuthResponse>;

      if (!response.ok) {
        throw new Error(typeof data.message === 'string' ? data.message : 'Có lỗi xảy ra');
      }

      if (!data.user || !data.token) {
        throw new Error('Phản hồi đăng nhập không hợp lệ');
      }

      onAuthSuccess(data.user, data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h2>Caro Online - {isLogin ? 'Đăng nhập' : 'Đăng ký'}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Tên tài khoản"
          value={username}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
        />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký'}
        </button>
      </form>
      <button className="auth-toggle" onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
      </button>
    </div>
  );
}

export default AuthScreen;