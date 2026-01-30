import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import TaskDeadlineWarnings from '@/components/tasks/TaskDeadlineWarnings';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Settings,
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
  Banknote
} from 'lucide-react';
import { UserRole } from '@/types';
import { Language } from '@/i18n/translations';
import { Badge } from '@/components/ui/badge';
import ChatNotificationBadge from '@/components/chat/ChatNotificationBadge';

const MainLayout: React.FC = () => {
  const { user, logout, showDeadlineWarnings, setShowDeadlineWarnings } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  // Enable navigation guard to handle back/forward button
  useNavigationGuard();

  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutDialog(false);
    logout();
  };

  if (!user) return null;

  const getNavigationItems = () => {
    const commonItems = [
      { icon: Home, label: t.navigation.home, path: `/${user.role}` },
      { icon: Clock, label: t.navigation.attendance, path: `/${user.role}/attendance` },
      { icon: CalendarDays, label: t.navigation.leaves, path: `/${user.role}/leaves` },
      { icon: ClipboardList, label: t.navigation.tasks, path: `/${user.role}/tasks` },
      { icon: Banknote, label: t.navigation.salary, path: '/salary' },
      { icon: MessageCircle, label: t.navigation.chat, path: `/${user.role}/chat` },
    ];

    const roleSpecificItems: Record<UserRole, typeof commonItems> = {
      admin: [
        ...commonItems,
        { icon: Users, label: t.navigation.employees, path: '/admin/employees' },
        { icon: Briefcase, label: t.navigation.departments, path: '/admin/departments' },
        { icon: UserPlus, label: t.navigation.hiring, path: '/admin/hiring' },
        { icon: BarChart3, label: t.navigation.reports, path: '/admin/reports' },
      ],
      hr: [
        ...commonItems,
        { icon: Users, label: t.navigation.employees, path: '/hr/employees' },
        { icon: UserPlus, label: t.navigation.hiring, path: '/hr/hiring' },
        { icon: BarChart3, label: t.navigation.reports, path: '/hr/reports' },
      ],
      manager: [
        ...commonItems,
        { icon: Clock, label: t.navigation.shiftSchedule, path: '/manager/shift-schedule' },
      ],
      team_lead: [
        ...commonItems,
        { icon: Users, label: t.navigation.team, path: '/team_lead/team' },
      ],
      employee: [
        ...commonItems,
        { icon: Users, label: t.navigation.team, path: '/employee/team' },
      ],
    };

    return roleSpecificItems[user.role];
  };

  const navigationItems = getNavigationItems();

  // Custom function to determine if a navigation item should be active
  const isNavItemActive = (itemPath: string) => {
    // For chat routes, consider any path starting with the chat base path as active
    if (itemPath.includes('/chat')) {
      return location.pathname.startsWith(itemPath);
    }
    // For other routes, use exact match
    return location.pathname === itemPath;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-gray-950 shadow-sm">
        <div className="flex h-16 w-full items-center gap-4 px-4 sm:px-6 lg:px-8">
          {/* Sidebar Toggle - Mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Sidebar Toggle - Desktop */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </Button>

          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(`/${user.role}`)}>
            <div className="relative">
              {/* Logo container */}
              <div className="relative h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200">
                <span className="text-white font-bold text-xl tracking-tight">S</span>
              </div>

              {/* Corner accent - orange dot */}
              <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 shadow-sm"></div>
            </div>

            <div className="hidden sm:flex flex-col">
              <span className="font-semibold text-base text-blue-600 dark:text-blue-400 leading-tight">
                Shekru labs India
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                Employee Management
              </span>
            </div>
          </div>

          <div className="flex-1" />

          {/* Language Selector */}
          <Select value={language} onValueChange={(value: Language) => setLanguage(value)}>
            <SelectTrigger className="w-[140px] h-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 rounded-lg">
              <Globe className="h-4 w-4 mr-2 text-gray-600 dark:text-gray-400" />
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

          {/* Notifications */}
          <NotificationBell />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200">
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
            <DropdownMenuContent className="w-64 border-2 shadow-2xl" align="end" forceMount>
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
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-medium">{t.common.profile}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/${user.role}/settings`)} className="cursor-pointer py-3 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <Settings className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-medium">{t.common.settings}</span>
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

      <div className="flex h-[calc(100vh-4rem)] w-full transition-all duration-500">
        {/* Sidebar */}
        <aside
          className={`${sidebarOpen ? 'w-64' : 'w-20'
            } hidden lg:flex flex-shrink-0 flex-col border-r bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl transition-all duration-500 shadow-[20px_0_30px_-15px_rgba(0,0,0,0.05)] overflow-hidden relative z-40`}
        >
          <div className="flex-1 space-y-2 p-3 pt-4 overflow-y-auto scrollbar-none hover:scrollbar-thin transition-all">
            <nav className="space-y-1 focus:outline-none">
              {navigationItems.map((item, index) => {
                const isActive = isNavItemActive(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={!item.path.includes('/chat')}
                    title={!sidebarOpen ? item.label : ''}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${isActive
                      ? 'bg-blue-600 dark:bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/40 font-bold scale-[1.02]'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100 hover:translate-x-1'
                      }`}
                  >
                    {/* Active Glow */}
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl -z-10" />
                    )}

                    {/* Icon Container */}
                    <div className={`relative flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0 transition-all duration-300 ${isActive
                      ? 'bg-white/20 shadow-inner'
                      : 'bg-slate-50 dark:bg-slate-900 group-hover:bg-white dark:group-hover:bg-slate-800 shadow-sm group-hover:shadow-md border border-slate-100 dark:border-slate-800'
                      }`}>
                      <item.icon className={`h-4.5 w-4.5 relative z-10 transition-all duration-300 ${isActive
                        ? 'text-white scale-110'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                        }`} />
                      {item.path.includes('/chat') && <ChatNotificationBadge />}
                    </div>

                    {/* Label */}
                    {sidebarOpen && (
                      <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="font-bold text-[13px] tracking-tight truncate">
                          {item.label}
                        </span>
                      </div>
                    )}

                    {/* Arrow for non-active items */}
                    {sidebarOpen && !isActive && (
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-40 transition-all -translate-x-2 group-hover:translate-x-0" />
                    )}
                  </NavLink>
                )
              })}
            </nav>
          </div>

          <div className="flex-shrink-0 p-3 mb-2 border-t border-slate-100 dark:border-slate-800">
            <div
              onClick={() => navigate(`/${user.role}/profile`)}
              className={`group flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 cursor-pointer ${!sidebarOpen ? 'justify-center' : ''}`}
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
            <aside className="fixed left-0 top-16 bottom-0 w-72 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-r shadow-2xl flex flex-col overflow-hidden animate-slide-in">
              <div className="flex-1 space-y-2 p-4 pt-4 overflow-y-auto scrollbar-none">
                <nav className="space-y-1.5 focus:outline-none">
                  {navigationItems.map((item) => {
                    const isActive = isNavItemActive(item.path);
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={!item.path.includes('/chat')}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group relative flex items-center gap-3.5 rounded-2xl px-3.5 py-3 transition-all duration-300 ${isActive
                          ? 'bg-blue-600 dark:bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/40 font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                      >
                        {/* Active Glow */}
                        {isActive && (
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl -z-10" />
                        )}

                        {/* Icon Container */}
                        <div className={`relative flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0 transition-all duration-300 ${isActive
                          ? 'bg-white/20 shadow-inner'
                          : 'bg-slate-50 dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800'
                          }`}>
                          <item.icon className={`h-5 w-5 relative z-10 transition-all duration-300 ${isActive
                            ? 'text-white scale-110'
                            : 'text-slate-400 dark:text-slate-500'
                            }`} />
                          {item.path.includes('/chat') && <ChatNotificationBadge />}
                        </div>

                        <span className="font-bold text-sm tracking-tight truncate">{item.label}</span>
                      </NavLink>
                    )
                  })}
                </nav>
              </div>

              <div className="flex-shrink-0 p-4 pt-2 mb-4 border-t border-slate-100 dark:border-slate-800">
                <div
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(`/${user.role}/profile`);
                  }}
                  className="flex items-center gap-3.5 p-3 rounded-[1.25rem] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800"
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
          className={`flex-1 min-w-0 w-full overflow-x-hidden transition-all duration-500 ${
            location.pathname.includes('/chat')
              ? 'overflow-hidden'
              : 'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent'
          }`}
        >
          <div
            className={
              location.pathname.includes('/chat')
                ? 'h-full w-full'
                : 'h-full w-full animate-fade-in px-4 py-6 sm:px-6 lg:px-8'
            }
          >
            <Outlet />
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
    </div>
  );
};

export default MainLayout;