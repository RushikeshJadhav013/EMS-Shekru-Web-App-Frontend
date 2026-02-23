import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications, Notification } from '@/contexts/NotificationContext';
import {
  Inbox as InboxIcon,
  Archive,
  Trash2,
  Reply,
  Forward,
  Search,
  Bell,
  Mail,
  MessageSquare,
  AlertCircle,
  FileText,
  Calendar,
  Clock,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { formatIST } from '@/utils/timezone';

// Note: Using Notification interface from NotificationContext

export default function Inbox() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, isLoading, markAsRead, clearNotification } = useNotifications();
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  // apply user search/tabs
  const displayNotifications = notifications
    .filter(n => {
      const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase());

      if (filter === 'all') return matchesSearch;
      if (filter === 'unread') return matchesSearch && !n.read;
      if (filter === 'important') return matchesSearch && (n.type === 'warning' || n.type === 'task');
      return matchesSearch;
    });

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleDeleteNotification = (id: string) => {
    clearNotification(id);
    if (selectedNotification?.id === id) {
      setSelectedNotification(null);
    }
  };

  const handleAction = (notification: Notification) => {
    const userRole = user?.role || 'employee';
    if (notification.type === 'leave' && notification.metadata?.leaveId) {
      navigate(`/${userRole}/leaves?tab=approvals&leaveId=${notification.metadata.leaveId}`);
    } else if (notification.type === 'task' && notification.metadata?.taskId) {
      navigate(`/${userRole}/tasks?taskId=${notification.metadata.taskId}`);
    } else if (notification.type === 'shift' && notification.actionUrl) {
      navigate(notification.actionUrl);
    } else if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'leave': return <Calendar className="h-4 w-4" />;
      case 'task': return <FileText className="h-4 w-4" />;
      case 'shift': return <Clock className="h-4 w-4" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'leave': return 'bg-purple-100 text-purple-800';
      case 'task': return 'bg-blue-100 text-blue-800';
      case 'shift': return 'bg-orange-100 text-orange-800';
      case 'warning': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const unreadCount = displayNotifications.filter(n => !n.read).length;

  // Removed role restriction as requested for all profiles

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Bell className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Notifications</h1>
            <p className="text-sm text-muted-foreground">Stay updated with your latest system alerts and tasks</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="h-6 px-3 rounded-full animate-pulse">
            {unreadCount} UNREAD
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Message List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs value={filter} onValueChange={setFilter}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="unread">Unread</TabsTrigger>
                  <TabsTrigger value="important">Important</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : displayNotifications.length === 0 ? (
                  <div className="text-center py-20">
                    <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                    <p className="text-muted-foreground">No notifications found</p>
                  </div>
                ) : (
                  displayNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer group ${selectedNotification?.id === notification.id
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
                        : 'hover:bg-slate-50 border-transparent dark:hover:bg-slate-900'
                        } ${!notification.read ? 'bg-white dark:bg-slate-900 shadow-sm border-blue-100 dark:border-blue-900/50' : 'opacity-70'}`}
                      onClick={() => {
                        setSelectedNotification(notification);
                        handleMarkAsRead(notification.id);
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${getTypeColor(notification.type)} bg-opacity-10`}>
                            {getTypeIcon(notification.type)}
                          </div>
                          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                            {notification.type}
                          </Badge>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                        )}
                      </div>
                      <h4 className={`text-sm mb-1 line-clamp-1 ${!notification.read ? 'font-bold' : 'font-medium'}`}>
                        {notification.title}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-bold">
                        <span>{formatIST(notification.createdAt, 'MMM dd, HH:mm')}</span>
                        {notification.actionUrl && (
                          <span className="text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            View <ChevronRight className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Details */}
        <Card className="md:col-span-2 overflow-hidden border-0 shadow-xl bg-white dark:bg-slate-900">
          {selectedNotification ? (
            <>
              <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className={getTypeColor(selectedNotification.type)}>
                        {selectedNotification.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-medium">
                        {formatIST(selectedNotification.createdAt, 'MMMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {selectedNotification.title}
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteNotification(selectedNotification.id)}
                      className="h-9 w-9 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="space-y-8">
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 leading-relaxed text-slate-700 dark:text-slate-300">
                      {selectedNotification.message}
                    </div>
                  </div>

                  {(selectedNotification.actionUrl || (selectedNotification.type === 'leave' && selectedNotification.metadata?.leaveId) || (selectedNotification.type === 'task' && selectedNotification.metadata?.taskId)) && (
                    <div className="flex justify-end pt-4">
                      <Button
                        onClick={() => handleAction(selectedNotification)}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-6 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all duration-300"
                      >
                        {selectedNotification.type === 'task' ? 'Go to Task' :
                          selectedNotification.type === 'leave' ? 'View Leave' :
                            'View Details'}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center min-h-[500px] text-center p-8">
              <div className="h-24 w-24 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6">
                <InboxIcon className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Select a notification</h3>
              <p className="text-slate-500 max-w-xs">Choose a notification from the list to view its full details and take action.</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}