import React from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import ChatList from './ChatList';
import ChatBox from './ChatBox';
import ErrorBoundary from '@/components/ErrorBoundary';
import { MessageCircle, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

const ChatPlaceholder = () => {
  const { themeMode } = useTheme();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className={cn(
      "flex flex-col items-center justify-center h-full space-y-6 text-center animate-in fade-in duration-700",
      isDark ? "bg-[#0f172a]" : "bg-gray-50/50"
    )}>
      <div className="relative">
        <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full" />
        <div className={cn(
          "relative p-8 rounded-full border shadow-2xl backdrop-blur-md transition-transform hover:scale-105 duration-500",
          isDark ? "bg-gray-800/40 border-gray-700" : "bg-white border-gray-100"
        )}>
          <MessageCircle className="h-24 w-24 text-green-500" />
          <div className="absolute -top-1 -right-1">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-500 shadow-lg shadow-green-500/50">
              <Zap className="h-4 w-4 text-white animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-xs px-4">
        <h2 className={cn("text-2xl font-bold tracking-tight mb-2", isDark ? "text-white" : "text-gray-900")}>
          Secure Team Chat
        </h2>
        <p className={cn("text-sm leading-relaxed", isDark ? "text-gray-400 font-medium" : "text-gray-500 font-medium")}>
          Connect with your team instantly. Select a conversation to start sharing ideas and assets.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="h-1 w-12 rounded-full bg-green-500/30" />
        <div className="h-1 w-4 rounded-full bg-green-500" />
        <div className="h-1 w-12 rounded-full bg-green-500/30" />
      </div>
    </div>
  );
};

const Chat: React.FC = () => {
  const { themeMode } = useTheme();
  const location = useLocation();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Determine if a chat is selected based on path
  const isChatSelected = location.pathname.split('/').filter(Boolean).length > 2;

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
          isChatSelected && "hidden sm:flex"
        )}>
          <ChatList />
        </div>

        {/* Messaging Area - Shown on mobile only when chat is selected */}
        <div className={cn(
          "flex-1 flex flex-col relative transition-all duration-300",
          !isChatSelected && "hidden sm:flex"
        )}>
          <Routes>
            <Route path="/" element={<ChatPlaceholder />} />
            <Route path="/:chatId" element={<ChatBox />} />
          </Routes>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Chat;