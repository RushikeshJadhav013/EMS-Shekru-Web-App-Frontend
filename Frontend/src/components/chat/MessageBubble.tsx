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
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
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
    return formatTimeIST(timestamp, 'h:mm a');
  };

  const getUserAvatar = () => {
    if (isOwn) return user?.profilePhoto || '';
    return message.senderAvatar || '';
  };

  return (
    <div
      className={cn('flex items-end space-x-2 mb-2 group/bubble', isOwn ? 'justify-end' : 'justify-start')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Other user's avatar */}
      {!isOwn && (
        <Avatar className="h-8 w-8 border-2 border-gray-600 shadow-md flex-shrink-0 mb-1">
          <AvatarImage src={getUserAvatar()} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
            {message.senderName?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('max-w-[75%] relative', isOwn ? 'order-1' : 'order-2')}>
        {/* Sender name for group chats */}
        {!isOwn && (
          <div className={cn("text-[11px] mb-1 ml-3 font-bold uppercase tracking-tight opacity-70", isDark ? "text-gray-400" : "text-gray-600")}>
            {message.senderName}
            {message.senderRole && (
              <span className={cn("ml-2 px-1.5 py-0.5 rounded-md text-[9px]",
                message.senderRole === 'admin' ? 'bg-red-500/20 text-red-400' :
                  message.senderRole === 'hr' ? 'bg-blue-500/20 text-blue-400' :
                    message.senderRole === 'manager' ? 'bg-purple-500/20 text-purple-400' :
                      message.senderRole === 'team_lead' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-gray-500/20 text-gray-400'
              )}>
                {message.senderRole.replace('_', ' ')}
              </span>
            )}
          </div>
        )}

        {/* Message Actions - Positioned better for hover stability */}
        <div className={cn(
          "absolute top-0 -translate-y-full pb-2 transition-all duration-200 z-50",
          showActions ? "opacity-100 visible translate-y-[-10px]" : "opacity-0 invisible translate-y-0",
          isOwn ? "right-0" : "left-0"
        )}>
          <div className={cn(
            "flex items-center space-x-1 p-1 rounded-xl border shadow-2xl backdrop-blur-md",
            isDark ? "bg-gray-800/95 border-gray-700" : "bg-white/95 border-gray-200"
          )}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-blue-500/10 hover:text-blue-500"
              onClick={(e) => { e.stopPropagation(); onReply?.(); }}
            >
              <Reply className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-green-500/10 hover:text-green-500"
              onClick={(e) => { e.stopPropagation(); handleCopyMessage(); }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            {isOwn && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-yellow-500/10 hover:text-yellow-500"
                  onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-red-500/10 hover:text-red-500"
                  onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Reply preview */}
        {message.replyTo && (
          <div className={cn(
            'border-l-4 p-2 mb-1 rounded-r-lg text-xs opacity-80',
            isOwn ? 'bg-blue-600/20 border-blue-400' : 'bg-gray-500/10 border-gray-400'
          )}>
            <p className="font-semibold line-clamp-1">Replying to message</p>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'px-4 py-2 shadow-sm relative',
            isOwn
              ? 'bg-green-600 text-white rounded-2xl rounded-tr-none'
              : isDark
                ? 'bg-gray-800 border border-gray-700 text-white rounded-2xl rounded-tl-none'
                : 'bg-white border border-gray-100 text-gray-900 rounded-2xl rounded-tl-none',
            message.messageType === 'emoji' ? 'bg-transparent border-0 shadow-none px-1' : ''
          )}
        >
          <div className="break-words">
            {message.messageType === 'emoji' ? (
              <span className="text-4xl leading-none">{message.content}</span>
            ) : (
              <div className="text-[14.5px] leading-relaxed">{message.content}</div>
            )}
          </div>

          <div className="flex items-center justify-end mt-1.5 space-x-1.5 h-3">
            <span className={cn(
              'text-[10px] font-medium opacity-60',
              isOwn ? 'text-white' : 'text-gray-500'
            )}>
              {formatTime(message.timestamp)}
            </span>
            {isOwn && (
              <div className="flex items-center opacity-80">
                {message.isRead ? (
                  <CheckCheck className="h-3 w-3 text-white" />
                ) : (
                  <Check className="h-3 w-3 text-white" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Own user's avatar */}
      {isOwn && (
        <Avatar className="h-8 w-8 border-2 border-green-500 shadow-md flex-shrink-0 mb-1">
          <AvatarImage src={getUserAvatar()} />
          <AvatarFallback className="bg-green-600 text-white text-xs font-semibold">
            {user?.name?.charAt(0).toUpperCase() || 'Y'}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default MessageBubble;