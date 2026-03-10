import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';

export default function RespondPage() {
  const [message, setMessage] = useState('Submitting response...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const action = params.get('action');

    fetch(`${API_BASE}/api/respond?token=${encodeURIComponent(token || '')}&action=${encodeURIComponent(action || '')}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        return res.json();
      })
      .then((data) => setMessage(`Response saved: ${data.status}`))
      .catch(() => setMessage('Unable to process this response link.'));
  }, []);

  return <div className="max-w-xl mx-auto bg-white p-6 rounded shadow">{message}</div>;
}
