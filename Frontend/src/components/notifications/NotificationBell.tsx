import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Check, X, Clock, AlertCircle, CheckCircle, FileText, Calendar, Loader2, IndianRupee, Home, Video, MessageSquare, Briefcase, UserPlus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatBackendDateIST } from '@/utils/timezone';
import TruncatedText from '@/components/ui/TruncatedText';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useDesktopNotification } from '@/hooks/useDesktopNotification';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, unreadCount, isLoading, error, markAsRead, markAllAsRead, clearNotification, unlockAudioContext } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const { soundEnabled, toggleSound } = useNotificationSound();
  const { requestPermission } = useDesktopNotification();
  const hasUnlockedRef = useRef(false);

  // ✅ REMOVED: No more API calls from UI component
  // Notifications are fetched ONLY from NotificationContext on:
  // 1. App initialization (user login)
  // 2. Page visibility change (when tab becomes visible)

  // Debug: Log notifications state (only in dev)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[NotificationBell] Notifications count:', notifications.length);
      console.log('[NotificationBell] Unread count:', unreadCount);
    }
  }, [notifications.length, unreadCount]);

  // Unlock AudioContext and request desktop notification permission on first open
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !hasUnlockedRef.current) {
      hasUnlockedRef.current = true;
      unlockAudioContext();
      // Lazily request desktop notification permission
      requestPermission().catch(() => {/* ignore */ });
    }
  };

  // Check if notifications are enabled
  const areNotificationsEnabled = () => {
    const stored = localStorage.getItem('notificationsEnabled');
    return stored === null ? true : stored === 'true';
  };

  // Don't render the bell if notifications are disabled
  if (!areNotificationsEnabled()) {
    return null;
  }

  // Show ONLY unread notifications - sorted by date (newest first)
  const allNotifications = notifications
    .filter(n => !n.read)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Group notifications by type (maintaining sort order)
  const leaveNotifications = allNotifications.filter(n => n.type === 'leave');
  const taskNotifications = allNotifications.filter(n => n.type === 'task');
  const shiftNotifications = allNotifications.filter(n => n.type === 'shift');
  const wfhNotifications = allNotifications.filter(n => n.type === 'wfh');
  const meetingNotifications = allNotifications.filter(n => n.type === 'meeting');
  const chatNotifications = allNotifications.filter(n => n.type === 'chat');
  const attendanceNotifications = allNotifications.filter(n => n.type === 'attendance');
  const hiringNotifications = allNotifications.filter(n => n.type === 'hiring');
  const projectNotifications = allNotifications.filter(n => n.type === 'project');
  const salaryNotifications = allNotifications.filter(n => n.type === 'salary');
  const otherNotifications = allNotifications.filter(n => !['leave', 'task', 'shift', 'wfh', 'meeting', 'chat', 'attendance', 'hiring', 'project', 'salary'].includes(n.type));

  const handleNotificationClick = async (notification: any) => {
    // Only mark as read, don't clear (remove) and don't navigate
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'leave':
        return <Calendar className="h-5 w-5 text-purple-500" />;
      case 'task':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'shift':
        return <Clock className="h-5 w-5 text-orange-500" />;
      case 'wfh':
        return <Home className="h-5 w-5 text-teal-500" />;
      case 'meeting':
        return <Video className="h-5 w-5 text-indigo-500" />;
      case 'chat':
        return <MessageSquare className="h-5 w-5 text-emerald-500" />;
      case 'attendance':
        return <UserCheck className="h-5 w-5 text-green-600" />;
      case 'hiring':
        return <UserPlus className="h-5 w-5 text-pink-500" />;
      case 'project':
        return <Briefcase className="h-5 w-5 text-cyan-600" />;
      case 'salary':
        return <IndianRupee className="h-5 w-5 text-gold-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  const getNotificationBgColor = (type: string) => {
    switch (type) {
      case 'leave':
        return 'bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500';
      case 'task':
        return 'bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500';
      case 'shift':
        return 'bg-orange-50 dark:bg-orange-950/20 border-l-4 border-orange-500';
      case 'wfh':
        return 'bg-teal-50 dark:bg-teal-950/20 border-l-4 border-teal-500';
      case 'meeting':
        return 'bg-indigo-50 dark:bg-indigo-950/20 border-l-4 border-indigo-500';
      case 'chat':
        return 'bg-emerald-50 dark:bg-emerald-950/20 border-l-4 border-emerald-500';
      case 'attendance':
        return 'bg-green-50 dark:bg-green-950/20 border-l-4 border-green-600';
      case 'hiring':
        return 'bg-pink-50 dark:bg-pink-950/20 border-l-4 border-pink-500';
      case 'project':
        return 'bg-cyan-50 dark:bg-cyan-950/20 border-l-4 border-cyan-600';
      case 'salary':
        return 'bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-500';
      case 'warning':
        return 'bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500';
      default:
        return 'bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500';
    }
  };

  const getModuleLabel = (type: string) => {
    switch (type) {
      case 'leave':
        return 'Leave';
      case 'task':
        return 'Task';
      case 'shift':
        return 'Shift';
      case 'wfh':
        return 'WFH';
      case 'meeting':
        return 'Meeting';
      case 'chat':
        return 'Chat';
      case 'attendance':
        return 'Attendance';
      case 'hiring':
        return 'Hiring';
      case 'project':
        return 'Project';
      case 'salary':
        return 'Salary';
      default:
        return 'Other';
    }
  };

  const NotificationItem = ({ notification }: { notification: any }) => (
    <div
      className={`p-4 hover:bg-opacity-75 dark:hover:bg-opacity-30 cursor-pointer transition-all duration-200 hover:scale-[1.01] ${getNotificationBgColor(notification.type)} ${notification.read ? 'opacity-70' : 'opacity-100'}`}
      onClick={() => handleNotificationClick(notification)}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className={`text-sm leading-tight ${notification.read ? 'font-normal text-muted-foreground' : 'font-semibold text-foreground'}`}>
              <TruncatedText
                text={notification.title || 'Notification'}
                maxLength={60}
                showToggle={true}
              />
            </div>
            {!notification.read && (
              <Badge className="h-5 text-[10px] px-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-md flex-shrink-0 animate-pulse">
                NEW
              </Badge>
            )}
          </div>
          {notification.message && (
            <div className="text-xs text-muted-foreground leading-relaxed">
              <TruncatedText
                text={notification.message}
                maxLength={100}
                showToggle={true}
              />
            </div>
          )}
          <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700 dark:text-slate-300">
                {getModuleLabel(notification.type)}
              </span>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                {(() => {
                  try {
                    if (notification.createdAt) {
                      return formatBackendDateIST(notification.createdAt, 'MMM dd, yyyy HH:mm');
                    }
                    return 'Just now';
                  } catch (error) {
                    console.error('Error formatting notification time:', error);
                    return 'Just now';
                  }
                })()}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900 transition-all rounded-md flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    markAsRead(notification.id);
                  }}
                  title="Mark as read"
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 transition-all rounded-md flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  clearNotification(notification.id);
                }}
                title="Remove notification"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-lg border border-[#5e5b5b] hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-300 hover:scale-110"
        >
          <Bell className={`h-5 w-5 text-blue-600 dark:text-blue-400 ${unreadCount > 0 ? 'animate-shake' : ''}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-[10px] font-bold text-white flex items-center justify-center animate-pulse shadow-lg border-2 border-white dark:border-gray-900">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[420px] max-h-[600px] bg-background z-50 border-2 border-[#5e5b5b] shadow-2xl p-0">
        <div className="flex flex-col p-4 border-b-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                <Bell className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-bold text-lg">Notifications</h3>
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}
            </div>
            {/* Sound toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSound}
              className="h-8 w-8 rounded-lg hover:bg-white/60 dark:hover:bg-white/10 transition-all"
              title={soundEnabled ? 'Disable notification sound' : 'Enable notification sound'}
            >
              {soundEnabled
                ? <Bell className="h-4 w-4 text-blue-600" />
                : <BellOff className="h-4 w-4 text-slate-400" />}
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="flex-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm"
            >
              <Check className="h-3 w-3 mr-1.5" />
              Mark all as read
            </Button>
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900 dark:to-orange-900 flex items-center justify-center mb-4">
              <AlertCircle className="h-10 w-10 text-red-400 dark:text-red-600" />
            </div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">Unable to load notifications</p>
            <p className="text-xs text-muted-foreground mt-1">Please try again later</p>
          </div>
        ) : allNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 flex items-center justify-center mb-4">
              <Bell className="h-10 w-10 text-blue-400 dark:text-blue-600" />
            </div>
            <p className="text-sm font-medium">No notifications found</p>
            <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
          </div>
        ) : (
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="w-full overflow-x-auto scrollbar-hide border-b bg-muted/30">
              <TabsList className="flex w-max min-w-full justify-start rounded-none bg-transparent p-0 h-auto">
                <TabsTrigger
                  value="all"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider">All</span>
                  {allNotifications.length > 0 && (
                    <Badge className="ml-2 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-slate-500 text-white border-0">
                      {allNotifications.length}
                    </Badge>
                  )}
                  {unreadCount > 0 && (
                    <Badge className="ml-1 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-red-600 text-white border-0 shadow-sm animate-pulse">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>

                {leaveNotifications.length > 0 && (
                  <TabsTrigger
                    value="leave"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <Calendar className="h-3.5 w-3.5 mr-2 text-purple-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Leave</span>
                    <Badge className="ml-2 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-purple-500 text-white border-0">
                      {leaveNotifications.length}
                    </Badge>
                  </TabsTrigger>
                )}


                {shiftNotifications.length > 0 && (
                  <TabsTrigger
                    value="shift"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <Clock className="h-3.5 w-3.5 mr-2 text-orange-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Shifts</span>
                    <Badge className="ml-2 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-orange-500 text-white border-0">
                      {shiftNotifications.length}
                    </Badge>
                  </TabsTrigger>
                )}

                {wfhNotifications.length > 0 && (
                  <TabsTrigger
                    value="wfh"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:bg-transparent px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <Home className="h-3.5 w-3.5 mr-2 text-teal-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">WFH</span>
                    <Badge className="ml-2 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-teal-500 text-white border-0">
                      {wfhNotifications.length}
                    </Badge>
                  </TabsTrigger>
                )}

                {meetingNotifications.length > 0 && (
                  <TabsTrigger
                    value="meeting"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <Video className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Meetings</span>
                    <Badge className="ml-2 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-indigo-500 text-white border-0">
                      {meetingNotifications.length}
                    </Badge>
                  </TabsTrigger>
                )}

                {chatNotifications.length > 0 && (
                  <TabsTrigger
                    value="chat"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-2 text-emerald-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Chat</span>
                    <Badge className="ml-2 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-emerald-500 text-white border-0">
                      {chatNotifications.length}
                    </Badge>
                  </TabsTrigger>
                )}

                {attendanceNotifications.length > 0 && (
                  <TabsTrigger
                    value="attendance"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-green-600 data-[state=active]:bg-transparent px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-2 text-green-600" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Attendance</span>
                    <Badge className="ml-2 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-green-600 text-white border-0">
                      {attendanceNotifications.length}
                    </Badge>
                  </TabsTrigger>
                )}

                {hiringNotifications.length > 0 && (
                  <TabsTrigger
                    value="hiring"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-pink-500 data-[state=active]:bg-transparent px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-2 text-pink-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Hiring</span>
                    <Badge className="ml-2 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-pink-500 text-white border-0">
                      {hiringNotifications.length}
                    </Badge>
                  </TabsTrigger>
                )}

                {projectNotifications.length > 0 && (
                  <TabsTrigger
                    value="project"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-600 data-[state=active]:bg-transparent px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <Briefcase className="h-3.5 w-3.5 mr-2 text-cyan-600" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Projects</span>
                    <Badge className="ml-2 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-cyan-600 text-white border-0">
                      {projectNotifications.length}
                    </Badge>
                  </TabsTrigger>
                )}

                {salaryNotifications.length > 0 && (
                  <TabsTrigger
                    value="salary"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-yellow-500 data-[state=active]:bg-transparent px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <IndianRupee className="h-3.5 w-3.5 mr-2 text-yellow-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Salary</span>
                    <Badge className="ml-2 h-5 min-w-[20px] rounded-full p-0 flex items-center justify-center text-[10px] bg-yellow-500 text-white border-0">
                      {salaryNotifications.length}
                    </Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <ScrollArea className="h-[450px] w-full">
              <TabsContent value="all" className="m-0 divide-y">
                {allNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No notifications found</p>
                  </div>
                ) : (
                  allNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="leave" className="m-0 divide-y">
                {leaveNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No leave notifications</p>
                  </div>
                ) : (
                  leaveNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="shift" className="m-0 divide-y">
                {shiftNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No shift notifications</p>
                  </div>
                ) : (
                  shiftNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="wfh" className="m-0 divide-y">
                {wfhNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No WFH notifications</p>
                  </div>
                ) : (
                  wfhNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="meeting" className="m-0 divide-y">
                {meetingNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No meeting notifications</p>
                  </div>
                ) : (
                  meetingNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="chat" className="m-0 divide-y">
                {chatNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No chat notifications</p>
                  </div>
                ) : (
                  chatNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="attendance" className="m-0 divide-y">
                {attendanceNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No attendance notifications</p>
                  </div>
                ) : (
                  attendanceNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="hiring" className="m-0 divide-y">
                {hiringNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No hiring notifications</p>
                  </div>
                ) : (
                  hiringNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="project" className="m-0 divide-y">
                {projectNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No project notifications</p>
                  </div>
                ) : (
                  projectNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="salary" className="m-0 divide-y">
                {salaryNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No salary notifications</p>
                  </div>
                ) : (
                  salaryNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))
                )}
              </TabsContent>

            </ScrollArea>
          </Tabs>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
