import { type ReactNode } from 'react';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80';

type AuthLayoutProps = {
  children: ReactNode;
  /** Optional: custom badge text (e.g. "Connexion Espace Agence") */
  badge?: string;
  title: string;
  subtitle?: string;
};

export function AuthLayout({ children, badge, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background-light">
      {/* Left: Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary/10">
        <img
          alt="Espace professionnel immobilier"
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60"
          src={HERO_IMAGE}
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-background-dark/80 via-background-dark/40 to-transparent" />
        <div className="relative z-10 flex flex-col justify-between p-16 w-full text-white">
          <div className="flex items-center gap-2">
            <div className="bg-white p-2 rounded-lg">
              <span className="material-icons text-primary text-3xl">handshake</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-white drop-shadow-md">
              PourAccord
            </span>
          </div>
          <div className="max-w-md">
            <h1 className="text-5xl font-extrabold leading-tight mb-6 drop-shadow-md">
              Digitalisez vos
              <br />
              <span className="text-primary">accords B2B</span>
            </h1>
            <p className="text-xl text-white/90 leading-relaxed">
              L’espace dédié aux professionnels de l’immobilier pour accélérer la signature et la
              gestion de vos mandats.
            </p>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="material-icons text-primary/80">verified_user</span>
              <span className="text-sm font-medium">Standard Certifié</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-icons text-primary/80">insights</span>
              <span className="text-sm font-medium">Performance Agence</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-24 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            {badge && (
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-6">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse mr-2" />
                {badge}
              </div>
            )}
            <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
            {subtitle && (
              <p className="mt-2 text-slate-500">{subtitle}</p>
            )}
          </div>
          {children}
          {/* Trust badges */}
          <div className="pt-8 mt-8 border-t border-slate-100 flex flex-wrap justify-center gap-6 opacity-70">
            <div className="flex items-center gap-2">
              <span className="material-icons text-slate-400 text-lg">verified</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Conformité RGPD garantie
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-icons text-slate-400 text-lg">credit_card</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Sécurisé par Stripe
              </span>
            </div>
          </div>
        </div>
        <div className="mt-auto pt-10 text-center lg:hidden">
          <span className="text-slate-400 text-xs">
            © {new Date().getFullYear()} PourAccord. Espace sécurisé.
          </span>
        </div>
      </div>
    </div>
  );
}
