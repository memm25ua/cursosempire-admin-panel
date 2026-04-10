import { useState } from 'react';
import CreateUser from './components/CreateUser';
import UserSearch from './components/UserSearch';

type Tab = 'crear' | 'usuarios';

export default function App() {
  const [tab, setTab] = useState<Tab>('usuarios');

  return (
    <div className="container">
      <header>
        <h1>Panel de admin</h1>
      </header>

      <nav>
        <button className={tab === 'usuarios' ? 'active' : ''} onClick={() => setTab('usuarios')}>
          Usuarios
        </button>
        <button className={tab === 'crear' ? 'active' : ''} onClick={() => setTab('crear')}>
          Crear usuario
        </button>
      </nav>

      {tab === 'usuarios' && <UserSearch />}
      {tab === 'crear' && <CreateUser />}
    </div>
  );
}
