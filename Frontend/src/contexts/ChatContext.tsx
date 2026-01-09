import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Chat, ChatMessage, User } from '@/types';
import { chatService } from '@/services/chatService';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ChatContextType {
  chats: Chat[];
  activeChat: Chat | null;
  messages: ChatMessage[];
  availableUsers: User[];
  isLoading: boolean;
  unreadCount: number;
  setActiveChat: (chat: Chat | null) => void;
  sendMessage: (content: string, messageType?: 'text' | 'emoji', replyTo?: string) => Promise<void>;
  createChat: (type: 'individual' | 'group', participantIds: string[], name?: string, description?: string) => Promise<Chat>;
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string, type?: 'individual' | 'group') => Promise<void>;
  loadAvailableUsers: () => Promise<void>;
  markAsRead: (chatId: string, messageIds: string[]) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  sendTyping: (chatId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // RBAC Filtering logic
  const isUserVisible = useCallback((targetUser: { role: string; department: string; id: string }) => {
    if (!user) return false;
    if (user.id === targetUser.id) return true;

    const cr = user.role;
    const cd = user.department;
    const tr = targetUser.role;
    const td = targetUser.department;

    // Admin & HR: Can chat with everyone
    if (cr === 'admin' || cr === 'hr') return true;

    // Manager Visibility
    if (cr === 'manager') {
      // Admin, HR, All Managers
      if (['admin', 'hr', 'manager'].includes(tr)) return true;
      // Own department (TL, Employee)
      return td === cd;
    }

    // Team Lead Visibility
    if (cr === 'team_lead') {
      // Admin, HR
      if (['admin', 'hr'].includes(tr)) return true;
      // Own department (Manager, TL, Emp)
      return td === cd;
    }

    // Employee Visibility
    if (cr === 'employee') {
      // Admin, HR
      if (['admin', 'hr'].includes(tr)) return true;
      // Own department (Manager, TL, Emp)
      return td === cd;
    }

    return false;
  }, [user]);

  // Calculate total unread count
  const unreadCount = chats.reduce((total, chat) => total + chat.unreadCount, 0);

  // Load chats
  const loadChats = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const fetchedChats = await chatService.getChats();

      // Filter chats based on RBAC rules
      const filteredChats = fetchedChats.filter(chat => {
        if (chat.type === 'group') return true; // Groups are visible if you are a member

        // For individual chats, check the target user
        const otherParticipant = chat.participants.find(p => p.userId !== user.id);
        if (!otherParticipant) return true;

        return isUserVisible({
          id: otherParticipant.userId,
          role: otherParticipant.userRole,
          department: otherParticipant.department
        });
      });

      setChats(filteredChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chats',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  // Load messages for a specific chat
  const loadMessages = useCallback(async (chatId: string, type?: 'individual' | 'group') => {
    setIsLoading(true);
    try {
      const chat = chats.find(c => c.id === chatId);
      const chatType = type || chat?.type || 'individual';
      const fetchedMessages = await chatService.getChatMessages(chatId, chatType);
      setMessages(fetchedMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [chats, toast]);

  // Load available users
  const loadAvailableUsers = useCallback(async () => {
    if (!user) return;

    try {
      const users = await chatService.getAvailableUsers();
      // Filter available users based on RBAC rules
      const filteredUsers = users.filter(u => isUserVisible(u));
      setAvailableUsers(filteredUsers);
    } catch (error) {
      console.error('Failed to load available users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available users',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  // Send message
  const sendMessage = useCallback(async (content: string, messageType: 'text' | 'emoji' = 'text', replyTo?: string) => {
    if (!activeChat || !user) return;

    try {
      const newMessage = await chatService.sendMessage(activeChat.id, activeChat.type, content, messageType, replyTo);
      setMessages(prev => [...prev, newMessage]);

      // Update the chat's last message
      setChats(prev => prev.map(chat =>
        chat.id === activeChat.id
          ? { ...chat, lastMessage: newMessage, updatedAt: newMessage.timestamp }
          : chat
      ));
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  }, [activeChat, user, toast]);

  // Create new chat
  const createChat = useCallback(async (
    type: 'individual' | 'group',
    participantIds: string[],
    name?: string,
    description?: string
  ): Promise<Chat> => {
    // Check if 1-to-1 chat already exists
    if (type === 'individual') {
      const targetUserId = participantIds[0];
      const existingChat = chats.find(c =>
        c.type === 'individual' &&
        c.participants.some(p => p.userId === targetUserId)
      );

      if (existingChat) {
        return existingChat;
      }
    }


    // Check if group with same name already exists
    if (type === 'group' && name) {
      // Normalize: remove all spaces and convert to lowercase for comparison
      const normalizedInput = name.toLowerCase().replace(/\s+/g, '');

      const existingGroup = chats.find(c =>
        c.type === 'group' &&
        c.name?.toLowerCase().replace(/\s+/g, '') === normalizedInput
      );

      if (existingGroup) {
        toast({
          title: 'Group Already Exists',
          description: `A group named "${existingGroup.name}" already exists. Please choose a different name.`,
          variant: 'destructive',
        });
        throw new Error('Duplicate group name');
      }
    }

    try {
      const newChat = await chatService.createChat({
        type,
        name,
        description,
        participantIds,
      });

      setChats(prev => [newChat, ...prev]);
      toast({
        title: 'Success',
        description: `${type === 'group' ? 'Group' : 'Chat'} created successfully`,
      });

      return newChat;
    } catch (error) {
      console.error('Failed to create chat:', error);

      // Don't show duplicate error toast again if we already showed it
      if (error instanceof Error && error.message === 'Duplicate group name') {
        throw error;
      }

      toast({
        title: 'Error',
        description: 'Failed to create chat',
        variant: 'destructive',
      });
      throw error;
    }
  }, [chats, toast]);

  // Mark messages as read
  // Now takes messageIds to mark specific messages
  const markAsRead = useCallback(async (chatId: string, messageIds: string[]) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat || messageIds.length === 0) return;

    try {
      // Parallelize requests if there are multiple. 
      // Note: In a real app with many messages, this might be loop-heavy, 
      // but API only supports single message read receipt.
      await Promise.all(messageIds.map(msgId => chatService.markMessageAsRead(chatId, chat.type, msgId)));

      // Update local state
      setChats(prev => prev.map(c =>
        c.id === chatId ? { ...c, unreadCount: Math.max(0, c.unreadCount - messageIds.length) } : c
      ));

      setMessages(prev => prev.map(message =>
        messageIds.includes(message.id) ? { ...message, isRead: true } : message
      ));
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, [chats]);

  // Send typing status
  const sendTyping = useCallback(async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    try {
      await chatService.sendTypingStatus(chatId, chat.type);
    } catch (error) {
      console.error('Failed to send typing status:', error);
    }
  }, [chats]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!activeChat) return;

    try {
      await chatService.deleteMessage(activeChat.id, messageId);
      setMessages(prev => prev.filter(message => message.id !== messageId));

      toast({
        title: 'Success',
        description: 'Message deleted',
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive',
      });
    }
  }, [activeChat, toast]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!activeChat) return;

    try {
      const updatedMessage = await chatService.editMessage(activeChat.id, messageId, newContent);
      setMessages(prev => prev.map(message =>
        message.id === messageId ? updatedMessage : message
      ));

      toast({
        title: 'Success',
        description: 'Message updated',
      });
    } catch (error) {
      console.error('Failed to edit message:', error);
      toast({
        title: 'Error',
        description: 'Failed to edit message',
        variant: 'destructive',
      });
    }
  }, [activeChat, toast]);

  // Handle active chat change
  const handleSetActiveChat = useCallback((chat: Chat | null) => {
    setActiveChat(chat);
    if (chat) {
      loadMessages(chat.id, chat.type);
    } else {
      setMessages([]);
    }
  }, [loadMessages]);

  useEffect(() => {
    if (user) {
      loadChats();
      loadAvailableUsers();
    }
  }, [user, loadChats, loadAvailableUsers]);

  const value = {
    chats,
    activeChat,
    messages,
    availableUsers,
    isLoading,
    unreadCount,
    setActiveChat: handleSetActiveChat,
    sendMessage,
    createChat,
    loadChats,
    loadMessages,
    loadAvailableUsers,
    markAsRead,
    deleteMessage,
    editMessage,
    sendTyping
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// Safe version that returns null if provider is not available
export const useChatSafe = () => {
  const context = useContext(ChatContext);
  return context;
};