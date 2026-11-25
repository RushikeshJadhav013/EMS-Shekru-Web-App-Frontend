import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import ChatList from './ChatList';
import ChatBox from './ChatBox';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Zap } from 'lucide-react';
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
          Send and receive messages instantly with your team. <br />
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
  const { chatId: paramChatId } = useParams();
  const { chats, setActiveChat, activeChat, loadChats, isLoading } = useChat();
  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const hasAttemptedReloadRef = React.useRef<Record<string, boolean>>({});

  // Robustly derive the chatId from the URL pathname, regardless of slug prefix
  // The chat URL pattern is: /{role}/chat/{chatId} or /{slug}/{role}/chat/{chatId}
  const chatId = React.useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const chatIndex = parts.findIndex(p => p === 'chat');
    let derivedId = null;
    if (chatIndex !== -1 && parts.length > chatIndex + 1) {
      derivedId = parts[chatIndex + 1];
    } else {
      derivedId = paramChatId || null;
    }

    // Safety check: sometimes URL might contain "null" or "undefined" as strings
    if (derivedId === 'null' || derivedId === 'undefined') return null;
    return derivedId;
  }, [location.pathname, paramChatId]);

  const queryParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const senderId = queryParams.get('senderId') || (location.state as any)?.senderId;

  // Sync active chat when URL changes (for deep links/refresh/notifications)
  React.useEffect(() => {
    // If chats are currently in their initial load, wait for them to finish
    if (isLoading && chats.length === 0) return;

    if (chatId) {
      // Primary: Find chat by actual Chat ID (for both individual and group chats)
      const matchingChat = chats.find(c => String(c.id) === String(chatId));

      if (matchingChat) {
        if (!activeChat || String(activeChat.id) !== String(matchingChat.id)) {
          setActiveChat(matchingChat);
        }
      } else {
        // Chat not found in local cache - attempt to reload once to fetch recently created chat
        if (!hasAttemptedReloadRef.current[chatId]) {
          hasAttemptedReloadRef.current[chatId] = true;
          loadChats(true);
        } else {
          // Genuinely invalid or deleted chat - clear activeChat so ChatBox shows fallback UI
          if (activeChat) {
            setActiveChat(null);
          }
        }
      }
    } else if (senderId) {
      // Fallback: When no chatId is provided, find individual chat by participant senderId
      const matchingChat = chats.find(
        c => c.type === 'individual' && c.participants?.some(p => String(p.userId) === String(senderId))
      );

      if (matchingChat) {
        if (!activeChat || String(activeChat.id) !== String(matchingChat.id)) {
          setActiveChat(matchingChat);
        }
      } else {
        const reloadKey = `sender-${senderId}`;
        if (!hasAttemptedReloadRef.current[reloadKey]) {
          hasAttemptedReloadRef.current[reloadKey] = true;
          loadChats(true);
        } else if (activeChat) {
          setActiveChat(null);
        }
      }
    } else if (activeChat) {
      // Neither chatId nor senderId in URL: Clear activeChat to show placeholder
      setActiveChat(null);
    }
  }, [chatId, senderId, chats, activeChat, isLoading, setActiveChat, loadChats]);

  return (
    <ErrorBoundary>
      <div className={cn(
        "flex h-full w-full min-h-0 flex-1 overflow-hidden transition-all duration-300",
        isDark ? "bg-[#0b141a]" : "bg-white"
      )}>
        {/* Sidebar for Conversations - Hidden on mobile when chat is selected */}
        <div className={cn(
          "w-full sm:w-80 lg:w-[340px] xl:w-[380px] flex-shrink-0 min-w-0 border-r flex flex-col transition-all duration-300 h-full",
          isDark ? "border-slate-800 bg-[#111b21]" : "border-slate-200/80 bg-white",
          chatId && "hidden sm:flex"
        )}>
          <ChatList />
        </div>

        {/* Messaging Area - Shown on mobile only when chat is selected */}
        <div className={cn(
          "flex-1 min-w-0 w-full h-full flex flex-col relative overflow-hidden transition-all duration-300 ease-in-out",
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
