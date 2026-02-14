import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Inbox as InboxIcon,
  Send,
  Archive,
  Trash2,
  Star,
  Reply,
  Forward,
  Search,
  Filter,
  Bell,
  Mail,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  Paperclip
} from 'lucide-react';
import { format } from 'date-fns';
import { formatIST, formatDateTimeIST } from '@/utils/timezone';

interface Message {
  id: string;
  from: string;
  fromRole: string;
  to: string;
  subject: string;
  content: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  type: 'message' | 'notification' | 'alert' | 'announcement';
  priority: 'low' | 'medium' | 'high';
  attachments?: string[];
}

export default function Inbox() {
  const { user } = useAuth();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      from: 'HR Department',
      fromRole: 'hr',
      to: 'Admin',
      subject: 'New Employee Onboarding Request',
      content: 'We have 3 new employees joining next Monday. Please review their access permissions and system setup requirements. The onboarding checklist has been attached for your reference.',
      timestamp: new Date(2024, 0, 15, 10, 30),
      read: false,
      starred: true,
      type: 'message',
      priority: 'high',
      attachments: ['onboarding_checklist.pdf']
    },
    {
      id: '2',
      from: 'System',
      fromRole: 'system',
      to: 'Admin',
      subject: 'Monthly Performance Report Available',
      content: 'The monthly performance report for January 2024 is now available. Key highlights include: 95% attendance rate, 87% task completion rate, and 12% increase in productivity.',
      timestamp: new Date(2024, 0, 15, 9, 0),
      read: true,
      starred: false,
      type: 'notification',
      priority: 'medium'
    },
    {
      id: '3',
      from: 'Manager - Sales',
      fromRole: 'manager',
      to: 'Admin',
      subject: 'Leave Policy Clarification',
      content: 'Need clarification on the new leave policy for team leads. Several team members have questions about carry-forward leaves.',
      timestamp: new Date(2024, 0, 14, 16, 45),
      read: true,
      starred: false,
      type: 'message',
      priority: 'low'
    },
    {
      id: '4',
      from: 'System',
      fromRole: 'system',
      to: 'Admin',
      subject: 'Security Alert: Multiple Failed Login Attempts',
      content: 'Detected 5 failed login attempts for user account EMP456. The account has been temporarily locked for security reasons. Please review and take necessary action.',
      timestamp: new Date(2024, 0, 14, 14, 20),
      read: false,
      starred: false,
      type: 'alert',
      priority: 'high'
    },
    {
      id: '5',
      from: 'CEO Office',
      fromRole: 'admin',
      to: 'All',
      subject: 'Company-wide Announcement: Q1 Goals',
      content: 'Dear Team, I am pleased to share our Q1 2024 goals and objectives. We are focusing on improving customer satisfaction, launching new products, and enhancing team collaboration.',
      timestamp: new Date(2024, 0, 13, 11, 0),
      read: true,
      starred: true,
      type: 'announcement',
      priority: 'high'
    }
  ]);

  const handleMarkAsRead = (id: string) => {
    setMessages(messages.map(msg =>
      msg.id === id ? { ...msg, read: true } : msg
    ));
  };

  const handleToggleStar = (id: string) => {
    setMessages(messages.map(msg =>
      msg.id === id ? { ...msg, starred: !msg.starred } : msg
    ));
  };

  const handleDeleteMessage = (id: string) => {
    setMessages(messages.filter(msg => msg.id !== id));
    setSelectedMessage(null);
    toast({
      title: 'Success',
      description: 'Message deleted successfully'
    });
  };

  const handleArchiveMessage = (id: string) => {
    // In a real app, this would move to archive
    setMessages(messages.filter(msg => msg.id !== id));
    setSelectedMessage(null);
    toast({
      title: 'Success',
      description: 'Message archived successfully'
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'notification': return <Bell className="h-4 w-4" />;
      case 'alert': return <AlertCircle className="h-4 w-4" />;
      case 'announcement': return <MessageSquare className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'notification': return 'bg-blue-100 text-blue-800';
      case 'alert': return 'bg-red-100 text-red-800';
      case 'announcement': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (priority) {
      case 'high': return 'secondary';
      case 'medium': return 'secondary';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.from.toLowerCase().includes(searchQuery.toLowerCase());

    if (filter === 'all') return matchesSearch;
    if (filter === 'unread') return matchesSearch && !msg.read;
    if (filter === 'starred') return matchesSearch && msg.starred;
    if (filter === 'alerts') return matchesSearch && msg.type === 'alert';
    return matchesSearch;
  });

  const unreadCount = messages.filter(msg => !msg.read).length;

  // Only Admin can access this module
  if (user?.role !== 'admin') {
    return (
      <div className="w-full">
        <Card>
          <CardHeader>
            <CardTitle>Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Only Administrators can access the Inbox module.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-6">
        <InboxIcon className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Inbox</h1>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="ml-2">
            {unreadCount} new
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
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="unread">Unread</TabsTrigger>
                  <TabsTrigger value="starred">Starred</TabsTrigger>
                  <TabsTrigger value="alerts">Alerts</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedMessage?.id === message.id
                      ? 'bg-accent border-primary'
                      : 'hover:bg-accent/50'
                      } ${!message.read ? 'font-semibold' : ''}`}
                    onClick={() => {
                      setSelectedMessage(message);
                      handleMarkAsRead(message.id);
                    }}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(message.type)}
                        <span className="text-sm">{message.from}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStar(message.id);
                        }}
                      >
                        <Star className={`h-4 w-4 ${message.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </Button>
                    </div>
                    <p className="text-sm mb-1">{message.subject}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {format(message.timestamp, 'MMM dd, HH:mm')}
                      </span>
                      <Badge variant={getPriorityColor(message.priority)} className="text-xs">
                        {message.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Details */}
        <Card className="md:col-span-2">
          {selectedMessage ? (
            <>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{selectedMessage.subject}</h2>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{selectedMessage.from.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{selectedMessage.from}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(selectedMessage.timestamp, 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                      <Badge className={getTypeColor(selectedMessage.type)}>
                        {selectedMessage.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Reply className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Forward className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleArchiveMessage(selectedMessage.id)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteMessage(selectedMessage.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap">{selectedMessage.content}</p>
                  </div>

                  {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-2">Attachments</p>
                      <div className="space-y-2">
                        {selectedMessage.attachments.map((attachment, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 border rounded">
                            <Paperclip className="h-4 w-4" />
                            <span className="text-sm">{attachment}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-full">
              <div className="text-center">
                <InboxIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Select a message to view</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}