import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, X, Clock, AlertCircle, CheckCircle, FileText, Calendar, Loader2, RefreshCw } from 'lucide-react';
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
import { formatDistanceToNowIST } from '@/utils/timezone';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, unreadCount, isLoading, error, markAsRead, markAllAsRead, clearNotification, refreshNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  // Fetch notifications immediately on mount (app load)
  useEffect(() => {
    // Fetch on initial mount
    refreshNotifications();
  }, []); // Empty dependency - only run once on mount
  
  // Refresh notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      refreshNotifications();
    }
  }, [isOpen, refreshNotifications]);
  
  // Debug: Log notifications state
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[NotificationBell] Notifications:', notifications);
      console.log('[NotificationBell] Unread count:', unreadCount);
    }
  }, [notifications, unreadCount]);
  
  // Check if notifications are enabled
  const areNotificationsEnabled = () => {
    const stored = localStorage.getItem('notificationsEnabled');
    return stored === null ? true : stored === 'true';
  };
  
  // Don't render the bell if notifications are disabled
  if (!areNotificationsEnabled()) {
    return null;
  }
  
  // Show ALL notifications, not just unread - sorted by created_at (latest first)
  const allNotifications = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  // Group notifications by type
  const leaveNotifications = allNotifications.filter(n => n.type === 'leave');
  const taskNotifications = allNotifications.filter(n => n.type === 'task');
  const shiftNotifications = allNotifications.filter(n => n.type === 'shift');
  const otherNotifications = allNotifications.filter(n => !['leave', 'task', 'shift'].includes(n.type));

  const handleNotificationClick = async (notification: any) => {
    // Mark as read and wait for it to complete
    await markAsRead(notification.id);
    
    const userRole = user?.role || 'employee';
    
    // Route based on notification type and metadata
    if (notification.type === 'leave' && notification.metadata?.leaveId) {
      // For leave notifications, go to role-based leaves page with approvals tab
      navigate(`/${userRole}/leaves?tab=approvals&leaveId=${notification.metadata.leaveId}`);
      setIsOpen(false);
    } else if (notification.type === 'task' && notification.metadata?.taskId) {
      // For task notifications, go to role-based tasks page with taskId
      navigate(`/${userRole}/tasks?taskId=${notification.metadata.taskId}`);
      setIsOpen(false);
    } else if (notification.type === 'shift') {
      // For shift notifications, redirect to Team page
      if (notification.actionUrl) {
        navigate(notification.actionUrl);
      } else {
        // Fallback based on role
        if (userRole === 'team_lead') {
          navigate('/team_lead/team');
        } else {
          navigate('/employee/team');
        }
      }
      setIsOpen(false);
    } else if (notification.actionUrl) {
      // Fallback to actionUrl if provided
      navigate(notification.actionUrl);
      setIsOpen(false);
    } else {
      // For info/warning notifications without specific routing, go to dashboard
      navigate(`/${userRole}/dashboard`);
      setIsOpen(false);
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
      case 'warning':
        return 'bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500';
      default:
        return 'bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500';
    }
  };

  const NotificationItem = ({ notification }: { notification: any }) => (
    <div
      className={`p-4 hover:bg-opacity-75 dark:hover:bg-opacity-30 cursor-pointer transition-all duration-200 hover:scale-[1.01] ${getNotificationBgColor(notification.type)} ${notification.read ? 'opacity-60' : ''}`}
      onClick={() => handleNotificationClick(notification)}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-1">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm line-clamp-1 ${notification.read ? 'font-normal' : 'font-semibold'}`}>
              {notification.title}
            </p>
            {!notification.read && (
              <Badge className="h-5 text-[10px] px-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-md flex-shrink-0">
                NEW
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {notification.message}
          </p>
          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-muted-foreground">
              {(() => {
                try {
                  return formatDistanceToNowIST(notification.createdAt);
                } catch (error) {
                  console.error('Error formatting notification time:', error);
                  return 'Just now';
                }
              })()}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 transition-all rounded-md flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                clearNotification(notification.id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-10 w-10 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-300 hover:scale-110"
        >
          <Bell className={`h-5 w-5 text-blue-600 dark:text-blue-400 ${unreadCount > 0 ? 'animate-shake' : ''}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-[10px] font-bold text-white flex items-center justify-center animate-pulse shadow-lg border-2 border-white dark:border-gray-900">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[420px] max-h-[600px] bg-background z-50 border-2 shadow-2xl p-0">
        <div className="flex items-center justify-between p-4 border-b-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <h3 className="font-bold text-lg">Notifications</h3>
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshNotifications()}
              disabled={isLoading}
              className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
              title="Refresh notifications"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all
              </Button>
            )}
          </div>
        </div>
        
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900 dark:to-orange-900 flex items-center justify-center mb-4">
              <AlertCircle className="h-10 w-10 text-red-400 dark:text-red-600" />
            </div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">Unable to load notifications</p>
            <p className="text-xs text-muted-foreground mt-1">Please try again</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshNotifications()}
              className="mt-4"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Retry
            </Button>
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
            <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
              <TabsTrigger 
                value="all" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-4 py-2"
              >
                <span className="text-xs font-medium">All</span>
                {allNotifications.length > 0 && (
                  <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-gray-500 text-white">
                    {allNotifications.length}
                  </Badge>
                )}
                {unreadCount > 0 && (
                  <Badge className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-red-500 text-white">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              
              {leaveNotifications.length > 0 && (
                <TabsTrigger 
                  value="leave" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent px-4 py-2"
                >
                  <Calendar className="h-4 w-4 mr-1 text-purple-500" />
                  <span className="text-xs font-medium">Leave</span>
                  <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-purple-500 text-white">
                    {leaveNotifications.length}
                  </Badge>
                </TabsTrigger>
              )}
              
              {taskNotifications.length > 0 && (
                <TabsTrigger 
                  value="task" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent px-4 py-2"
                >
                  <FileText className="h-4 w-4 mr-1 text-blue-500" />
                  <span className="text-xs font-medium">Tasks</span>
                  <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-blue-500 text-white">
                    {taskNotifications.length}
                  </Badge>
                </TabsTrigger>
              )}
              
              {shiftNotifications.length > 0 && (
                <TabsTrigger 
                  value="shift" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent px-4 py-2"
                >
                  <Clock className="h-4 w-4 mr-1 text-orange-500" />
                  <span className="text-xs font-medium">Shifts</span>
                  <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-orange-500 text-white">
                    {shiftNotifications.length}
                  </Badge>
                </TabsTrigger>
              )}
              
              {otherNotifications.length > 0 && (
                <TabsTrigger 
                  value="other" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-green-500 data-[state=active]:bg-transparent px-4 py-2"
                >
                  <span className="text-xs font-medium">Other</span>
                  <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-green-500 text-white">
                    {otherNotifications.length}
                  </Badge>
                </TabsTrigger>
              )}
            </TabsList>

            <ScrollArea className="h-[400px]">
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

              <TabsContent value="task" className="m-0 divide-y">
                {taskNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No task notifications</p>
                  </div>
                ) : (
                  taskNotifications.map((notification) => (
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

              <TabsContent value="other" className="m-0 divide-y">
                {otherNotifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">No other notifications</p>
                  </div>
                ) : (
                  otherNotifications.map((notification) => (
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
