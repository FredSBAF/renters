import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { verifyEmail } from '../store/authSlice';
import { AuthLayout } from '../components/AuthLayout';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);
  const [done, setDone] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setDone(true);
      return;
    }
    dispatch(verifyEmail(token)).then((result) => {
      setDone(true);
      if (verifyEmail.fulfilled.match(result)) {
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    });
  }, [token, dispatch, navigate]);

  if (!token) {
    return (
      <AuthLayout
        badge="Vérification"
        title="Lien invalide"
        subtitle="Aucun token de vérification fourni."
      >
        <div className="text-center space-y-4">
          <span className="material-icons text-6xl text-slate-300">link_off</span>
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/30 transition-all"
          >
            Retour à la connexion
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (!done) {
    return (
      <AuthLayout
        badge="Vérification"
        title="Vérification en cours..."
        subtitle={loading ? 'Validation de votre email...' : 'Veuillez patienter.'}
      >
        <div className="flex justify-center py-8">
          <span className="material-icons text-5xl text-primary animate-pulse">mark_email_read</span>
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout
        badge="Vérification"
        title="Échec de la vérification"
        subtitle={error}
      >
        <div className="text-center space-y-4">
          <span className="material-icons text-6xl text-red-400">error_outline</span>
          <Link
            to="/register"
            className="inline-flex items-center justify-center w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/30 transition-all"
          >
            Réessayer l’inscription
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      badge="Vérification"
      title="Email validé"
      subtitle="Votre adresse a été validée. Redirection vers la connexion..."
    >
      <div className="text-center space-y-4">
        <span className="material-icons text-6xl text-green-500">check_circle</span>
      </div>
    </AuthLayout>
  );
}
