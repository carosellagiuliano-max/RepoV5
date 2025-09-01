import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { useAuth } from '@/contexts/auth-context';

export default function Admin() {
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    // Navigation will be handled automatically by the auth state change and SessionGuard
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminDashboard onLogout={handleLogout} />
    </div>
  );
}