import { useState, useEffect } from 'react';
import { auth } from './firebase';
import Auth from './components/Auth';
import Planner from './components/Planner';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogin = (userData: any) => {
    setUser(userData);
  };

  const handleLogout = () => {
    auth.signOut();
    setUser(null);
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className={`${theme} h-[100dvh] overflow-hidden`}>
        <Auth 
          onLogin={handleLogin} 
          theme={theme} 
          onToggleTheme={toggleTheme} 
        />
      </div>
    );
  }

  return (
    <div className={`${theme} h-[100dvh] overflow-hidden`}>
      <Planner 
        token={user.accessToken} 
        user={user} 
        onLogout={handleLogout} 
        theme={theme} 
        onToggleTheme={toggleTheme} 
      />
    </div>
  );
}
