import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';

export default function VerifyEmailSent() {
  return (
    <AuthLayout
      badge="Inscription"
      title="Email de confirmation envoyé"
      subtitle="Un lien de vérification a été envoyé à votre adresse email."
    >
      <div className="space-y-6 text-center">
        <span className="material-icons text-6xl text-primary">mark_email_unread</span>
        <p className="text-sm text-slate-500">
          Cliquez sur le lien dans l’email pour activer votre compte. Pensez à vérifier vos spams si
          vous ne voyez pas l’email.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-lg transition-all"
        >
          Retour à la connexion
        </Link>
      </div>
    </AuthLayout>
  );
}
