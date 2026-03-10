import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@smefinder.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await apiPost('/api/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch {
      setError('Invalid credentials');
    }
  }

  return (
    <form className="max-w-md mx-auto bg-white p-6 rounded shadow" onSubmit={submit}>
      <h1 className="text-xl font-semibold mb-4">Sign in</h1>
      <input className="w-full border p-2 mb-3" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input className="w-full border p-2 mb-3" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <button className="bg-sky-700 text-white px-4 py-2 rounded" type="submit">Login</button>
    </form>
  );
}
