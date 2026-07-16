import { NavLink } from 'react-router-dom';
import { Home, Shield, ShieldAlert, Users, Settings, LogOut, Server, Cloud, Bell } from 'lucide-react';
import { useSessionStore } from '../store/session';

export function Navigation() {
  const { user, clearUser } = useSessionStore();
  
  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3000/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    clearUser();
    window.location.href = '/login';
  };
  
  const navItems = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Secrets', path: '/secrets', icon: Shield },
    { name: 'Approvals', path: '/approvals', icon: ShieldAlert },
    { name: 'Sharing', path: '/sharing', icon: Users },
    { name: 'Connected Apps', path: '/connected-apps', icon: Server },
    { name: 'Emergency', path: '/emergency', icon: ShieldAlert },
    { name: 'Cloud Backup', path: '/backup', icon: Cloud },
    { name: 'Alert Rules', path: '/alerts', icon: Bell },
    { name: 'Security Settings', path: '/security', icon: Shield },
    { name: 'Users (Admin)', path: '/admin/users', icon: Users, adminOnly: true },
    { name: 'SSO Applications', path: '/admin/sso', icon: Server, adminOnly: true },
    { name: 'Controls (Admin)', path: '/admin/controls', icon: Settings, adminOnly: true },
  ];

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          VowGuard
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.filter(item => !item.adminOnly || (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN')).map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-primary dark:bg-blue-900/20 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-2">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : 'bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`
            }
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="flex flex-col truncate w-full">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{user?.name || user?.role || 'User'}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || 'Loading...'}</span>
            </div>
          </NavLink>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full text-left"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
