import { NavLink } from 'react-router-dom';
import { Home, Shield, ShieldAlert, Users, Settings, LogOut, Server, Cloud, Bell, Menu } from 'lucide-react';
import { useState } from 'react';
import { useSessionStore } from '../store/session';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '../lib/utils';

export function Navigation() {
  const { user, clearUser } = useSessionStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
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
    <div className={cn("bg-card border-r border-border h-screen flex flex-col shadow-sm z-10 relative transition-all duration-300", isCollapsed ? "w-16" : "w-64")}>
      <div className={cn("p-4 border-b border-border flex items-center h-16", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2 tracking-tight whitespace-nowrap">
              <Shield className="w-6 h-6 text-primary flex-shrink-0" />
              VowGuard
            </h1>
            {user?.organizationName && (
              <span className="text-xs text-muted-foreground ml-8 truncate">
                {user.organizationName}
              </span>
            )}
          </div>
        )}
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
      </div>
      
      <nav className="flex-1 p-3 space-y-1">
        {navItems.filter(item => !item.adminOnly || (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN')).map((item) => (
          <div key={item.name} className="relative group">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-md transition-colors text-sm font-medium",
                  isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-1.5",
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className={cn("flex-shrink-0", isCollapsed ? "w-5 h-5" : "w-4 h-4")} />
              {!isCollapsed && <span className="whitespace-nowrap overflow-hidden">{item.name}</span>}
            </NavLink>
            {isCollapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-foreground text-background px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-md">
                {item.name}
              </div>
            )}
          </div>
        ))}
      </nav>
      
      <div className="p-3 border-t border-border flex flex-col gap-1 items-center">
        {!isCollapsed ? (
          <div className="flex items-center gap-2 w-full p-2 mb-1 rounded-md bg-muted/50 border border-border/50 overflow-hidden">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarImage src={user?.avatarUrl} alt="Avatar" />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-left truncate flex-1">
              <span className="text-sm font-semibold text-foreground truncate">{user?.name || user?.role || 'User'}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email || 'Loading...'}</span>
            </div>
          </div>
        ) : (
          <div className="mb-2 relative group w-full flex justify-center">
            <Avatar className="w-8 h-8 flex-shrink-0 cursor-pointer">
              <AvatarImage src={user?.avatarUrl} alt="Avatar" />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-foreground text-background px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-md">
              {user?.name || user?.email || 'User'}
            </div>
          </div>
        )}
        
        <div className="relative group w-full">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-md transition-colors text-sm font-medium",
                isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-1.5 w-full",
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Settings className={cn("flex-shrink-0", isCollapsed ? "w-5 h-5" : "w-4 h-4")} />
            {!isCollapsed && <span className="whitespace-nowrap overflow-hidden">Profile Settings</span>}
          </NavLink>
          {isCollapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-foreground text-background px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-md">
              Profile Settings
            </div>
          )}
        </div>
        
        <div className="relative group w-full">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center rounded-md transition-colors text-sm font-medium text-destructive hover:bg-destructive/10 w-full text-left",
              isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-1.5"
            )}
          >
            <LogOut className={cn("flex-shrink-0", isCollapsed ? "w-5 h-5" : "w-4 h-4")} />
            {!isCollapsed && <span className="whitespace-nowrap overflow-hidden">Log out</span>}
          </button>
          {isCollapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-foreground text-background px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-md">
              Log out
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
