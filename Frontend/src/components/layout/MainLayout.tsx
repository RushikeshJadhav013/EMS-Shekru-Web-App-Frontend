import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import TaskDeadlineWarnings from '@/components/tasks/TaskDeadlineWarnings';
import { useNotifications } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Logo } from '@/components/ui/Logo';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Home,
  Users,
  Calendar,
  ClipboardList,
  BarChart3,
  Bell,
  LogOut,
  Menu,
  X,
  Globe,
  User,
  Briefcase,
  Clock,
  CalendarDays,
  UserPlus,
  MessageCircle,
  ChevronRight,
  Banknote,
  FolderKanban,
  Video,
} from 'lucide-react';
import { UserRole } from '@/types';
import { Language } from '@/i18n/translations';
import { Badge } from '@/components/ui/badge';
import ChatNotificationBadge from '@/components/chat/ChatNotificationBadge';
import { ScopeSelectorDialog } from '@/components/common/ScopeSelectorDialog';
import { useEffect } from 'react';

const MainLayout: React.FC = () => {
  const { user, logout, showDeadlineWarnings, setShowDeadlineWarnings } = useAuth();
  const { notifications } = useNotifications();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { companySlug } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showScopeDialog, setShowScopeDialog] = useState(false);

  useEffect(() => {
    const handleScopeConflict = () => {
      setShowScopeDialog(true);
    };

    window.addEventListener('scope-conflict', handleScopeConflict);
    return () => window.removeEventListener('scope-conflict', handleScopeConflict);
  }, []);

  // Enable navigation guard to handle back/forward button
  useNavigationGuard();

  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutDialog(false);
    logout();
  };

  const unreadMeetingsCount = (notifications || []).filter(
    (n) => n.type === "meeting" && !n.read
  ).length;

  const unreadLeavesCount = (notifications || []).filter(
    (n) => n.type === "leave" && !n.read
  ).length;

  const unreadTasksCount = (notifications || []).filter(
    (n) => n.type === "task" && !n.read
  ).length;

  const unreadShiftsCount = (notifications || []).filter(
    (n) => n.type === "shift" && !n.read
  ).length;

  if (!user) return null;

  const getNavigationItems = () => {
    const commonItems = [
      { icon: Home, label: t.navigation.home, path: `/${user.role}` },
      { icon: Clock, label: t.navigation.attendance, path: `/${user.role}/attendance` },
      { icon: CalendarDays, label: t.navigation.leaves, path: `/${user.role}/leaves`, badgeCount: unreadLeavesCount },
      { icon: ClipboardList, label: t.navigation.tasks, path: `/${user.role}/tasks`, badgeCount: unreadTasksCount },
      { icon: MessageCircle, label: t.navigation.chat, path: `/${user.role}/chat` },
      { icon: Banknote, label: t.navigation.salary, path: '/salary' },
      { icon: Video, label: t.navigation.meetings, path: '/meetings', badgeCount: unreadMeetingsCount },
    ];

    const roleSpecificItems: Record<UserRole, typeof commonItems> = {
      admin: [
        { icon: Home, label: t.navigation.home, path: '/admin' },
        { icon: Clock, label: t.navigation.attendance, path: '/admin/attendance' },
        { icon: Users, label: t.navigation.employees, path: '/admin/employees' },
        { icon: UserPlus, label: t.navigation.hiring, path: '/admin/hiring' },
        { icon: CalendarDays, label: t.navigation.leaves, path: '/admin/leaves', badgeCount: unreadLeavesCount },
        { icon: ClipboardList, label: t.navigation.tasks, path: '/admin/tasks', badgeCount: unreadTasksCount },
        { icon: MessageCircle, label: t.navigation.chat, path: '/admin/chat' },
        { icon: Banknote, label: t.navigation.salary, path: '/salary' },
        { icon: Video, label: t.navigation.meetings, path: '/meetings', badgeCount: unreadMeetingsCount },
        { icon: FolderKanban, label: t.navigation.projects, path: '/admin/projects' },
        { icon: BarChart3, label: t.navigation.reports, path: '/admin/reports' },
      ],
      hr: [
        { icon: Home, label: t.navigation.home, path: '/hr' },
        { icon: Clock, label: t.navigation.attendance, path: '/hr/attendance' },
        { icon: Users, label: t.navigation.employees, path: '/hr/employees' },
        { icon: UserPlus, label: t.navigation.hiring, path: '/hr/hiring' },
        { icon: CalendarDays, label: t.navigation.leaves, path: '/hr/leaves', badgeCount: unreadLeavesCount },
        { icon: ClipboardList, label: t.navigation.tasks, path: '/hr/tasks', badgeCount: unreadTasksCount },
        { icon: MessageCircle, label: t.navigation.chat, path: '/hr/chat' },
        { icon: Banknote, label: t.navigation.salary, path: '/salary' },
        { icon: Video, label: t.navigation.meetings, path: '/meetings', badgeCount: unreadMeetingsCount },
        { icon: FolderKanban, label: 'Projects', path: '/hr/projects' },
        { icon: BarChart3, label: t.navigation.reports, path: '/hr/reports' },
      ],
      manager: [
        ...commonItems,
        { icon: Clock, label: t.navigation.shiftSchedule, path: '/manager/shift-schedule', badgeCount: unreadShiftsCount },
        { icon: FolderKanban, label: 'Projects', path: '/manager/projects' },
      ],
      team_lead: [
        ...commonItems,
        { icon: Clock, label: t.navigation.shiftSchedule, path: '/team_lead/team', badgeCount: unreadShiftsCount },
        { icon: FolderKanban, label: 'Projects', path: '/team_lead/projects' },
      ],
      employee: [
        ...commonItems,
        { icon: Clock, label: t.navigation.shiftSchedule, path: '/employee/team', badgeCount: unreadShiftsCount },
        { icon: FolderKanban, label: 'Projects', path: '/employee/projects' },
      ],
    };

    const items = roleSpecificItems[user.role];

    // Prepend companySlug if it exists
    if (companySlug) {
      return items.map(item => ({
        ...item,
        path: item.path.startsWith('/') ? `/${companySlug}${item.path}` : `/${companySlug}/${item.path}`
      }));
    }

    return items;
  };

  const navigationItems = getNavigationItems();

  // Custom function to determine if a navigation item should be active
  const isNavItemActive = (itemPath: string) => {
    const currentPath = location.pathname;

    // Exact match for home/dashboard
    if (itemPath === `/${user.role}`) {
      return currentPath === itemPath;
    }

    // For chat and other main management routes, use startsWith to catch sub-routes
    // e.g., /admin/employees should match /admin/employees/new/
    if (itemPath.includes('/chat') || itemPath.includes('/employees') || itemPath.includes('/hiring') || itemPath.includes('/projects') || itemPath.includes('/reports')) {
      return currentPath.startsWith(itemPath);
    }

    // Default to startsWith but avoid common prefixes if needed. 
    // Given the role-specific paths, simple startsWith or exact match usually suffices.
    return currentPath === itemPath;
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      {/* Top Navigation Bar */}
      <header className="z-50 w-full border-b-2 border-[#5e5b5b] bg-white dark:bg-gray-950 shadow-xl shrink-0">
        <div className="flex h-16 w-full items-center gap-4 px-4">
          {/* Sidebar Toggle - Mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 border border-[#5e5b5b] hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Sidebar Toggle - Desktop */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 border border-[#5e5b5b] hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </Button>

          {/* Logo */}
          <div className="flex items-center cursor-pointer group" onClick={() => navigate(companySlug ? `/${companySlug}/${user.role}` : `/${user.role}`)}>
            <Logo
              className="flex items-center gap-2 group-hover:scale-[1.02] transition-transform duration-200"
              iconClassName="h-10 w-10 drop-shadow-sm"
              textClassName="text-2xl font-bold tracking-tight hidden sm:block"
            />
          </div>

          <div className="flex-1" />

          {/* Language Selector */}
          <Select value={language} onValueChange={(value: Language) => setLanguage(value)}>
            <SelectTrigger className="w-[140px] h-10 bg-white dark:bg-gray-900 border border-[#5e5b5b] hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 rounded-lg">
              <Globe className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border border-gray-200 dark:border-gray-700 shadow-lg">
              <SelectItem value="en" className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                <span className="font-medium">English</span>
              </SelectItem>
              <SelectItem value="hi" className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                <span className="font-medium">हिंदी</span>
              </SelectItem>
              <SelectItem value="mr" className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                <span className="font-medium">मराठी</span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Notification Bell */}
          <div className="flex items-center">
            <NotificationBell />
          </div>


          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 border border-[#5e5b5b] hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200">
                <div className="relative">
                  <Avatar className="h-10 w-10 border-2 border-white dark:border-gray-900 relative">
                    <AvatarImage src={user.profilePhoto} alt={user.name} className="object-cover" />
                    <AvatarFallback className="bg-blue-600 text-white font-semibold text-sm">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900"></div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 border-2 border-[#5e5b5b] shadow-2xl" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-blue-200 dark:border-blue-800">
                    <AvatarImage src={user.profilePhoto} alt={user.name} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-1 flex-1">
                    <p className="text-sm font-semibold leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    <Badge className="w-fit mt-1 text-xs bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-md">
                      {t.roles[user.role]}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-0" />
              <DropdownMenuItem onClick={() => navigate(`/${user.role}/profile`)} className="cursor-pointer py-3 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-medium">{t.common.profile}</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-0" />
              <DropdownMenuItem onClick={handleLogoutClick} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {t.common.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 w-full overflow-hidden transition-all duration-500">
        {/* Sidebar */}
        <aside
          className={`${sidebarOpen ? 'w-80' : 'w-[72px]'
            } hidden lg:flex flex-shrink-0 flex-col border-r bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl transition-all duration-500 shadow-[20px_0_30px_-15px_rgba(0,0,0,0.05)] overflow-hidden relative z-40`}
        >
          <div className="flex-1 space-y-2 px-2 py-4 overflow-y-auto scrollbar-none transition-all">
            <nav className="space-y-1 focus:outline-none">
              {navigationItems.map((item, index) => {
                const isActive = isNavItemActive(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={!item.path.includes('/chat')}
                    title={!sidebarOpen ? item.label : ''}
                    className={`group relative flex items-center rounded-xl transition-all duration-300 ${sidebarOpen ? 'gap-4 px-2 py-3.5' : 'justify-center w-[56px] h-[56px] mx-auto mb-2'
                      } ${isActive
                        ? 'bg-blue-600 dark:bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/40 font-bold scale-[1.02]'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100 hover:translate-x-1'
                      }`}
                  >
                    {/* Active Glow */}
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl -z-10" />
                    )}

                    {/* Icon Container */}
                    <div className={`relative flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0 transition-all duration-300 ${isActive
                      ? 'bg-white/20 shadow-inner'
                      : 'bg-slate-50 dark:bg-slate-900 group-hover:bg-white dark:group-hover:bg-slate-800 shadow-sm group-hover:shadow-md border border-slate-100 dark:border-slate-800'
                      }`}>
                      <item.icon className={`h-5 w-5 relative z-10 transition-all duration-300 ${isActive
                        ? 'text-white scale-110'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                        }`} />
                      {item.path.includes('/chat') && <ChatNotificationBadge />}

                      {/* Badge for Collapsed State */}
                      {!sidebarOpen && 'badgeCount' in item && item.badgeCount > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-white">{item.badgeCount > 9 ? '9+' : item.badgeCount}</span>
                        </div>
                      )}
                    </div>

                    {/* Label */}
                    {sidebarOpen && (
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="font-bold text-[15px] tracking-tight truncate">
                          {item.label}
                        </span>
                        {/* Notification Badge */}
                        {'badgeCount' in item && item.badgeCount > 0 && (
                          <Badge className="ml-auto bg-red-500 text-white border-0 text-[10px] h-5 min-w-[20px] px-1 flex items-center justify-center font-bold">
                            {item.badgeCount > 9 ? '9+' : item.badgeCount}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Arrow for non-active items */}
                    {sidebarOpen && !isActive && (
                      <ChevronRight className="h-5 w-5 opacity-0 group-hover:opacity-40 transition-all -translate-x-2 group-hover:translate-x-0" />
                    )}
                  </NavLink>
                )
              })}
            </nav>
          </div>

          <div className="flex-shrink-0 px-2 py-3 mb-2 border-t border-slate-100 dark:border-slate-800">
            <div
              onClick={() => navigate(companySlug ? `/${companySlug}/${user.role}/profile` : `/${user.role}/profile`)}
              className={`group flex items-center gap-3 px-2.5 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 cursor-pointer ${!sidebarOpen ? 'justify-center' : ''}`}
            >
              <div className="relative">
                <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-700 shadow-md flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <AvatarImage src={user.profilePhoto} alt={user.name} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm"></div>
              </div>

              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate uppercase tracking-tight leading-none group-hover:text-blue-600 transition-colors">{user.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-700 text-[9px] px-1.5 h-4 border-0 font-black uppercase tracking-widest">
                      {t.roles[user.role]}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>

        </aside>

        {/* Mobile Sidebar */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <aside className="fixed left-0 top-16 bottom-0 w-80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-r shadow-2xl flex flex-col overflow-hidden animate-slide-in">
              <div className="flex-1 space-y-2 px-2 py-4 overflow-y-auto scrollbar-none">
                <nav className="space-y-1.5 focus:outline-none">
                  {navigationItems.map((item) => {
                    const isActive = isNavItemActive(item.path);
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={!item.path.includes('/chat')}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group relative flex items-center gap-4 rounded-2xl px-2 py-3.5 transition-all duration-300 ${isActive
                          ? 'bg-blue-600 dark:bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/40 font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                      >
                        {/* Active Glow */}
                        {isActive && (
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl -z-10" />
                        )}

                        {/* Icon Container */}
                        <div className={`relative flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0 transition-all duration-300 ${isActive
                          ? 'bg-white/20 shadow-inner'
                          : 'bg-slate-50 dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800'
                          }`}>
                          <item.icon className={`h-5 w-5 relative z-10 transition-all duration-300 ${isActive
                            ? 'text-white scale-110'
                            : 'text-slate-400 dark:text-slate-500'
                            }`} />
                          {item.path.includes('/chat') && <ChatNotificationBadge />}
                        </div>

                        <span className="font-bold text-[15px] tracking-tight truncate">{item.label}</span>
                        {'badgeCount' in item && item.badgeCount > 0 && (
                          <Badge className="ml-auto bg-red-500 text-white border-0 text-[10px] h-5 min-w-[20px] px-1 flex items-center justify-center font-bold">
                            {item.badgeCount > 9 ? '9+' : item.badgeCount}
                          </Badge>
                        )}
                      </NavLink>
                    )
                  })}
                </nav>
              </div>

              <div className="flex-shrink-0 px-2 pt-2 mb-4 border-t border-slate-100 dark:border-slate-800">
                <div
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(`/${user.role}/profile`);
                  }}
                  className="flex items-center gap-3.5 p-2 rounded-[1.25rem] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800"
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-700 shadow-md flex-shrink-0">
                      <AvatarImage src={user.profilePhoto} alt={user.name} className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100 truncate uppercase tracking-tight leading-none">{user.name}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Badge className="bg-blue-100 text-blue-700 text-[9px] px-1.5 h-4 border-0 font-black uppercase tracking-widest">
                        {t.roles[user.role]}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

            </aside>
          </div>
        )}

        {/* Main Content */}
        <main
          className={`flex-1 min-w-0 w-full overflow-x-hidden transition-all duration-500 ${location.pathname.includes('/chat')
            ? 'overflow-hidden'
            : 'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent'
            }`}
        >
          <div
            className={
              location.pathname.includes('/chat')
                ? 'h-full w-full flex flex-col'
                : 'w-full animate-fade-in px-4 sm:px-6 py-6 flex flex-col items-center bg-white dark:bg-gray-950'
            }
          >
            <div className="w-full max-w-7xl">
              <Outlet />
            </div>

            {!location.pathname.includes('/chat') && (
              <footer className="mt-auto pt-6 pb-6 text-center border-t border-slate-200 dark:border-slate-800 shrink-0">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  © 2026{' '}
                  <a
                    href="https://shekruweb.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-bold transition-colors"
                  >
                    Shekru Labs India Pvt.Ltd
                  </a>
                </p>
              </footer>
            )}
          </div>
        </main>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout? You will need to login again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogoutConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Deadline Warnings Dialog */}
      <TaskDeadlineWarnings
        isOpen={showDeadlineWarnings}
        onClose={() => setShowDeadlineWarnings(false)}
        userId={user?.id}
      />

      <ScopeSelectorDialog
        open={showScopeDialog}
        onOpenChange={setShowScopeDialog}
      />
    </div>
  );
};

export default MainLayout;