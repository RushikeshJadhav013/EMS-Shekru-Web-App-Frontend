import React, { useState, useRef, useEffect } from 'react';
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
import DevelopmentModeNotice from '../../components/chat/DevelopmentModeNotice';

const ChatBox: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { activeChat, messages, isLoading, sendMessage, setActiveChat, chats, availableUsers } = useChat();
  const { user } = useAuth();
  const { themeMode } = useTheme();
  const [messageText, setMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle click outside emoji picker to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showEmojiPicker]);

  // Load chat if not already active
  useEffect(() => {
    if (chatId && (!activeChat || activeChat.id !== chatId)) {
      // Find chat from the chats list and set it as active
      const foundChat = chats.find(chat => chat.id === chatId);
      if (foundChat) {
        setActiveChat(foundChat);
      } else if (chats.length > 0) {
        // If chat not found in list and chats are loaded, navigate back to chat list
        console.log('Chat not found:', chatId);
        navigate(`/${user?.role}/chat`);
      }
      // If chats.length === 0, we're still loading, so wait
    }
  }, [chatId, activeChat, chats, setActiveChat, navigate, user?.role]);

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

  const getChatName = () => {
    if (!activeChat) return '';
    
    if (activeChat.type === 'group') {
      return activeChat.name;
    }
    
    // For individual chats, show the other participant's name
    const otherParticipant = activeChat.participants.find(p => p.userId !== user?.id);
    return otherParticipant?.userName || 'Unknown User';
  };

  const getChatAvatar = () => {
    if (!activeChat) return '';
    
    if (activeChat.type === 'group') {
      return activeChat.groupAvatar || '';
    }
    
    // For individual chats, show the other participant's avatar
    const otherParticipant = activeChat.participants.find(p => p.userId !== user?.id);
    if (otherParticipant && availableUsers) {
      // Find the user in availableUsers to get their profile photo
      const userData = availableUsers.find(u => u.id === otherParticipant.userId);
      return userData?.profilePhoto || '';
    }
    return '';
  };

  const getOnlineStatus = () => {
    if (!activeChat || activeChat.type === 'group') return null;
    
    const otherParticipant = activeChat.participants.find(p => p.userId !== user?.id);
    return otherParticipant?.isOnline ? 'Online' : 'Last seen recently';
  };

  // Get theme-aware classes
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

  if (isLoading || !availableUsers) {
    return (
      <div className={cn("flex items-center justify-center h-full", themeClasses.background)}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
          <p className={cn("font-medium", themeClasses.textSecondary)}>Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!activeChat) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full space-y-6", themeClasses.background, themeClasses.textSecondary)}>
        <div className={cn("p-8 rounded-full backdrop-blur-sm", themeClasses.cardBg)}>
          <MessageCircle className="h-20 w-20 text-gray-500" />
        </div>
        <div className="text-center">
          <p className={cn("text-xl font-semibold mb-2", themeClasses.text)}>Select a chat to start messaging</p>
          <p className={cn("text-sm", themeClasses.textSecondary)}>Chat ID: {chatId}</p>
          <p className={cn("text-sm", themeClasses.textSecondary)}>Available chats: {chats?.length || 0}</p>
        </div>
        <Button
          onClick={() => navigate(`/${user?.role}/chat`)}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          Back to Chat List
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-[calc(100vh-4rem)] relative overflow-hidden", themeClasses.background)}>
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23${isDark ? 'ffffff' : '000000'}' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Development Mode Notice */}
      <div className="flex-shrink-0 p-4 pb-0 relative z-10">
        <DevelopmentModeNotice />
      </div>
      
      {/* Header */} 
      <div className={cn("flex-shrink-0 flex items-center justify-between p-4 shadow-lg relative z-10", themeClasses.headerBg, themeClasses.border, "border-b")}>
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/${user?.role}/chat`)}
            className={cn("p-2 rounded-full transition-colors", isDark ? "hover:bg-gray-600" : "hover:bg-gray-200")}
          >
            <ArrowLeft className={cn("h-5 w-5", themeClasses.text)} />
          </Button>
          
          <div className="relative">
            <Avatar className="h-10 w-10 border-2 border-green-400 shadow-md">
              <AvatarImage src={getChatAvatar()} />
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold text-sm">
                {getChatName().charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {activeChat.type === 'individual' && (
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-400 border-2 border-gray-800 rounded-full animate-pulse"></div>
            )}
            {activeChat.type === 'group' && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-0.5 border-2 border-gray-800">
                <Users className="h-2 w-2 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className={cn("font-semibold truncate text-base", themeClasses.text)}>{getChatName()}</h2>
            {activeChat.type === 'individual' && (
              <div className="text-xs text-green-400 font-medium flex items-center">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse"></div>
                {getOnlineStatus()}
              </div>
            )}
            {activeChat.type === 'group' && (
              <p className={cn("text-xs", themeClasses.textSecondary)}>
                {activeChat.participants.length} participants
              </p>
            )}
          </div>
        </div>
        

      </div>

      {/* Messages */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 relative z-10 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23${isDark ? 'ffffff' : '000000'}' fill-opacity='0.03'%3E%3Cpath d='M50 50c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10-10-4.5-10-10zm-20 0c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10-10-4.5-10-10zm-20 0c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10-10-4.5-10-10z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {messages.length === 0 ? (
          <div className={cn("flex flex-col items-center justify-center h-full space-y-4", themeClasses.textSecondary)}>
            <div className={cn("p-6 rounded-full backdrop-blur-sm", themeClasses.cardBg)}>
              <MessageCircle className="h-12 w-12 text-gray-500" />
            </div>
            <div className="text-center">
              <p className={cn("text-lg font-semibold mb-2", themeClasses.text)}>No messages yet</p>
              <p className={cn("text-sm", themeClasses.textSecondary)}>Start the conversation by sending a message!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {messages.map((message, index) => {
              const showDateSeparator = index === 0 || 
                formatDateIST(message.timestamp, 'yyyy-MM-dd') !== 
                formatDateIST(messages[index - 1].timestamp, 'yyyy-MM-dd');
              
              return (
                <div key={message.id} className="animate-fade-in">
                  {showDateSeparator && (
                    <div className="flex justify-center my-4">
                      <span className={cn("backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium shadow-md", 
                        isDark ? "bg-gray-800/80 text-gray-300 border-gray-700" : "bg-white/80 text-gray-600 border-gray-300", 
                        "border")}>
                        {formatDateIST(message.timestamp, 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    isOwn={message.senderId === user?.id}
                    onReply={() => setReplyingTo(message.id)}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className={cn("flex-shrink-0 mx-4 mb-2 p-3 backdrop-blur-sm border-l-4 border-blue-400 rounded-r-lg shadow-lg relative z-10", 
          isDark ? "bg-gray-800/90" : "bg-white/90")}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-400 mb-1">
                Replying to {messages.find(m => m.id === replyingTo)?.senderName}
              </p>
              <p className={cn("text-sm truncate", themeClasses.textSecondary)}>
                {messages.find(m => m.id === replyingTo)?.content}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyingTo(null)}
              className={cn("ml-2 h-8 w-8 p-0 rounded-full", 
                themeClasses.textSecondary, 
                isDark ? "hover:text-white hover:bg-gray-700" : "hover:text-gray-900 hover:bg-gray-200")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className={cn("flex-shrink-0 p-4 shadow-2xl relative z-10 border-t", themeClasses.inputBg, themeClasses.border)}>
        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <div className={cn("relative rounded-3xl border focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-400/20 transition-all shadow-inner", 
              themeClasses.inputFieldBg, 
              isDark ? "border-gray-600" : "border-gray-300")}>
              <Input
                ref={inputRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className={cn("border-0 bg-transparent rounded-3xl pr-20 py-4 focus:ring-0 focus:border-transparent text-base", 
                  themeClasses.text, 
                  isDark ? "placeholder:text-gray-400" : "placeholder:text-gray-500")}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={cn("p-2 h-8 w-8 rounded-full transition-colors", 
                    isDark ? "hover:bg-gray-600" : "hover:bg-gray-200")}
                >
                  <Smile className={cn("h-4 w-4", 
                    themeClasses.textSecondary, 
                    isDark ? "hover:text-white" : "hover:text-gray-900")} />
                </Button>
              </div>
            </div>
          </div>
          
          <Button
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:scale-105"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-20 right-4 z-20">
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBox;