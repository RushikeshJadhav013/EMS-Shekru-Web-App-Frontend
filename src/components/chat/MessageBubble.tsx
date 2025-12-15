import React, { useState } from 'react';
import { Reply, Edit, Trash2, Copy, Check, CheckCheck } from 'lucide-react';
import { ChatMessage } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
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

  // Get theme-aware classes
  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setShowActions(false);
  };

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a');
  };

  // Get user profile photo (this will be connected to the profile system)
  const getUserAvatar = () => {
    if (isOwn) {
      return user?.profilePhoto || '';
    }
    // For other users, this would come from the message sender data
    return message.senderAvatar || '';
  };

  return (
    <div className={cn('flex items-end space-x-2 mb-1', isOwn ? 'justify-end' : 'justify-start')}>
      {/* Other user's avatar (left side) */}
      {!isOwn && (
        <Avatar className="h-8 w-8 border-2 border-gray-600 shadow-md flex-shrink-0">
          <AvatarImage src={getUserAvatar()} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-semibold">
            {message.senderName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('max-w-xs lg:max-w-md', isOwn ? 'order-1' : 'order-2')}>
        {/* Sender name for group chats (only for others) */}
        {!isOwn && (
          <div className={cn("text-xs mb-1 ml-3 font-medium", isDark ? "text-gray-400" : "text-gray-600")}>
            {message.senderName}
          </div>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <div className={cn(
            'border-l-4 p-2 mb-2 rounded-r-lg text-xs',
            isOwn 
              ? 'bg-blue-600/30 border-blue-300 text-blue-100' 
              : isDark 
                ? 'bg-gray-700/50 border-gray-400 text-gray-300'
                : 'bg-gray-50 border-gray-400 text-gray-700'
          )}>
            <p className="font-medium opacity-80">Replying to message</p>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            'relative group px-4 py-2 shadow-lg backdrop-blur-sm',
            isOwn
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-md ml-8'
              : isDark
                ? 'bg-gray-800/90 border border-gray-700 text-white rounded-2xl rounded-bl-md mr-8'
                : 'bg-white border border-gray-200 text-gray-900 rounded-2xl rounded-bl-md mr-8',
            message.messageType === 'emoji' ? 'px-2 py-1' : ''
          )}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          {/* Message content */}
          <div className="break-words">
            {message.messageType === 'emoji' ? (
              <span className="text-3xl">{message.content}</span>
            ) : (
              <div className="text-sm leading-relaxed">{message.content}</div>
            )}
          </div>

          {/* Timestamp and status */}
          <div className="flex items-center justify-end mt-2 space-x-1">
            <span className={cn(
              'text-xs font-medium',
              isOwn 
                ? 'text-blue-100' 
                : isDark 
                  ? 'text-gray-400' 
                  : 'text-gray-500'
            )}>
              {formatTime(message.timestamp)}
            </span>
            {message.editedAt && (
              <span className={cn(
                'text-xs italic',
                isOwn 
                  ? 'text-blue-200' 
                  : isDark 
                    ? 'text-gray-500' 
                    : 'text-gray-600'
              )}>
                edited
              </span>
            )}
            {isOwn && (
              <div className="flex items-center ml-1">
                {message.isRead ? (
                  <CheckCheck className="h-4 w-4 text-blue-200" />
                ) : (
                  <Check className="h-4 w-4 text-blue-200" />
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          {showActions && (
            <div className={cn(
              'absolute -top-12 flex items-center space-x-1 backdrop-blur-sm border rounded-lg shadow-xl p-1',
              isDark 
                ? 'bg-gray-800/95 border-gray-600' 
                : 'bg-white/95 border-gray-300',
              isOwn ? '-left-20' : '-right-20'
            )}>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReply}
                className={cn("p-2 h-8 w-8 hover:text-blue-400", 
                  isDark 
                    ? "text-gray-300 hover:bg-gray-700" 
                    : "text-gray-600 hover:bg-gray-100")}
              >
                <Reply className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyMessage}
                className={cn("p-2 h-8 w-8 hover:text-green-400", 
                  isDark 
                    ? "text-gray-300 hover:bg-gray-700" 
                    : "text-gray-600 hover:bg-gray-100")}
              >
                <Copy className="h-3 w-3" />
              </Button>
              {isOwn && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onEdit}
                    className={cn("p-2 h-8 w-8 hover:text-yellow-400", 
                      isDark 
                        ? "text-gray-300 hover:bg-gray-700" 
                        : "text-gray-600 hover:bg-gray-100")}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    className={cn("p-2 h-8 w-8 hover:text-red-400", 
                      isDark 
                        ? "text-gray-300 hover:bg-gray-700" 
                        : "text-gray-600 hover:bg-gray-100")}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Message tail */}
          <div className={cn(
            'absolute bottom-0 w-0 h-0',
            isOwn 
              ? 'right-0 border-l-8 border-l-blue-500 border-b-8 border-b-transparent transform translate-x-1'
              : isDark
                ? 'left-0 border-r-8 border-r-gray-800 border-b-8 border-b-transparent transform -translate-x-1'
                : 'left-0 border-r-8 border-r-white border-b-8 border-b-transparent transform -translate-x-1'
          )} />
        </div>
      </div>

      {/* Own user's avatar (right side) */}
      {isOwn && (
        <Avatar className="h-8 w-8 border-2 border-blue-400 shadow-md flex-shrink-0">
          <AvatarImage src={getUserAvatar()} />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-semibold">
            {user?.name?.charAt(0).toUpperCase() || 'Y'}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default MessageBubble;