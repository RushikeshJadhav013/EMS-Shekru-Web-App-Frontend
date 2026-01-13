import React, { useState } from 'react';
import { Reply, Edit, Trash2, Copy, Check, CheckCheck } from 'lucide-react';
import { ChatMessage } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatTimeIST } from '@/utils/timezone';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  replyMessage?: ChatMessage;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  replyMessage,
  onReply,
  onEdit,
  onDelete,
}) => {
  const [showActions, setShowActions] = useState(false);
  const { user } = useAuth();
  const { themeMode } = useTheme();

  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setShowActions(false);
  };

  const formatTime = (timestamp: string) => {
    return formatTimeIST(timestamp, 'h:mm a') + ' IST';
  };

  const getUserAvatar = () => {
    if (isOwn) return user?.profilePhoto || '';
    return message.senderAvatar || '';
  };

  return (
    <div
      className={cn(
        'flex items-end space-x-3 mb-4 group/bubble animate-in fade-in slide-in-from-bottom-2 duration-500',
        isOwn ? 'flex-row-reverse space-x-reverse' : 'flex-row'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Avatar className={cn(
        "h-9 w-9 border-2 shadow-lg flex-shrink-0 transition-transform duration-300 group-hover/bubble:scale-110",
        isOwn ? "border-green-500/20" : "border-slate-200 dark:border-slate-800"
      )}>
        <AvatarImage src={getUserAvatar()} />
        <AvatarFallback className={cn(
          "text-white text-[10px] font-black uppercase",
          isOwn ? "bg-green-600" : "bg-gradient-to-br from-indigo-500 to-purple-600"
        )}>
          {message.senderName?.charAt(0).toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>

      <div className={cn('max-w-[80%] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender Info for group chats */}
        {!isOwn && (
          <div className="flex items-center gap-2 mb-1.5 ml-1">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              isDark ? "text-emerald-400" : "text-emerald-600"
            )}>
              {message.senderName}
            </span>
            {message.senderRole && (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                message.senderRole === 'admin' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                  message.senderRole === 'hr' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' :
                    message.senderRole === 'manager' ? 'bg-violet-500/10 text-violet-500 border-violet-500/20' :
                      message.senderRole === 'team_lead' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-slate-500/10 text-slate-500 border-slate-500/20'
              )}>
                {message.senderRole.replace('_', ' ')}
              </span>
            )}
          </div>
        )}

        <div className="relative group/content">
          {/* Enhanced Message Actions - Naturally aligned to the message side */}
          <div className={cn(
            "absolute -top-1 pb-1.5 z-50 transition-all duration-300 pointer-events-none",
            isOwn ? "right-0" : "left-0",
            showActions ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-90"
          )}>
            <div className={cn(
              "flex items-center gap-1.5 p-1.5 rounded-2xl border shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-xl",
              isDark ? "bg-slate-900/95 border-slate-700/50" : "bg-white/95 border-slate-200"
            )}>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-green-500/10 hover:text-green-500 transition-all active:scale-90"
                onClick={(e) => { e.stopPropagation(); onReply?.(); }}
              >
                <Reply className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-blue-500/10 hover:text-blue-500 transition-all active:scale-90"
                onClick={(e) => { e.stopPropagation(); handleCopyMessage(); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              {isOwn && (
                <>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-amber-500/10 hover:text-amber-500 transition-all active:scale-90"
                    onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-all active:scale-90"
                    onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Reply Context - Premium Styled with @ mention */}
          {replyMessage && (
            <div className={cn(
              'border-l-[3px] px-3 py-1.5 mb-2 rounded-lg text-[11px] transition-all',
              isOwn
                ? 'bg-black/10 border-white/40' // Own message reply
                : isDark
                  ? 'bg-[#1a1b1e] border-lime-500/80' // Dark theme received message reply
                  : 'bg-slate-100 border-lime-500/80' // Light theme received message reply
            )}>
              <div className="flex flex-col">
                <p className={cn(
                  "font-bold text-[10px] mb-0.5 leading-tight",
                  isOwn ? "text-white/80" : "text-lime-500"
                )}>
                  @{replyMessage.senderId?.toString() === user?.id?.toString() ? 'You' : replyMessage.senderName}
                </p>
                <p className={cn(
                  "line-clamp-1 opacity-90 text-[11px] leading-snug",
                  isOwn ? "text-white/90" : "text-slate-300"
                )}>
                  {replyMessage.content}
                </p>
              </div>
            </div>
          )}

          {/* Core Message Bubble */}
          <div
            className={cn(
              'px-5 py-3.5 relative shadow-xl transition-all duration-300 min-w-[100px]',
              isOwn
                ? 'bg-green-500 text-white rounded-[24px] rounded-tr-none shadow-green-500/10'
                : isDark
                  ? 'bg-[#26272b] border border-slate-700/30 text-slate-100 rounded-[24px] rounded-tl-none'
                  : 'bg-white border border-slate-100 text-slate-900 rounded-[24px] rounded-tl-none shadow-slate-200/50',
              message.messageType === 'emoji' ? 'bg-transparent border-0 shadow-none px-2 scale-150 py-6 min-w-0' : ''
            )}
          >
            <div className="break-words">
              {message.messageType === 'emoji' ? (
                <span className="leading-none select-none">{message.content}</span>
              ) : (
                <div className="text-[14.5px] leading-snug font-medium tracking-tight pr-2">
                  {message.content}
                </div>
              )}
            </div>

            <div className={cn(
              "flex items-center gap-1.5 mt-1.5 h-4 justify-end select-none",
              message.messageType === 'emoji' && "hidden"
            )}>
              <span className={cn(
                'text-[9px] font-bold tracking-tight opacity-70 uppercase',
                isOwn ? 'text-white/90' : 'text-slate-400'
              )}>
                {formatTime(message.timestamp)}
              </span>
              {isOwn && (
                <div className="flex items-center">
                  {message.isRead ? (
                    <CheckCheck className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-white/70" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};

export default MessageBubble;