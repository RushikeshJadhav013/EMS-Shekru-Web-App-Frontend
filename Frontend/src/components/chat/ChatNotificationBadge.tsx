import React from 'react';
import { useChatSafe } from '@/contexts/ChatContext';
import { Badge } from '@/components/ui/badge';

const ChatNotificationBadge: React.FC = () => {
  const chatContext = useChatSafe();
  
  // If ChatProvider is not available or no unread messages, don't show the badge
  if (!chatContext || chatContext.unreadCount === 0) return null;

  return (
    <Badge 
      variant="destructive" 
      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold animate-pulse"
    >
      {chatContext.unreadCount > 99 ? '99+' : chatContext.unreadCount}
    </Badge>
  );
};

export default ChatNotificationBadge;