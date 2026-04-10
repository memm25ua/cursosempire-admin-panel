import { useState } from 'react';
import CreateUser from './components/CreateUser';
import UserSearch from './components/UserSearch';
import UserList from './components/UserList';

type Tab = 'create' | 'search' | 'list';

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
        <button className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')}>
          List Users
        </button>
      </nav>

      {tab === 'search' && <UserSearch />}
      {tab === 'create' && <CreateUser />}
      {tab === 'list' && <UserList />}
    </div>
  );
}
