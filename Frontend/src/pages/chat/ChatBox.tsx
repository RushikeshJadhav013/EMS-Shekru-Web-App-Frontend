import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Smile,
  Users,
  MessageCircle,
  X
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
      } else if (chats.length > 0 && !isLoading) {
        navigate(`/${user?.role}/chat`);
      }
    }
  }, [chatId, activeChat, chats, setActiveChat, navigate, user?.role, isLoading]);

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
    if (typingPulseRef.current) return; // Throttled typing
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
    if (activeChat.name && activeChat.name !== 'string' && activeChat.name !== 'null') {
      return activeChat.name;
    }

    const currentUserId = user?.id?.toString();
    const otherParticipant = activeChat.participants?.find((p: any) =>
      p.userId?.toString() !== currentUserId
    );

    if (otherParticipant) {
      const u = availableUsers?.find(u => u.id?.toString() === otherParticipant.userId?.toString());
      if (u) return u.name;
      if (otherParticipant.userName) return otherParticipant.userName;
    }

    return activeChat.type === 'group' ? 'Group Chat' : 'Chat User';
  }, [activeChat, availableUsers, user]);

  const chatAvatar = useMemo(() => {
    if (!activeChat) return '';
    if (activeChat.type === 'group') return activeChat.groupAvatar || '';

    const currentUserId = user?.id?.toString();
    const otherParticipant = activeChat.participants?.find((p: any) =>
      p.userId?.toString() !== currentUserId
    );

    if (otherParticipant && availableUsers) {
      const userData = availableUsers.find(u => u.id?.toString() === otherParticipant.userId?.toString());
      return userData?.profilePhoto || '';
    }
    return '';
  }, [activeChat, availableUsers, user]);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const themeClasses = {
    background: isDark ? 'bg-[#0a1628]' : 'bg-gray-50',
    headerBg: isDark ? 'bg-[#1f2937]' : 'bg-white',
    inputBg: isDark ? 'bg-gray-800' : 'bg-white',
    inputFieldBg: isDark ? 'bg-gray-700' : 'bg-gray-100',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSecondary: isDark ? 'text-gray-400' : 'text-gray-600',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    cardBg: isDark ? 'bg-gray-800/50' : 'bg-white/80',
  };

  if (isLoading && !activeChat) {
    return (
      <div className={cn("flex items-center justify-center h-full", themeClasses.background)}>
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!activeChat) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full space-y-6", themeClasses.background)}>
        <MessageCircle className="h-20 w-20 text-gray-500" />
        <p className={cn("text-xl font-semibold", themeClasses.text)}>Select a conversation</p>
        <Button onClick={() => navigate(`/${user?.role}/chat`)} className="bg-green-600 hover:bg-green-700">Back to Chats</Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-[calc(100vh-4rem)] relative overflow-hidden", themeClasses.background)}>
      <div className={cn("flex-shrink-0 flex items-center justify-between p-4 shadow-lg relative z-10 border-b", themeClasses.headerBg, themeClasses.border)}>
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/${user?.role}/chat`)} className="p-2 rounded-full">
            <ArrowLeft className={cn("h-5 w-5", themeClasses.text)} />
          </Button>
          <Avatar className="h-10 w-10 border-2 border-green-400">
            <AvatarImage src={chatAvatar} />
            <AvatarFallback className="bg-green-600 text-white">{chatName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className={cn("font-semibold truncate text-base", themeClasses.text)}>{chatName}</h2>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 relative z-10 scrollbar-thin scrollbar-thumb-gray-600">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
            <MessageCircle className="h-10 w-10 mb-2" />
            <p>No messages in this conversation yet</p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {messages.map((message, index) => {
              const showDateSeparator = index === 0 || formatDateIST(message.timestamp, 'yyyy-MM-dd') !== formatDateIST(messages[index - 1].timestamp, 'yyyy-MM-dd');
              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-6">
                      <span className="text-[10px] uppercase tracking-wider font-bold opacity-40 px-2 py-1 rounded bg-black/5">{formatDateIST(message.timestamp, 'MMMM d, yyyy')}</span>
                    </div>
                  )}
                  <MessageBubble message={message} isOwn={message.senderId?.toString() === user?.id?.toString()} onReply={() => setReplyingTo(message.id)} />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {replyingTo && (
        <div className="flex items-center justify-between p-3 bg-blue-500/10 border-l-4 border-blue-500 mx-4 mb-2 rounded-r-lg">
          <div className="min-w-0">
            <p className="text-[10px] text-blue-500 font-bold uppercase">Replying to</p>
            <p className="text-sm truncate opacity-80">{messages.find(m => m.id === replyingTo)?.content}</p>
          </div>
          <X className="h-4 w-4 cursor-pointer opacity-50 hover:opacity-100" onClick={() => setReplyingTo(null)} />
        </div>
      )}

      <div className={cn("p-4 border-t", themeClasses.inputBg, themeClasses.border)}>
        <div className="flex items-end space-x-3">
          <div className={cn("flex-1 relative rounded-3xl px-4 py-1 flex items-center transition-all focus-within:ring-2 focus-within:ring-green-500/20", themeClasses.inputFieldBg)}>
            <Input
              ref={inputRef}
              value={messageText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="border-0 bg-transparent focus-within:ring-0 shadow-none text-base h-11"
            />
            <Smile className="h-5 w-5 cursor-pointer text-gray-500 hover:text-green-500 transition-colors" onClick={() => setShowEmojiPicker(!showEmojiPicker)} />
          </div>
          <Button onClick={handleSendMessage} disabled={!messageText.trim()} className="rounded-full h-11 w-11 bg-green-600 hover:bg-green-700 shadow-lg transition-transform hover:scale-105 active:scale-95">
            <Send className="h-5 w-5" />
          </Button>
        </div>
        {showEmojiPicker && <div ref={emojiPickerRef} className="absolute bottom-20 right-4 z-20"><EmojiPicker onEmojiSelect={handleEmojiSelect} /></div>}
      </div>
    </div>
  );
};

export default ChatBox;