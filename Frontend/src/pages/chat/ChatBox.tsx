import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Smile,
  Users,
  MessageCircle,
  X,
  Reply,
  MoreVertical,
  Check,
  CheckCheck
} from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDateIST } from '@/utils/timezone';
import { cn } from '@/lib/utils';
import EmojiPicker from '../../components/chat/EmojiPicker';
import MessageBubble from '../../components/chat/MessageBubble';

const ChatBox: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { activeChat, messages, isLoading, sendMessage, setActiveChat, chats, availableUsers, markAsRead, sendTyping } = useChat();
  const { user } = useAuth();
  const { themeMode } = useTheme();
  const [messageText, setMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const typingPulseRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

  useEffect(() => {
    if (chatId && (!activeChat || activeChat.id !== chatId)) {
      const foundChat = chats.find(chat => chat.id?.toString() === chatId?.toString());
      if (foundChat) {
        setActiveChat(foundChat);
      }
    }
  }, [chatId, activeChat, chats, setActiveChat]);

  useEffect(() => {
    if (activeChat && messages.length > 0) {
      const unreadMessageIds = messages
        .filter(m => !m.isRead && m.senderId?.toString() !== user?.id?.toString())
        .map(m => m.id);

      if (unreadMessageIds.length > 0) {
        markAsRead(activeChat.id, unreadMessageIds);
      }
    }
  }, [activeChat, messages, markAsRead, user?.id]);

  const handleTyping = () => {
    if (!activeChat) return;
    if (typingPulseRef.current) return;
    sendTyping(activeChat.id);
    typingPulseRef.current = setTimeout(() => {
      typingPulseRef.current = null;
    }, 2000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    handleTyping();
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeChat) return;
    try {
      await sendMessage(messageText, 'text', replyingTo || undefined);
      setMessageText('');
      setReplyingTo(null);
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const chatName = useMemo(() => {
    if (!activeChat) return '';
    if (activeChat.name && activeChat.name !== 'string' && activeChat.name !== 'null') return activeChat.name;
    const currentUserId = user?.id?.toString();
    const otherParticipant = activeChat.participants?.find((p: any) => p.userId?.toString() !== currentUserId);
    if (otherParticipant) {
      const u = availableUsers?.find(u => u.id?.toString() === otherParticipant.userId?.toString());
      return u?.name || otherParticipant.userName || 'Chat User';
    }
    return activeChat.type === 'group' ? 'Group Chat' : 'Chat User';
  }, [activeChat, availableUsers, user]);

  const chatAvatar = useMemo(() => {
    if (!activeChat) return '';
    if (activeChat.type === 'group') return activeChat.groupAvatar || '';
    const currentUserId = user?.id?.toString();
    const otherParticipant = activeChat.participants?.find((p: any) => p.userId?.toString() !== currentUserId);
    if (otherParticipant && availableUsers) {
      const userData = availableUsers.find(u => u.id?.toString() === otherParticipant.userId?.toString());
      return userData?.profilePhoto || '';
    }
    return '';
  }, [activeChat, availableUsers, user]);

  const enrichedMessages = useMemo(() => {
    return messages.map(msg => {
      const isOwn = msg.senderId?.toString() === user?.id?.toString();
      if (isOwn) {
        return {
          ...msg,
          senderName: 'You',
          senderRole: user?.role,
          senderAvatar: user?.profilePhoto
        };
      }

      const userDetails = availableUsers?.find(u => u.id?.toString() === msg.senderId?.toString());
      const participantDetails = activeChat?.participants?.find(p => p.userId?.toString() === msg.senderId?.toString());

      return {
        ...msg,
        senderName: userDetails?.name || participantDetails?.userName || msg.senderName || 'Team Member',
        senderRole: userDetails?.role || participantDetails?.userRole || msg.senderRole || 'employee',
        senderAvatar: userDetails?.profilePhoto || msg.senderAvatar
      };
    });
  }, [messages, availableUsers, activeChat, user]);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const themeClasses = {
    background: isDark ? 'bg-[#0a1628]' : 'bg-white',
    headerBg: isDark ? 'bg-[#0f172a]' : 'bg-gray-50/50',
    inputBg: isDark ? 'bg-[#0f172a]' : 'bg-gray-50/50',
    inputFieldBg: isDark ? 'bg-[#1e293b]' : 'bg-white',
    text: isDark ? 'text-slate-100' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-500',
    border: isDark ? 'border-slate-800' : 'border-slate-100',
  };

  if (isLoading && !activeChat) {
    return (
      <div className={cn("flex items-center justify-center h-full", themeClasses.background)}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent shadow-lg shadow-green-500/20"></div>
          <p className={cn("text-xs font-bold uppercase tracking-widest opacity-50", themeClasses.text)}>Loading Session...</p>
        </div>
      </div>
    );
  }

  if (!activeChat) return null;

  return (
    <div className={cn("flex flex-col h-full relative overflow-hidden", themeClasses.background)}>
      {/* Dynamic Background Patterns */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#22c55e_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* Modern Header */}
      <div className={cn(
        "flex-shrink-0 flex items-center justify-between p-3.5 px-6 relative z-10 border-b transition-colors",
        themeClasses.headerBg,
        themeClasses.border
      )}>
        <div className="flex items-center space-x-3.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/${user?.role}/chat`)}
            className="sm:hidden p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
          >
            <ArrowLeft className={cn("h-5 w-5", themeClasses.text)} />
          </Button>

          <div className="relative group">
            <Avatar className="h-10 w-10 border shadow-lg shadow-green-500/5 group-hover:scale-105 transition-transform">
              <AvatarImage src={chatAvatar} />
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white font-black text-xs">{chatName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-white dark:border-[#0f172a] rounded-full shadow-sm" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className={cn("font-black truncate text-[15px] tracking-tight leading-none", themeClasses.text)}>{chatName}</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] font-black text-green-500 uppercase tracking-widest leading-none">
                Online
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-full text-slate-400 hover:text-green-500 hover:bg-green-500/10 transition-colors">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 relative z-10 custom-scrollbar">
        {enrichedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 animate-in fade-in zoom-in duration-500">
            <div className="p-6 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-400">
              <MessageCircle className="h-12 w-12 opacity-50" />
            </div>
            <div className="text-center">
              <p className={cn("text-base font-bold", themeClasses.text)}>No messages yet</p>
              <p className={cn("text-xs opacity-60", themeClasses.textSecondary)}>Start the conversation with your team member</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {enrichedMessages.map((message, index) => {
              const showDateSeparator = index === 0 || formatDateIST(message.timestamp, 'yyyy-MM-dd') !== formatDateIST(enrichedMessages[index - 1].timestamp, 'yyyy-MM-dd');
              return (
                <div key={message.id} className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                  {showDateSeparator && (
                    <div className="flex justify-center my-8 relative">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-slate-100 dark:border-slate-800/50"></div>
                      </div>
                      <span className={cn(
                        "relative text-[10px] uppercase tracking-widest font-black px-4 py-1.5 rounded-full border shadow-sm backdrop-blur-md",
                        isDark ? "bg-[#0f172a] border-slate-800 text-slate-400" : "bg-white border-slate-100 text-slate-500"
                      )}>
                        {formatDateIST(message.timestamp, 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    isOwn={message.senderId?.toString() === user?.id?.toString()}
                    onReply={() => setReplyingTo(message.id)}
                    replyMessage={message.replyTo ? enrichedMessages.find(m => m.id === message.replyTo) : undefined}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className={cn("p-4 px-6 relative z-20 transition-all", themeClasses.inputBg)}>
        {replyingTo && (
          <div className={cn(
            "flex items-center justify-between p-3.5 border-l-[3.5px] border-lime-500 mb-4 rounded-r-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 shadow-sm transition-all",
            isDark ? "bg-[#1a1b1e]/80" : "bg-slate-50/80"
          )}>
            <div className="min-w-0 pr-6">
              <div className="flex items-center gap-2 mb-1">
                <Reply className="h-3 w-3 text-lime-500" />
                <p className="text-[10px] text-lime-600 dark:text-lime-500 font-black uppercase tracking-widest">
                  Replying to {enrichedMessages.find(m => m.id === replyingTo)?.senderName || 'Message'}
                </p>
              </div>
              <p className={cn("text-[13px] truncate opacity-80 font-medium italic", themeClasses.text)}>
                "{enrichedMessages.find(m => m.id === replyingTo)?.content}"
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-90"
              onClick={() => setReplyingTo(null)}
            >
              <X className="h-4.5 w-4.5" />
            </Button>
          </div>
        )}

        <div className="flex items-end space-x-3">
          <div className={cn(
            "flex-1 relative rounded-[28px] px-4 py-1.5 flex items-center transition-all shadow-lg ring-1 ring-slate-200 dark:ring-slate-800 focus-within:ring-green-500/50",
            themeClasses.inputFieldBg
          )}>

            <Input
              ref={inputRef}
              value={messageText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="border-0 bg-transparent focus-visible:ring-0 shadow-none text-[15px] h-11 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium"
            />

            <Button
              variant="ghost"
              size="icon"
              className={cn("rounded-full text-slate-400 hover:text-amber-500 transition-colors", showEmojiPicker && "text-amber-500 bg-amber-500/10")}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="h-5 w-5" />
            </Button>
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            className={cn(
              "rounded-full h-[52px] w-[52px] shadow-xl transition-all hover:scale-105 active:scale-95 p-0",
              messageText.trim() ? "bg-green-500 hover:bg-green-600 shadow-green-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
            )}
          >
            <Send className={cn("h-5 w-5 transition-transform", messageText.trim() && "translate-x-0.5 -translate-y-0.5 rotate-[-15deg]")} />
          </Button>
        </div>

        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-24 right-6 z-50 animate-in fade-in slide-in-from-bottom-8 duration-300">
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBox;