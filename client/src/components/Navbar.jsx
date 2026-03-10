import { NavLink, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  return (
    <div className="bg-slate-900 text-white px-6 py-3 flex gap-5 items-center">
      <span className="font-semibold">SME Finder</span>
      {token && (
        <>
          <NavLink to="/dashboard" className="hover:text-sky-300">Dashboard</NavLink>
          <NavLink to="/smes" className="hover:text-sky-300">SME Search</NavLink>
          <NavLink to="/requests" className="hover:text-sky-300">Requests</NavLink>
          <NavLink to="/import" className="hover:text-sky-300">Bulk Import</NavLink>
          <button className="ml-auto bg-slate-700 px-3 py-1 rounded" onClick={logout}>Logout</button>
        </>
      )}
    </div>
  );
}
