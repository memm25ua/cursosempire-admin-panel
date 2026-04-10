import { useState } from 'react';
import CreateUser from './components/CreateUser';
import UserSearch from './components/UserSearch';

type Tab = 'create' | 'search';

export default function App() {
  const [tab, setTab] = useState<Tab>('search');

  return (
    <div className="container">
      <header>
        <h1>Admin Panel</h1>
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
