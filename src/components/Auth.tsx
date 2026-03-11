import React, { useState } from 'react';
import { MapPin, Sun, Moon } from 'lucide-react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';

interface AuthProps {
  onLogin: (user: any) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Auth({ onLogin, theme, onToggleTheme }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setMessage('註冊成功！請檢查您的信箱進行驗證。');
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          setError('請先驗證您的電子郵件。');
          return;
        }
        onLogin(userCredential.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('請輸入信箱以重設密碼');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('密碼重設信已發送至您的信箱。');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors relative overflow-y-auto">
      <div className="absolute top-4 right-4">
        <button
          onClick={onToggleTheme}
          className="p-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          title={theme === 'light' ? '切換深色模式' : '切換淺色模式'}
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
            <MapPin className="text-white w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
          旅遊規劃器
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          {isRegistering ? '建立新帳號' : '登入您的帳號'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-100 dark:border-slate-800">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* ... email/password fields ... */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                信箱 (Email)
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                密碼 (Password)
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-100 dark:border-red-900/30">
                {error}
              </div>
            )}
            {message && (
              <div className="text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-100 dark:border-green-900/30">
                {message}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                忘記密碼？
              </button>
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                {isRegistering ? '已有帳號？登入' : '沒有帳號？註冊'}
              </button>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                {loading ? '處理中...' : (isRegistering ? '註冊' : '登入')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
