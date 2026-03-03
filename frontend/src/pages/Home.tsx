import { useAppSelector } from '../store/hooks';
import { useNavigate, Link } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { logout } from '../store/authSlice';

export default function Home() {
  const { user, accessToken } = useAppSelector((s) => s.auth);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  if (!accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Pouraccord</h1>
          <div className="flex gap-4 justify-center">
            <Link
              to="/login"
              className="px-4 py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              Se connecter
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              S’inscrire
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Pouraccord</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Déconnexion
          </button>
        </div>
        <div className="rounded-lg bg-white shadow p-4">
          <p className="text-gray-600">
            Connecté en tant que <strong>{user?.email}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
