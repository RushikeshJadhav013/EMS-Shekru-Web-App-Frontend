import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, MessageCircle } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { chatService } from '@/services/chatService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import AddChatModal from '../../components/chat/AddChatModal';
import DevelopmentModeNotice from '../../components/chat/DevelopmentModeNotice';

const ChatList: React.FC = () => {
  const navigate = useNavigate();
  const { chats, isLoading, setActiveChat, availableUsers } = useChat();
  const { user } = useAuth();
  const { themeMode } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddChatModal, setShowAddChatModal] = useState(false);

  const permissions = user ? chatService.getChatPermissions(user.role) : null;

  // Get theme-aware classes
  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const themeClasses = {
    background: isDark ? 'bg-[#0f172a]' : 'bg-gray-50',
    headerBg: isDark ? 'bg-[#1e293b]' : 'bg-white',
    inputBg: isDark ? 'bg-gray-800' : 'bg-white',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSecondary: isDark ? 'text-gray-400' : 'text-gray-600',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    cardBg: isDark ? 'bg-gray-800/50' : 'bg-white/80',
    hoverBg: isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-100/80',
  };

  // Filter chats based on search term
  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.participants.some(p => 
      p.userName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleChatClick = (chat: any) => {
    console.log('Navigating to chat:', `/${user?.role}/chat/${chat.id}`);
    setActiveChat(chat);
    navigate(`/${user?.role}/chat/${chat.id}`);
  };

  const getLastMessagePreview = (chat: any) => {
    if (!chat.lastMessage) return 'No messages yet';
    
    const content = chat.lastMessage.content;
    return content.length > 50 ? `${content.substring(0, 50)}...` : content;
  };

  const getChatAvatar = (chat: any) => {
    if (chat.type === 'group') {
      return chat.groupAvatar || '';
    }
    
    // For individual chats, show the other participant's avatar
    const otherParticipant = chat.participants.find((p: any) => p.userId !== user?.id);
    if (otherParticipant && availableUsers) {
      // Find the user in availableUsers to get their profile photo
      const userData = availableUsers.find(u => u.id === otherParticipant.userId);
      return userData?.profilePhoto || '';
    }
    return '';
  };

  const getChatName = (chat: any) => {
    if (chat.type === 'group') {
      return chat.name;
    }
    
    // For individual chats, show the other participant's name
    const otherParticipant = chat.participants.find((p: any) => p.userId !== user?.id);
    return otherParticipant?.userName || 'Unknown User';
  };

  if (isLoading || !availableUsers) {
    return (
      <div className={cn("flex items-center justify-center h-64", themeClasses.background)}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
          <p className={cn("font-medium", themeClasses.textSecondary)}>Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-[calc(100vh-4rem)]", themeClasses.background)}>
      {/* Development Mode Notice */}
      <div className="p-4 pb-0">
        <DevelopmentModeNotice />
      </div>
      
      {/* Header */}
      <div className={cn("flex items-center justify-between p-6 border-b shadow-lg", themeClasses.headerBg, themeClasses.border)}>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
            <MessageCircle className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h1 className={cn("text-2xl font-bold", themeClasses.text)}>Chats</h1>
            <p className={cn("text-sm", themeClasses.textSecondary)}>Stay connected with your team</p>
          </div>
        </div>
        <Button
          onClick={() => setShowAddChatModal(true)}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl px-4 py-2 hover:scale-105"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className={cn("absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4", themeClasses.textSecondary)} />
          <Input
            placeholder="Search chats, people, or messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn("pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-inner", 
              themeClasses.inputBg, 
              themeClasses.text,
              isDark ? "border-gray-600 placeholder:text-gray-400" : "border-gray-300 placeholder:text-gray-500")}
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent px-2">
        {filteredChats.length === 0 ? (
          <div className={cn("flex flex-col items-center justify-center h-64 mx-4", themeClasses.textSecondary)}>
            <div className={cn("p-6 rounded-full mb-4 backdrop-blur-sm", themeClasses.cardBg)}>
              <MessageCircle className="h-16 w-16 text-gray-500" />
            </div>
            <p className={cn("text-lg font-semibold mb-2", themeClasses.text)}>No chats found</p>
            <p className={cn("text-sm text-center mb-6", themeClasses.textSecondary)}>Start a conversation by clicking "New Chat" above</p>
            <Button
              onClick={() => setShowAddChatModal(true)}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl px-6 py-3 shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <Plus className="h-4 w-4 mr-2" />
              Start Chatting
            </Button>
          </div>
        ) : (
          <div className="space-y-1 pb-4">
            {filteredChats.map((chat, index) => (
              <div
                key={chat.id}
                onClick={() => handleChatClick(chat)}
                className={cn("flex items-center p-4 mx-2 rounded-xl cursor-pointer transition-all duration-200 group backdrop-blur-sm border border-transparent", 
                  themeClasses.hoverBg,
                  isDark ? "hover:border-gray-700" : "hover:border-gray-300")}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Avatar */}
                <div className="relative">
                  <Avatar className="h-12 w-12 border-2 border-gray-600 shadow-md group-hover:shadow-lg transition-all group-hover:scale-105">
                    <AvatarImage src={getChatAvatar(chat)} />
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold text-base">
                      {chat.type === 'group' ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        getChatName(chat).charAt(0).toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>
                  {chat.type === 'group' ? (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-1 border-2 border-gray-800 shadow-md">
                      <Users className="h-2.5 w-2.5 text-white" />
                    </div>
                  ) : (
                    <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-green-400 border-2 border-gray-800 rounded-full animate-pulse shadow-md"></div>
                  )}
                </div>

                {/* Chat Info */}
                <div className="flex-1 ml-4 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={cn("font-semibold truncate group-hover:text-green-400 transition-colors text-base", themeClasses.text)}>
                      {getChatName(chat)}
                    </h3>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {chat.lastMessage && (
                        <span className={cn("text-xs font-medium", themeClasses.textSecondary)}>
                          {formatDistanceToNow(new Date(chat.lastMessage.timestamp), { addSuffix: true })}
                        </span>
                      )}
                      {chat.unreadCount > 0 && (
                        <Badge className="bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-pulse shadow-lg">
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className={cn("text-sm truncate mb-1 leading-relaxed", themeClasses.textSecondary)}>
                    {getLastMessagePreview(chat)}
                  </p>
                  {chat.type === 'group' && (
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3 text-gray-500" />
                      <p className="text-xs text-gray-500 font-medium">
                        {chat.participants.length} participants
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Chat Modal */}
      <AddChatModal
        isOpen={showAddChatModal}
        onClose={() => setShowAddChatModal(false)}
        permissions={permissions}
      />
    </div>
  );
};

export default ChatList;