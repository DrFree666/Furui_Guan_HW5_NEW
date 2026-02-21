import { useState } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('chatapp_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (userData) => {
    const payload =
      typeof userData === 'string'
        ? { username: userData, firstName: null, lastName: null }
        : {
            username: userData.username,
            firstName: userData.firstName ?? null,
            lastName: userData.lastName ?? null,
          };
    localStorage.setItem('chatapp_user', JSON.stringify(payload));
    setUser(payload);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatapp_user');
    setUser(null);
  };

  if (user) {
    return (
      <Chat
        username={user.username}
        firstName={user.firstName}
        lastName={user.lastName}
        onLogout={handleLogout}
      />
    );
  }
  return <Auth onLogin={handleLogin} />;
}

export default App;
