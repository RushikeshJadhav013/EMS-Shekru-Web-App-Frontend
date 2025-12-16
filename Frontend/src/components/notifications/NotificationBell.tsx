import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNowIST } from '@/utils/timezone';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  
  // Check if notifications are enabled
  const areNotificationsEnabled = () => {
    const stored = localStorage.getItem('notificationsEnabled');
    return stored === null ? true : stored === 'true';
  };
  
  // Don't render the bell if notifications are disabled
  if (!areNotificationsEnabled()) {
    return null;
  }
  
  // Filter to show only unread notifications
  const unreadNotifications = notifications.filter(n => !n.read);

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
    if (type === 'shift') {
      return <Clock className="h-4 w-4 text-blue-500" />;
    }
    switch (type) {
      case 'leave':
        return '📅';
      case 'task':
        return '📋';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

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
      <DropdownMenuContent align="end" className="w-[380px] max-h-[500px] bg-background z-50 border-2 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <h3 className="font-bold text-lg">Notifications</h3>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {unreadNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 flex items-center justify-center mb-4">
                <Bell className="h-10 w-10 text-blue-400 dark:text-blue-600" />
              </div>
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y">
              {unreadNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                    !notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    <div className="text-2xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <Badge className="h-5 text-[10px] px-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-md">
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
                          className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 transition-all rounded-md"
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
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
