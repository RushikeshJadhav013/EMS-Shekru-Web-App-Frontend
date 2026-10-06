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
  Shield,
  Building2,
  Palette,
  Wallet,
} from 'lucide-react';
import { UserRole } from '@/types';
import { Language } from '@/i18n/translations';
import { Badge } from '@/components/ui/badge';
import ChatNotificationBadge from '@/components/chat/ChatNotificationBadge';
import { useChatSafe } from '@/contexts/ChatContext';
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
  const [companyName] = useState(() => localStorage.getItem('company_name') || '');
  const chatContext = useChatSafe();
  const isLightboxOpen = chatContext?.isLightboxOpen || false;

  useEffect(() => {
    const handleScopeConflict = () => {
      setShowScopeDialog(true);
    };

    window.addEventListener('scope-conflict', handleScopeConflict);
    return () => window.removeEventListener('scope-conflict', handleScopeConflict);
  }, []);

  // Enable navigation guard to handle back/forward button
  useNavigationGuard();

  // Close menus when lightbox is opened
  useEffect(() => {
    if (isLightboxOpen) {
      setSidebarOpen(false);
      setMobileMenuOpen(false);
    }
  }, [isLightboxOpen]);

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
        { icon: Briefcase, label: t.navigation.departments, path: '/admin/branches' },
        { icon: UserPlus, label: t.navigation.hiring, path: '/admin/hiring' },
        { icon: CalendarDays, label: t.navigation.leaves, path: '/admin/leaves', badgeCount: unreadLeavesCount },
        { icon: Wallet, label: t.navigation.expenses || 'Expenses', path: '/expenses' },
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
        { icon: Briefcase, label: t.navigation.departments, path: '/hr/branches' },
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
      teamlead: [
        ...commonItems,
        { icon: Clock, label: t.navigation.shiftSchedule, path: '/team_lead/team', badgeCount: unreadShiftsCount },
        { icon: FolderKanban, label: 'Projects', path: '/team_lead/projects' },
      ],
      staff: [
        ...commonItems,
        { icon: Clock, label: t.navigation.shiftSchedule, path: '/employee/team', badgeCount: unreadShiftsCount },
        { icon: FolderKanban, label: 'Projects', path: '/employee/projects' },
      ],
    };

    const items = roleSpecificItems[user.role] || commonItems;

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
    if (itemPath.includes('/chat') || itemPath.includes('/expenses') || itemPath.includes('/employees') || itemPath.includes('/hiring') || itemPath.includes('/projects') || itemPath.includes('/reports') || itemPath.includes('/branches')) {
      return currentPath.startsWith(itemPath);
    }

    return currentPath === itemPath;
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-200">
      {/* Top Navigation Bar */}
      {!isLightboxOpen && (
        <header className="z-50 w-full border-b border-border bg-card/95 backdrop-blur-md text-card-foreground shadow-sm shrink-0 transition-colors duration-200">
          <div className="relative flex h-16 w-full items-center gap-4 px-4">
            {/* Sidebar Toggle - Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-10 w-10 rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Sidebar Toggle - Desktop */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex h-10 w-10 rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border transition-all duration-200"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo */}
            <div className="flex items-center cursor-pointer group" onClick={() => navigate(companySlug ? `/${companySlug}/${user.role}` : `/${user.role}`)}>
              <Logo
                className="flex items-center gap-2 group-hover:scale-[1.02] transition-transform duration-200"
                iconClassName="h-10 w-10 drop-shadow-sm"
                textClassName="text-2xl font-bold tracking-tight hidden sm:block"
              />
            </div>

            {companyName && (
              <div className="absolute left-1/2 hidden max-w-[60%] -translate-x-1/2 items-center gap-5 lg:gap-6 md:flex px-4">
                {/* Left decorative line with dark black gradient fade & dot */}
                <div className="flex items-center gap-2">
                  <span className="h-[1.5px] w-12 sm:w-16 lg:w-28 bg-gradient-to-r from-transparent via-slate-600 dark:via-slate-400 to-slate-900 dark:to-slate-200 rounded-full" />
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900 dark:bg-slate-200 animate-pulse" />
                </div>

                {/* Center Badge Pill with sharp dark black border */}
                <div className="group relative flex min-w-0 items-center gap-3 rounded-full border-2 border-slate-900 dark:border-slate-200 bg-background/95 dark:bg-slate-900/95 backdrop-blur-md px-5 py-1.5 shadow-md hover:shadow-lg hover:border-black dark:hover:border-white hover:bg-card transition-all duration-300">
                  {/* Subtle hover background glow */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/5 via-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Company Icon Pod */}
                  <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-primary to-indigo-600 text-white shadow-md shadow-primary/25 group-hover:scale-105 transition-transform duration-300">
                    <Building2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 border border-background" />
                    </span>
                  </div>

                  {/* Company Name */}
                  <span className="truncate text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {companyName}
                  </span>

                  {/* Workspace Tag */}
                  <span className="hidden xl:inline-flex items-center rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-900 dark:border-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider transition-all duration-300 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:scale-105 hover:shadow-md hover:shadow-blue-500/25 cursor-default">
                    Workspace
                  </span>
                </div>

                {/* Right decorative line with dark black gradient fade & dot */}
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900 dark:bg-slate-200 animate-pulse" />
                  <span className="h-[1.5px] w-12 sm:w-16 lg:w-28 bg-gradient-to-l from-transparent via-slate-600 dark:via-slate-400 to-slate-900 dark:to-slate-200 rounded-full" />
                </div>
              </div>
            )}

            <div className="flex-1" />

            {/* Notification Bell */}
            <div className="flex items-center">
              <NotificationBell />
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 border border-border hover:bg-muted/80 transition-all duration-200">
                  <div className="relative">
                    <Avatar className="h-10 w-10 border-2 border-primary/30 relative">
                      <AvatarImage src={user.profilePhoto} alt={user.name} className="object-cover" />
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card shadow-sm"></div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 border border-border bg-popover text-popover-foreground shadow-2xl rounded-2xl p-1.5" align="end" forceMount>
                <DropdownMenuLabel className="font-normal p-3 rounded-xl bg-muted/60 mb-1">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 border-2 border-primary/30 shadow-sm">
                      <AvatarImage src={user.profilePhoto} alt={user.name} className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-0.5 flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-none truncate text-foreground">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                      <Badge className="w-fit mt-1 text-[10px] bg-primary text-primary-foreground border-0 shadow-sm font-semibold">
                        {t.roles[user.role]}
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1 bg-border/60" />

                {/* 1. Profile */}
                <DropdownMenuItem
                  onClick={() => navigate(companySlug ? `/${companySlug}/profile` : '/profile')}
                  className="cursor-pointer py-2.5 px-3 rounded-xl hover:bg-accent hover:text-accent-foreground transition-colors font-medium text-sm flex items-center gap-3"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-foreground">{t.common.profile}</span>
                </DropdownMenuItem>

                {/* 2. Theme Settings */}
                <DropdownMenuItem
                  onClick={() => navigate(companySlug ? `/${companySlug}/settings` : '/settings')}
                  className="cursor-pointer py-2.5 px-3 rounded-xl hover:bg-accent hover:text-accent-foreground transition-colors font-medium text-sm flex items-center gap-3"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Palette className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-foreground">Theme Settings</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-border/60" />

                {/* 3. Logout */}
                <DropdownMenuItem
                  onClick={handleLogoutClick}
                  className="cursor-pointer py-2.5 px-3 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors font-medium text-sm flex items-center gap-3"
                >
                  <div className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                    <LogOut className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{t.common.logout}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      )}

      <div className="flex flex-1 w-full overflow-hidden transition-all duration-500">
        {/* Sidebar */}
        {!isLightboxOpen && (
          <aside
            className={`${sidebarOpen ? 'w-80' : 'w-[72px]'
              } hidden lg:flex flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground backdrop-blur-xl transition-all duration-300 shadow-[20px_0_30px_-15px_rgba(0,0,0,0.05)] overflow-hidden relative z-40`}
          >
            <div className="flex-1 space-y-2 px-2 py-4 overflow-y-auto scrollbar-none transition-all">
              <nav className="space-y-1 focus:outline-none">
                {navigationItems.map((item) => {
                  const isActive = isNavItemActive(item.path);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={!item.path.includes('/chat')}
                      title={!sidebarOpen ? item.label : ''}
                      className={`group relative flex items-center rounded-xl transition-all duration-300 ${sidebarOpen ? 'gap-4 px-2 py-3.5' : 'justify-center w-[56px] h-[56px] mx-auto mb-2'
                        } ${isActive
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-bold scale-[1.02]'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-1'
                        }`}
                    >
                      {/* Active Glow */}
                      {isActive && (
                        <div className="absolute inset-0 bg-primary rounded-xl -z-10" />
                      )}

                      {/* Icon Container */}
                      <div className={`relative flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0 transition-all duration-300 ${isActive
                        ? 'bg-white/20 shadow-inner text-primary-foreground'
                        : 'bg-sidebar-accent/60 group-hover:bg-sidebar-accent text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground shadow-sm group-hover:shadow-md border border-sidebar-border/50'
                        }`}>
                        <item.icon className={`h-5 w-5 relative z-10 transition-all duration-300 ${isActive
                          ? 'text-primary-foreground scale-110'
                          : 'text-sidebar-foreground/70 group-hover:text-primary'
                          }`} />
                        {item.path.includes('/chat') && <ChatNotificationBadge />}

                        {/* Badge for Collapsed State */}
                        {!sidebarOpen && 'badgeCount' in item && item.badgeCount > 0 && (
                          <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-destructive rounded-full border-2 border-sidebar flex items-center justify-center">
                            <span className="text-[10px] font-bold text-destructive-foreground">{item.badgeCount > 9 ? '9+' : item.badgeCount}</span>
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
                            <Badge className="ml-auto bg-destructive text-destructive-foreground border-0 text-[10px] h-5 min-w-[20px] px-1 flex items-center justify-center font-bold">
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

            <div className="flex-shrink-0 px-2 py-3 mb-2 border-t border-sidebar-border">
              <div
                onClick={() => navigate(companySlug ? `/${companySlug}/profile` : '/profile')}
                className={`group flex items-center gap-3 px-2.5 py-3 rounded-xl bg-sidebar-accent/50 hover:bg-sidebar-accent border border-sidebar-border hover:shadow-md transition-all duration-300 cursor-pointer ${!sidebarOpen ? 'justify-center' : ''}`}
              >
                <div className="relative">
                  <Avatar className="h-9 w-9 border-2 border-primary/30 shadow-md flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <AvatarImage src={user.profilePhoto} alt={user.name} className="object-cover" />
                    <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-sidebar shadow-sm"></div>
                </div>

                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-sidebar-foreground truncate uppercase tracking-tight leading-none group-hover:text-primary transition-colors">{user.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge className="bg-primary/10 hover:bg-primary/15 text-primary text-[9px] px-1.5 h-4 border-0 font-black uppercase tracking-widest">
                        {t.roles[user.role]}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </aside>
        )}

        {/* Mobile Sidebar */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <aside className="fixed left-0 top-16 bottom-0 w-80 bg-sidebar text-sidebar-foreground backdrop-blur-xl border-r border-sidebar-border shadow-2xl flex flex-col overflow-hidden animate-slide-in">
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
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-bold'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          }`}
                      >
                        {/* Active Glow */}
                        {isActive && (
                          <div className="absolute inset-0 bg-primary rounded-2xl -z-10" />
                        )}

                        {/* Icon Container */}
                        <div className={`relative flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0 transition-all duration-300 ${isActive
                          ? 'bg-white/20 shadow-inner text-primary-foreground'
                          : 'bg-sidebar-accent/60 shadow-sm border border-sidebar-border/50 text-sidebar-foreground/70'
                          }`}>
                          <item.icon className={`h-5 w-5 relative z-10 transition-all duration-300 ${isActive
                            ? 'text-primary-foreground scale-110'
                            : 'text-sidebar-foreground/70'
                            }`} />
                          {item.path.includes('/chat') && <ChatNotificationBadge />}
                        </div>

                        <span className="font-bold text-[15px] tracking-tight truncate">{item.label}</span>
                        {'badgeCount' in item && item.badgeCount > 0 && (
                          <Badge className="ml-auto bg-destructive text-destructive-foreground border-0 text-[10px] h-5 min-w-[20px] px-1 flex items-center justify-center font-bold">
                            {item.badgeCount > 9 ? '9+' : item.badgeCount}
                          </Badge>
                        )}
                      </NavLink>
                    )
                  })}
                </nav>
              </div>

              <div className="flex-shrink-0 px-2 pt-2 mb-4 border-t border-sidebar-border">
                <div
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(companySlug ? `/${companySlug}/profile` : '/profile');
                  }}
                  className="flex items-center gap-3.5 p-2 rounded-[1.25rem] bg-sidebar-accent/50 border border-sidebar-border"
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10 border-2 border-primary/30 shadow-md flex-shrink-0">
                      <AvatarImage src={user.profilePhoto} alt={user.name} className="object-cover" />
                      <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-sidebar shadow-sm"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-sidebar-foreground truncate uppercase tracking-tight leading-none">{user.name}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Badge className="bg-primary/10 text-primary text-[9px] px-1.5 h-4 border-0 font-black uppercase tracking-widest">
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
            : 'overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent'
            }`}
        >
          <div
            className={
              location.pathname.includes('/chat')
                ? 'h-full w-full flex flex-col'
                : 'w-full animate-fade-in px-4 sm:px-6 py-6 flex flex-col items-center bg-background text-foreground min-h-full transition-colors duration-200'
            }
          >
            <div className="w-full max-w-7xl">
              <Outlet />
            </div>

            {!location.pathname.includes('/chat') && (
              <footer className="mt-auto pt-6 pb-6 text-center border-t border-border shrink-0 w-full max-w-7xl">
                <p className="text-sm text-muted-foreground font-medium">
                  © 2026{' '}
                  <a
                    href="https://shekruweb.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-bold transition-colors"
                  >
                    Shekru Labs India Pvt.Ltd.
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