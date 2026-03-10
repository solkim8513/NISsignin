import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

function LinkItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2 text-sm transition ${
          isActive ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-white/10'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  const inSmeSection = location.pathname.startsWith('/smes');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 md:flex">
      <aside className="w-full bg-[#0b1733] text-white md:min-h-screen md:w-64">
        <div className="border-b border-white/10 p-5">
          <h1 className="text-2xl font-semibold tracking-tight">SME Finder</h1>
          <p className="mt-1 text-xs text-slate-300">Proposal Team Tool</p>
        </div>

        <nav className="space-y-3 p-3">
          <LinkItem to="/dashboard">Dashboard</LinkItem>
          <div className={`rounded-lg p-2 ${inSmeSection ? 'bg-white/5' : ''}`}>
            <p className="px-2 pb-2 text-xs uppercase tracking-widest text-slate-400">SME Directory</p>
            <div className="space-y-1">
              <LinkItem to="/smes">Directory</LinkItem>
              <LinkItem to="/smes/import">Bulk Import</LinkItem>
            </div>
          </div>
          <LinkItem to="/requests">Requests</LinkItem>
          <LinkItem to="/visitor-kiosk">Visitor Kiosk</LinkItem>
        </nav>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <span className="text-sm text-slate-500">{user.first_name || 'User'} {user.last_name || ''}</span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            {String(user.role || 'viewer').replace('_', ' ')}
          </span>
          <button
            onClick={logout}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Sign out
          </button>
        </header>

        <main className="px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
