import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  sendMessage: (content: string, messageType?: 'text' | 'emoji' | 'image' | 'file', replyTo?: string) => Promise<void>;
  sendMessageWithFile: (file: File, content?: string, replyTo?: string) => Promise<void>;
  createChat: (type: 'individual' | 'group', participantIds: string[], name?: string, description?: string) => Promise<Chat>;
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string, type?: 'individual' | 'group') => Promise<void>;
  loadAvailableUsers: () => Promise<void>;
  markAsRead: (chatId: string, messageIds: string[]) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  sendTyping: (chatId: string) => Promise<void>;
  updateGroupName: (chatId: string, newName: string) => Promise<void>;
  deleteGroup: (chatId: string) => Promise<void>;
  addParticipants: (chatId: string, userIds: string[]) => Promise<void>;
  removeParticipants: (chatId: string, userIds: string[]) => Promise<void>;
  isLightboxOpen: boolean;
  setIsLightboxOpen: (isOpen: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Stable ref to chats — lets callbacks read latest chats without adding it as a dep
  const chatsRef = useRef<Chat[]>([]);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  // RBAC Filtering logic
  const isUserVisible = useCallback((targetUser: { role: string; department?: string; id: string }) => {
    if (!user) return false;
    if (user.id === targetUser.id) return true;

    const cr = user.role;
    const cd = user.department || '';
    const tr = targetUser.role;
    const td = targetUser.department || '';

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
  const loadChats = useCallback(async (silent = false) => {
    if (!user) return;

    try {
      const fetchedChats = await chatService.getChats();
      setChats(prev => {
        // ... (rest of existing setChats logic)
        return fetchedChats.map(fc => {
          const localMatch = prev.find(p => p.id === fc.id);
          if (localMatch && localMatch.lastMessage && fc.lastMessage) {
            const localTime = new Date(localMatch.lastMessage.timestamp).getTime();
            const fetchedTime = new Date(fc.lastMessage.timestamp).getTime();

            if (localTime > fetchedTime && (Date.now() - localTime < 20000)) {
              return {
                ...fc,
                lastMessage: localMatch.lastMessage,
                updatedAt: localMatch.updatedAt,
                unreadCount: fc.unreadCount
              };
            }
          }
          return fc;
        });
      });

      const chatsNeedingSync = fetchedChats.filter(c => c.lastMessage && !c.lastMessage.content && c.lastMessage.timestamp);
      if (chatsNeedingSync.length > 0) {
        Promise.all(chatsNeedingSync.map(async chat => {
          try {
            const msgs = await chatService.getChatMessages(chat.id, chat.type, 1, 5);
            if (msgs.length > 0) {
              const actualLatestMessage = msgs[msgs.length - 1];
              setChats(prev => prev.map(c =>
                c.id === chat.id
                  ? { ...c, lastMessage: actualLatestMessage }
                  : c
              ));
            }
          } catch (e) { }
        }));
      }

    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [user]);

  // Load messages for a specific chat
  const loadMessages = useCallback(async (chatId: string, type?: 'individual' | 'group', silent = false) => {
    // Only show loading if we don't have any messages yet for this chat
    const hasMessages = messages.length > 0 && messages[0].chatId === chatId;
    if (!silent && !hasMessages) setIsLoading(true);
    try {
      let chatType = type;
      if (!chatType) {
        // Use ref instead of closing over chats state — avoids dependency on chats
        const chat = chatsRef.current.find(c => c.id === chatId);
        chatType = chat?.type || (chatId.includes('_') ? 'individual' : 'group');
      }

      const fetchedMessages = await chatService.getChatMessages(chatId, chatType);
      const serverMessages = [...fetchedMessages].reverse();

      setMessages(prev => {
        const mergedServerMessages = serverMessages.map(sm => {
          const localMatch = prev.find(pm => pm.id === sm.id);
          if (localMatch && localMatch.content.length > sm.content.length) {
            return { ...sm, content: localMatch.content, messageType: localMatch.messageType };
          }
          return sm;
        });

        const localOnly = prev.filter(m => typeof m.id === 'string' && m.id.startsWith('local_') && m.chatId === chatId);
        const unsyncedLocals = localOnly.filter(lm =>
          !mergedServerMessages.some(sm =>
            sm.senderId === lm.senderId &&
            sm.messageType === lm.messageType &&
            Math.abs(new Date(sm.timestamp).getTime() - new Date(lm.timestamp).getTime()) < 120_000 &&
            (lm.messageType === 'text' ? sm.content === lm.content : true)
          )
        );

        const existingIds = new Set(mergedServerMessages.map(m => m.id));
        const missingButRecent = prev.filter(m =>
          m.chatId === chatId && typeof m.id === 'string' && !m.id.startsWith('local_') && !existingIds.has(m.id) &&
          Math.abs(Date.now() - new Date(m.timestamp).getTime()) < 15000
        );

        return [...mergedServerMessages, ...unsyncedLocals, ...missingButRecent];
      });
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []); // No deps: uses chatsRef.current instead of chats

  // Load available users — only depends on user, not on isUserVisible
  const loadAvailableUsers = useCallback(async () => {
    if (!user) return;

    try {
      const users = await chatService.getAvailableUsers();
      setAvailableUsers(users);
    } catch (error) {
      console.error('Failed to load available users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available users',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  // Send message – with optimistic UI so files appear instantly
  const sendMessage = useCallback(async (content: string, messageType: 'text' | 'emoji' | 'image' | 'file' = 'text', replyTo?: string) => {
    if (!activeChat || !user) return;

    // Build an optimistic message so the UI updates immediately
    const optimisticId = `local_${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      chatId: activeChat.id,
      senderId: user.id?.toString(),
      senderName: 'You',
      senderRole: user.role,
      content,
      messageType,
      timestamp: new Date().toISOString(),
      isRead: false,
      replyTo,
    };

    // Add optimistically to both messages list and chat preview
    setMessages(prev => [...prev, optimisticMessage]);
    setChats(prev => prev.map(chat =>
      chat.id === activeChat.id
        ? { ...chat, lastMessage: optimisticMessage, updatedAt: optimisticMessage.timestamp }
        : chat
    ));

    try {
      const newMessage = await chatService.sendMessage(activeChat.id, activeChat.type, content, messageType, replyTo);

      // If server version is truncated, keep local version
      if ((messageType === 'image' || messageType === 'file') && newMessage.content.length < content.length) {
        newMessage.content = content;
      }

      // Replace optimistic message with server-confirmed one
      setMessages(prev => prev.map(m => m.id === optimisticId ? newMessage : m));
      setChats(prev => prev.map(chat =>
        chat.id === activeChat.id
          ? { ...chat, lastMessage: newMessage, updatedAt: newMessage.timestamp }
          : chat
      ));
    } catch (error) {
      console.error('Failed to send message:', error);
      if (messageType === 'text' || messageType === 'emoji') {
        setMessages(prev => prev.filter(m => m.id !== optimisticId));
        toast({
          title: 'Error',
          description: 'Failed to send message. Please try again.',
          variant: 'destructive',
        });
      }
    }
  }, [activeChat, user, toast]);

  // Send message with file – using the new with-file API
  const sendMessageWithFile = useCallback(async (file: File, content?: string, replyTo?: string) => {
    if (!activeChat || !user) return;

    const isImage = file.type.startsWith('image/');
    const messageType = isImage ? 'image' : 'file';

    // Create local preview content
    const base64 = await chatService.fileToBase64(file);
    const localContent = isImage ? base64 : `${file.name}|${base64}`;

    // Build an optimistic message
    const optimisticId = `local_${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      chatId: activeChat.id,
      senderId: user.id?.toString(),
      senderName: 'You',
      senderRole: user.role,
      content: localContent,
      messageType,
      timestamp: new Date().toISOString(),
      isRead: false,
      replyTo,
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // Update sidebar optimistically as well so the latest image shows as "Image" in the list immediately
    setChats(prev => prev.map(chat =>
      chat.id === activeChat.id
        ? { ...chat, lastMessage: optimisticMessage, updatedAt: optimisticMessage.timestamp }
        : chat
    ));

    let fileToSend = file;

    // If it's an image, compress it to avoid 413 "Request Entity Too Large" errors
    if (isImage && file.size > 1024 * 512) { // Only compress if larger than 0.5MB
      try {
        const compressedFile = await new Promise<File>((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const maxWidth = 1024;
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (blob) {
                  resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                } else {
                  resolve(file);
                }
              }, 'image/jpeg', 0.7);
            };
            img.src = e.target?.result as string;
          };
        });
        fileToSend = compressedFile;
      } catch (e) {
        console.warn("Failed to compress image, sending original:", e);
      }
    }

    try {
      const newMessage = await chatService.sendMessageWithFile(activeChat.id, activeChat.type, fileToSend, content, replyTo);

      // Replace optimistic message with server-confirmed one
      setMessages(prev => prev.map(m => m.id === optimisticId ? newMessage : m));
      setChats(prev => prev.map(chat =>
        chat.id === activeChat.id
          ? { ...chat, lastMessage: newMessage, updatedAt: newMessage.timestamp }
          : chat
      ));
    } catch (error: any) {
      console.error('Failed to send file message:', error);

      const isTooLarge = error.message?.includes('413') || error.status === 413;

      toast({
        title: isTooLarge ? 'File Too Large' : 'Upload Failed',
        description: isTooLarge
          ? 'The file is too large for the server. Please try a smaller file or compress it first.'
          : 'Could not send the file. Please try again.',
        variant: 'destructive',
      });
      // Filter out only if it's not a background poll issue
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
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
  const markAsRead = useCallback(async (chatId: string, messageIds: string[]) => {
    const chat = chatsRef.current.find(c => c.id === chatId);
    if (!chat || messageIds.length === 0) return;

    try {
      await Promise.all(messageIds.map(msgId => chatService.markMessageAsRead(chatId, chat.type, msgId)));

      setChats(prev => prev.map(c =>
        c.id === chatId ? { ...c, unreadCount: Math.max(0, c.unreadCount - messageIds.length) } : c
      ));

      setMessages(prev => prev.map(message =>
        messageIds.includes(message.id) ? { ...message, isRead: true } : message
      ));
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }, []); // No deps: uses chatsRef.current

  // Send typing status
  const sendTyping = useCallback(async (chatId: string) => {
    const chat = chatsRef.current.find(c => c.id === chatId);
    if (!chat) return;
    try {
      await chatService.sendTypingStatus(chatId, chat.type);
    } catch (error) {
      console.error('Failed to send typing status:', error);
    }
  }, []); // No deps: uses chatsRef.current

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!activeChat) return;

    try {
      await chatService.deleteMessage(activeChat.id, activeChat.type, messageId);
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
      await chatService.editMessage(activeChat.id, activeChat.type, messageId, newContent);
      setMessages(prev => prev.map(message =>
        message.id === messageId ? { ...message, content: newContent, editedAt: new Date().toISOString() } : message
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

  // Update group name
  const updateGroupName = useCallback(async (chatId: string, newName: string) => {
    try {
      await chatService.updateGroupName(chatId, newName);
      setChats(prev => prev.map(chat =>
        chat.id === chatId ? { ...chat, name: newName } : chat
      ));
      if (activeChat?.id === chatId) {
        setActiveChat(prev => prev ? { ...prev, name: newName } : null);
      }
      toast({
        title: 'Success',
        description: 'Group name updated',
      });
    } catch (error) {
      console.error('Failed to update group name:', error);
      toast({
        title: 'Error',
        description: 'Failed to update group name',
        variant: 'destructive',
      });
    }
  }, [activeChat, toast]);

  // Delete group
  const deleteGroup = useCallback(async (chatId: string) => {
    try {
      await chatService.deleteGroup(chatId);
      setChats(prev => prev.filter(chat => chat.id !== chatId));
      if (activeChat?.id === chatId) {
        setActiveChat(null);
      }
      toast({
        title: 'Success',
        description: 'Group deleted',
      });
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete group',
        variant: 'destructive',
      });
    }
  }, [activeChat, toast]);

  // Add participants
  const addParticipants = useCallback(async (chatId: string, userIds: string[]) => {
    try {
      await chatService.addParticipants(chatId, userIds);
      loadChats(); // Reload to get updated member list
      toast({
        title: 'Success',
        description: `Added ${userIds.length} members`,
      });
    } catch (error) {
      console.error('Failed to add participants:', error);
      toast({
        title: 'Error',
        description: 'Failed to add participants',
        variant: 'destructive',
      });
    }
  }, [loadChats, toast]);

  // Remove participants
  const removeParticipants = useCallback(async (chatId: string, userIds: string[]) => {
    try {
      await chatService.removeParticipant(chatId, userIds);

      // Update local state for chats list
      setChats(prev => prev.map(chat =>
        chat.id === chatId
          ? { ...chat, participants: chat.participants.filter(p => !userIds.includes(p.userId)), memberCount: (chat.memberCount || 0) - userIds.length }
          : chat
      ));

      // Update active chat if it matches to ensure immediate UI feedback
      if (activeChat?.id === chatId) {
        setActiveChat(prev => prev ? {
          ...prev,
          participants: prev.participants.filter(p => !userIds.includes(p.userId)),
          memberCount: (prev.memberCount || 0) - userIds.length
        } : null);
      }

      toast({
        title: 'Success',
        description: `Removed ${userIds.length} member(s)`,
      });
    } catch (error) {
      console.error('Failed to remove participants:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove participants',
        variant: 'destructive',
      });
    }
  }, [activeChat, toast]);

  // Handle active chat change
  const handleSetActiveChat = useCallback((chat: Chat | null) => {
    // Prevent redundant state updates if same chat is selected
    if (activeChat?.id === chat?.id && messages.length > 0) return;

    setActiveChat(chat);
    if (chat) {
      loadMessages(chat.id, chat.type);
    } else {
      setMessages([]);
    }
  }, [loadMessages, activeChat, messages.length]);

  // Refs for polling to avoid interval restarts
  const activeChatRef = React.useRef<Chat | null>(null);
  const loadChatsRef = React.useRef(loadChats);
  const loadMessagesRef = React.useRef(loadMessages);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    loadChatsRef.current = loadChats;
  }, [loadChats]);

  useEffect(() => {
    loadMessagesRef.current = loadMessages;
  }, [loadMessages]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (user) {
      // Initial load
      loadChats();
      loadAvailableUsers(); // Load users once on mount — no need to poll this

      // Stable polling: only chats + active messages, not users
      intervalId = setInterval(() => {
        // Use refs to call the latest version of functions without restarting the interval
        if (loadChatsRef.current) {
          loadChatsRef.current(true);
        }

        const currentActive = activeChatRef.current;
        if (currentActive && loadMessagesRef.current) {
          loadMessagesRef.current(currentActive.id, currentActive.type, true);
        }
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]); // Only restart if user changes — loadChats/loadAvailableUsers captured via refs

  const value = {
    chats,
    activeChat,
    messages,
    availableUsers,
    isLoading,
    unreadCount,
    setActiveChat: handleSetActiveChat,
    sendMessage,
    sendMessageWithFile,
    createChat,
    loadChats,
    loadMessages,
    loadAvailableUsers,
    markAsRead,
    deleteMessage,
    editMessage,
    sendTyping,
    updateGroupName,
    deleteGroup,
    addParticipants,
    removeParticipants,
    isLightboxOpen,
    setIsLightboxOpen
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