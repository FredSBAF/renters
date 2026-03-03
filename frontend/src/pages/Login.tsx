import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { login as loginThunk } from '../store/authSlice';
import { AuthLayout } from '../components/AuthLayout';

const schema = yup.object({
  email: yup.string().email('Email invalide').required('Email requis'),
  password: yup.string().required('Mot de passe requis'),
  remember_me: yup.boolean().optional(),
  totp_code: yup.string().length(6).optional(),
});

type FormData = yup.InferType<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    const result = await dispatch(loginThunk(data));
    if (loginThunk.fulfilled.match(result) && !result.payload.requires2fa) {
      navigate('/', { replace: true });
    }
  };

  return (
    <AuthLayout
      badge="Connexion"
      title="Bienvenue"
      subtitle="Accédez à vos outils de gestion immobilière"
    >
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">
            Email professionnel
          </label>
          <div className="relative">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
              mail_outline
            </span>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="agence@contact.fr"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900"
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
              Mot de passe
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-primary hover:underline transition-all"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="relative">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
              lock_outline
            </span>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900"
              {...register('password')}
            />
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>
        <div className="flex items-center">
          <input
            id="remember-me"
            type="checkbox"
            className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
            {...register('remember_me')}
          />
          <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600">
            Rester connecté
          </label>
        </div>
        <div>
          <label htmlFor="totp_code" className="block text-sm font-semibold text-slate-700 mb-2">
            Code 2FA (optionnel)
          </label>
          <input
            id="totp_code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900"
            {...register('totp_code')}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:transform-none"
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
      <div className="text-center">
        <p className="text-sm text-slate-500">
          Pas encore inscrit ?{' '}
          <Link to="/register" className="text-primary font-bold hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
