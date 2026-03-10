import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../lib/api';
import nisLogo from '../assets/nis-logo.svg';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await apiPost('/api/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/visitor-kiosk');
    } catch {
      setError('Invalid credentials');
    }
  }

  return (
    <form className="max-w-md mx-auto bg-white p-6 rounded shadow" onSubmit={submit}>
      <img
        src={nisLogo}
        alt="NIS logo"
        className="mb-4 h-24 w-auto max-w-full rounded border border-slate-200 p-2 object-contain"
      />
      <h1 className="text-xl font-semibold mb-4">Admin Sign In</h1>
      <input className="w-full border p-2 mb-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input className="w-full border p-2 mb-3" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <button className="bg-sky-700 text-white px-4 py-2 rounded" type="submit">Login</button>
    </form>
  );
}
