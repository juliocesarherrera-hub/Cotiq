import { useState } from 'react';
import { LockKeyhole, LogIn, UserPlus } from 'lucide-react';
import { apiRequest } from './api.js';
import { LEGAL_TERMS_VERSION } from '../legal-config.js';

export default function AuthScreen({ onAuthenticated, initialError = '' }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await apiRequest(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          ...(mode === 'register'
            ? { acceptedTermsVersion: LEGAL_TERMS_VERSION, confirmedAdult: true }
            : {})
        })
      });
      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRegistering = mode === 'register';

  return (
    <main className="cotiq-light min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 bg-emerald-500 text-emerald-950 rounded-xl flex items-center justify-center font-black">C</div>
          <div>
            <h1 className="font-extrabold text-lg">Cotiq</h1>
            <p className="text-xs text-slate-400">Tus compras, ligadas a tu cuenta</p>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-2">{isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
        <p className="text-sm text-slate-400 mb-6">
          {isRegistering
            ? 'Crea una cuenta para guardar tus compras y recuperar tu acceso.'
            : 'Entra para consultar tu licencia y tus créditos.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="account-email" className="block text-xs font-semibold text-slate-300 mb-1.5">Correo electrónico</label>
            <input
              id="account-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="account-password" className="block text-xs font-semibold text-slate-300 mb-1.5">Contraseña</label>
            <input
              id="account-password"
              type="password"
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              required
              minLength={isRegistering ? 12 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
            />
            {isRegistering && <p className="text-[11px] text-slate-500 mt-1">Usa al menos 12 caracteres.</p>}
          </div>

          {error && <p role="alert" className="text-sm text-rose-300 bg-rose-950/50 border border-rose-900 rounded-xl p-3">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-emerald-950 font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
          >
            {isRegistering ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {isSubmitting ? 'Procesando…' : isRegistering ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(isRegistering ? 'login' : 'register'); setError(''); }}
          className="w-full mt-4 text-sm text-emerald-300 hover:text-emerald-200 py-2"
        >
          {isRegistering ? 'Ya tengo una cuenta' : 'Crear una cuenta nueva'}
        </button>

        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 mt-4">
          <LockKeyhole className="w-3 h-3" /> Sesión privada; tu contraseña no se guarda en este dispositivo.
        </p>
      </section>
    </main>
  );
}
