import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { register as registerThunk } from '../store/authSlice';
import { AuthLayout } from '../components/AuthLayout';

const schema = yup.object({
  email: yup.string().email('Email invalide').required('Email requis'),
  password: yup.string().min(8, 'Au moins 8 caractères').required('Mot de passe requis'),
  password_confirmation: yup
    .string()
    .oneOf([yup.ref('password')], 'Les mots de passe ne correspondent pas')
    .required(),
  accept_terms: yup.boolean().oneOf([true], 'Vous devez accepter les CGU').required(),
  accept_privacy: yup.boolean().oneOf([true], 'Vous devez accepter la politique de confidentialité').required(),
});

type FormData = yup.InferType<typeof schema>;

const inputClass =
  'w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-slate-900';

export default function Register() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: { accept_terms: false, accept_privacy: false },
  });

  const onSubmit = async (data: FormData) => {
    const result = await dispatch(registerThunk(data));
    if (registerThunk.fulfilled.match(result)) {
      navigate('/verify-email-sent', { replace: true });
    }
  };

  return (
    <AuthLayout
      badge="Inscription"
      title="Créer un compte"
      subtitle="Rejoignez PourAccord pour gérer vos dossiers en toute sérénité"
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
              placeholder="vous@exemple.fr"
              className={inputClass}
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
            Mot de passe
          </label>
          <div className="relative">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
              lock_outline
            </span>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
              {...register('password')}
            />
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="password_confirmation" className="block text-sm font-semibold text-slate-700 mb-2">
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
              lock_outline
            </span>
            <input
              id="password_confirmation"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
              {...register('password_confirmation')}
            />
          </div>
          {errors.password_confirmation && (
            <p className="mt-1 text-sm text-red-600">{errors.password_confirmation.message}</p>
          )}
        </div>
        <div className="flex items-center">
          <input
            id="accept_terms"
            type="checkbox"
            className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
            {...register('accept_terms')}
          />
          <label htmlFor="accept_terms" className="ml-2 block text-sm text-slate-600">
            J’accepte les conditions générales
          </label>
        </div>
        {errors.accept_terms && (
          <p className="text-sm text-red-600">{errors.accept_terms.message}</p>
        )}
        <div className="flex items-center">
          <input
            id="accept_privacy"
            type="checkbox"
            className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
            {...register('accept_privacy')}
          />
          <label htmlFor="accept_privacy" className="ml-2 block text-sm text-slate-600">
            J’accepte la politique de confidentialité
          </label>
        </div>
        {errors.accept_privacy && (
          <p className="text-sm text-red-600">{errors.accept_privacy.message}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:transform-none"
        >
          {loading ? 'Inscription...' : "S’inscrire"}
        </button>
      </form>
      <div className="text-center">
        <p className="text-sm text-slate-500">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-primary font-bold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
