import React from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import ChatList from './ChatList';
import ChatBox from './ChatBox';
import ErrorBoundary from '@/components/ErrorBoundary';
import { MessageCircle, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useChat } from '@/contexts/ChatContext';
import { Logo } from '@/components/ui/Logo';

const ChatPlaceholder = () => {
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className={cn(
      "flex flex-col items-center justify-center h-full space-y-8 text-center animate-in fade-in duration-1000",
      isDark ? "bg-[#0b141a]" : "bg-gray-50/50"
    )}>
      <div className="relative">
        <div className="absolute inset-0 bg-green-500/10 blur-[100px] rounded-full" />
        <div className={cn(
          "relative p-10 rounded-full border shadow-2xl backdrop-blur-sm transition-transform hover:scale-105 duration-700",
          isDark ? "bg-[#1f2c33]/40 border-slate-700/50" : "bg-white border-slate-100"
        )}>
          <Logo 
            showText={false} 
            iconClassName="h-28 w-28 opacity-90" 
            className="flex items-center justify-center"
          />
          <div className="absolute -top-1 -right-1">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-500 shadow-xl shadow-green-500/50 animate-bounce">
              <Zap className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md px-8 space-y-4">
        <h2 className={cn("text-3xl font-black tracking-tighter", isDark ? "text-slate-100" : "text-slate-900")}>
          Staffly Web
        </h2>
        <p className={cn("text-sm leading-relaxed font-medium opacity-60", isDark ? "text-slate-400" : "text-slate-500")}>
          Send and receive messages instantly with your team. <br/> 
          Staffly Web links your entire organization for seamless collaboration.
        </p>
      </div>

      <div className="absolute bottom-12 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest opacity-20">
        <div className="h-3 w-3 rounded-full border border-current flex items-center justify-center">
          <div className="h-1 w-1 bg-current rounded-full" />
        </div>
        End-to-end encrypted
      </div>
    </div>
  );
};

const Chat: React.FC = () => {
  const { themeMode } = useTheme();
  const location = useLocation();
  const { chatId } = useParams();
  const { chats, setActiveChat, activeChat } = useChat();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Sync active chat when URL changes (for deep links/refresh)
  React.useEffect(() => {
    if (chatId) {
      if (!activeChat || activeChat.id !== chatId) {
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
          setActiveChat(chat);
        }
      }
    } else if (activeChat) {
      setActiveChat(null);
    }
  }, [chatId, chats, setActiveChat, activeChat]);

  return (
    <ErrorBoundary>
      <div className={cn(
        "flex h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-5rem)] overflow-hidden rounded-3xl border m-2 lg:m-4 shadow-2xl transition-all duration-500",
        isDark ? "bg-[#0a1628] border-slate-800" : "bg-white border-slate-100"
      )}>
        {/* Sidebar for Conversations - Hidden on mobile when chat is selected */}
        <div className={cn(
          "w-full sm:w-80 lg:w-[420px] flex-shrink-0 border-r flex flex-col transition-all duration-300",
          isDark ? "border-slate-800" : "border-slate-100",
          chatId && "hidden sm:flex"
        )}>
          <ChatList />
        </div>

        {/* Messaging Area - Shown on mobile only when chat is selected */}
        <div className={cn(
          "flex-1 flex flex-col relative transition-all duration-500 ease-in-out",
          !chatId ? "hidden sm:flex" : "flex animate-in slide-in-from-right-4 fade-in duration-300"
        )}>
          {chatId ? (
            <ChatBox key={chatId} />
          ) : (
            <ChatPlaceholder />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Chat;
