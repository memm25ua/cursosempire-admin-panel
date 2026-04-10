import { useState, useEffect } from 'react';
import { api } from './lib/api';
import Login from './components/Login';
import CreateUser from './components/CreateUser';
import UserSearch from './components/UserSearch';

type Tab = 'create' | 'search';

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('search');

  useEffect(() => {
    api.me()
      .then(d => setAuthenticated(d.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) return <div className="container"><p>Loading…</p></div>;

  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;

  const handleLogout = async () => {
    await api.logout();
    setAuthenticated(false);
  };

  return (
    <div className="container">
      <header>
        <h1>Admin Panel</h1>
        <button className="danger" onClick={handleLogout}>Logout</button>
      </header>

      <nav>
        <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>
          Search / Edit User
        </button>
        <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>
          Create User
        </button>
      </nav>

      {tab === 'search' && <UserSearch />}
      {tab === 'create' && <CreateUser />}
    </div>
  );
}
