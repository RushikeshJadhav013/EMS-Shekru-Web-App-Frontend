import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Users, MessageCircle, Settings2 } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { chatService } from '@/services/chatService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatChatTimestampIST } from '@/utils/timezone';
import { cn } from '@/lib/utils';
import AddChatModal from '../../components/chat/AddChatModal';
import ChatTypeSelectorModal from '../../components/chat/ChatTypeSelectorModal';

const ChatList: React.FC = () => {
  const navigate = useNavigate();
  const { chatId: activeChatId } = useParams();
  const { chats, isLoading, setActiveChat, availableUsers } = useChat();
  const { user } = useAuth();
  const { themeMode } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddChatModal, setShowAddChatModal] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedType, setSelectedType] = useState<'individual' | 'group'>('individual');
  const [filter, setFilter] = useState<'all' | 'individual' | 'group'>('all');

  const permissions = user ? chatService.getChatPermissions(user.role) : null;
  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const themeClasses = {
    background: isDark ? 'bg-[#0a1628]' : 'bg-white',
    headerBg: isDark ? 'bg-[#0f172a]' : 'bg-gray-50/50',
    inputBg: isDark ? 'bg-gray-800/50' : 'bg-gray-100/50',
    text: isDark ? 'text-slate-100' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-500',
    border: isDark ? 'border-slate-800' : 'border-slate-100',
    activeBg: isDark ? 'bg-green-500/10' : 'bg-green-50',
    activeBorder: 'border-green-500/50',
  };

  const getChatName = (chat: any) => {
    if (chat.name && chat.name !== 'string' && chat.name !== 'null') return chat.name;
    if (chat.type === 'individual' || !chat.name) {
      const currentUserId = user?.id?.toString();
      const otherParticipant = chat.participants?.find((p: any) => p.userId?.toString() !== currentUserId);
      if (otherParticipant) {
        // Try to find in availableUsers
        const userDetails = availableUsers?.find(u => u.id?.toString() === otherParticipant.userId?.toString());
        if (userDetails?.name) return userDetails.name;

        // Fallback to participant userName if it exists
        if (otherParticipant.userName && otherParticipant.userName !== 'string') return otherParticipant.userName;

        // Final fallback: Use part of ID or "User {id}" to be more specific than "Chat User"
        return `User ${otherParticipant.userId}`;
      }
    }
    return chat.type === 'group' ? (chat.name || 'Group Chat') : 'Chat User';
  };

  const getChatAvatar = (chat: any) => {
    if (chat.type === 'group') return chat.groupAvatar || '';
    const currentUserId = user?.id?.toString();
    const otherParticipant = chat.participants?.find((p: any) => p.userId?.toString() !== currentUserId);
    if (otherParticipant && availableUsers) {
      const userData = availableUsers.find(u => u.id?.toString() === otherParticipant.userId?.toString());
      return userData?.profilePhoto || '';
    }
    return '';
  };

  // Show all chats from API without de-duplication - sorted by most recent
  const filteredChats = useMemo(() => {
    // Sort chats by updatedAt (most recent first)
    const sortedChats = [...chats].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    return sortedChats.filter(chat => {
      // Type filter
      if (filter !== 'all' && chat.type !== filter) return false;

      // Search filter
      const name = getChatName(chat).toLowerCase();
      return name.includes(searchTerm.toLowerCase());
    });
  }, [chats, searchTerm, availableUsers, user, filter]);

  // Calculate counts directly from API response - no de-duplication
  const chatCounts = useMemo(() => {
    let individualCount = 0;
    let groupCount = 0;

    chats.forEach(chat => {
      if (chat.type === 'individual') {
        individualCount++;
      } else if (chat.type === 'group') {
        groupCount++;
      }
    });

    return {
      all: chats.length,
      individual: individualCount,
      group: groupCount
    };
  }, [chats]);

  const handleChatClick = (chat: any) => {
    setActiveChat(chat);
    navigate(`/${user?.role}/chat/${chat.id}`);
  };

  const getLastMessagePreview = (chat: any) => {
    if (!chat.lastMessage) return 'No messages yet';
    
    // If content is empty, show a placeholder
    const content = chat.lastMessage.content;
    if (!content || content.trim() === '') return 'No messages yet';

    let senderName = '';
    if (chat.type === 'group') {
      const isOwn = chat.lastMessage.senderId?.toString() === user?.id?.toString();
      if (isOwn) {
        senderName = 'You: ';
      } else {
        const senderId = chat.lastMessage.senderId?.toString();
        const userDetails = availableUsers?.find(u => u.id?.toString() === senderId);
        const participantDetails = chat.participants?.find((p: any) => p.userId?.toString() === senderId);
        senderName = `${userDetails?.name || participantDetails?.userName || 'Member'}: `;
      }
    }

    const fullPreview = `${senderName}${content}`;
    return fullPreview.length > 65 ? `${fullPreview.substring(0, 65)}...` : fullPreview;
  };

  if (isLoading && chats.length === 0) {
    return (
      <div className="flex flex-col h-full bg-inherit">
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center mb-6">
            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
            <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", themeClasses.background)}>
      {/* Header Area */}
      <div className={cn("p-4 lg:p-5 border-b", themeClasses.headerBg, themeClasses.border)}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-green-500 shadow-lg shadow-green-500/20">
              <MessageCircle className="h-4.5 w-4.5 text-white" />
            </div>
            <h1 className={cn("text-lg font-black tracking-tight", themeClasses.text)}>Messages</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowTypeSelector(true)}
            className="h-9 w-9 rounded-full hover:bg-green-500/10 hover:text-green-500 transition-colors"
          >
            <Plus className="h-4.5 w-4.5" />
          </Button>
        </div>

        <div className="relative group">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors",
            searchTerm ? "text-green-500" : themeClasses.textSecondary)} />
          <Input
            placeholder="Search team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "pl-9 pr-3 py-4.5 rounded-xl border-0 shadow-inner text-xs font-semibold focus-visible:ring-1 focus-visible:ring-green-500/30 transition-all",
              themeClasses.inputBg,
              themeClasses.text
            )}
          />
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 custom-scrollbar-hide no-scrollbar">
          {[
            { id: 'all', label: 'All', icon: MessageCircle, count: chatCounts.all },
            { id: 'individual', label: 'Direct', icon: MessageCircle, count: chatCounts.individual },
            { id: 'group', label: 'Groups', icon: Users, count: chatCounts.group },
          ].map((type) => {
            const Icon = type.icon;
            const isSelected = filter === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setFilter(type.id as any)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 border flex-shrink-0 animate-in fade-in slide-in-from-left-2",
                  isSelected
                    ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20"
                    : isDark
                      ? "bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800/60"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-gray-50"
                )}
              >
                <Icon className={cn("h-3 w-3", isSelected ? "text-white" : "text-green-500")} />
                <span>{type.label}</span>
                {type.count > 0 && (
                  <span className={cn(
                    "ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black",
                    isSelected ? "bg-white/20 text-white" : "bg-green-500/10 text-green-500"
                  )}>
                    {type.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <div className="p-5 rounded-2xl bg-slate-100 dark:bg-slate-800/50 mb-4">
              <Users className="h-10 w-10 text-slate-400" />
            </div>
            <p className={cn("text-sm font-semibold mb-1", themeClasses.text)}>No conversations</p>
            <p className={cn("text-xs leading-relaxed", themeClasses.textSecondary)}>
              Connect with your colleagues to start collaborating.
            </p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = activeChatId === chat.id?.toString();
            return (
              <div
                key={chat.id}
                onClick={() => handleChatClick(chat)}
                className={cn(
                  "flex items-center p-3 rounded-xl cursor-pointer transition-all duration-300 group relative border-transparent border",
                  isActive
                    ? cn(themeClasses.activeBg, themeClasses.activeBorder, "shadow-sm shadow-green-500/5")
                    : "hover:bg-slate-100 dark:hover:bg-slate-800/40"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-green-500 rounded-r-full" />
                )}

                <div className="relative flex-shrink-0">
                  <Avatar className={cn(
                    "h-10 w-10 border transition-transform duration-300 group-hover:scale-105",
                    isActive ? "border-green-500/40" : "border-slate-100 dark:border-slate-800"
                  )}>
                    <AvatarImage src={getChatAvatar(chat)} />
                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white font-black text-xs">
                      {getChatName(chat).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 border rounded-full",
                    isDark ? "border-[#0a1628]" : "border-white",
                    chat.type === 'group' ? "bg-indigo-500" : "bg-green-400"
                  )}>
                    {chat.type === 'group' && <Users className="h-1.5 w-1.5 text-white absolute inset-0 m-auto" />}
                  </div>
                </div>

                <div className="flex-1 ml-3 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className={cn(
                      "font-bold truncate text-[13px] tracking-tight transition-colors",
                      isActive ? "text-green-500" : themeClasses.text
                    )}>
                      {getChatName(chat)}
                    </h3>
                    {chat.lastMessage && (
                      <span className={cn("text-[10px] font-medium opacity-50", themeClasses.textSecondary)}>
                        {formatChatTimestampIST(chat.lastMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={cn("text-[11px] truncate font-medium max-w-[200px] lg:max-w-[280px]",
                      isActive ? "text-slate-500" : themeClasses.textSecondary)}>
                      {getLastMessagePreview(chat)}
                    </p>
                    {chat.unreadCount > 0 && (
                      <Badge className="h-4 min-w-[16px] px-1 bg-green-500 hover:bg-green-600 text-[9px] font-black pointer-events-none">
                        {chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ChatTypeSelectorModal
        isOpen={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onSelect={(type) => {
          setSelectedType(type);
          setShowTypeSelector(false);
          setShowAddChatModal(true);
        }}
        canCreateGroups={permissions?.canCreateGroups || false}
      />

      <AddChatModal
        isOpen={showAddChatModal}
        onClose={() => setShowAddChatModal(false)}
        permissions={permissions}
        initialTab={selectedType}
      />
    </div>
  );
};

export default ChatList;