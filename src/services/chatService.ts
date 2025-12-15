import { Chat, ChatMessage, CreateChatRequest, User, UserRole } from '@/types';
import { mockChats, mockMessages, mockUsers } from './mockChatData';
import CHAT_CONFIG from '@/config/chat';

const { API_BASE_URL, DEVELOPMENT_MODE, MOCK_API_DELAY } = CHAT_CONFIG;

class ChatService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private async handleApiCall<T>(
    apiCall: () => Promise<Response>,
    fallbackData: T,
    errorMessage: string
  ): Promise<T> {
    if (DEVELOPMENT_MODE) {
      // In development mode, use mock data directly to avoid 404 errors
      return fallbackData;
    }

    try {
      const response = await apiCall();
      
      if (!response.ok) {
        throw new Error(`${errorMessage}: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.warn(`${errorMessage}, using mock data:`, error);
      return fallbackData;
    }
  }

  // Get all chats for the current user
  async getChats(): Promise<Chat[]> {
    return this.handleApiCall(
      () => fetch(`${API_BASE_URL}/chat/chats`, {
        headers: this.getAuthHeaders(),
      }),
      mockChats,
      'Failed to fetch chats'
    );
  }

  // Get messages for a specific chat
  async getChatMessages(chatId: string, page: number = 1, limit: number = 50): Promise<ChatMessage[]> {
    return this.handleApiCall(
      () => fetch(
        `${API_BASE_URL}/chat/chats/${chatId}/messages?page=${page}&limit=${limit}`,
        {
          headers: this.getAuthHeaders(),
        }
      ),
      mockMessages.filter(msg => msg.chatId === chatId),
      'Failed to fetch messages'
    );
  }

  // Send a message
  async sendMessage(chatId: string, content: string, messageType: 'text' | 'emoji' = 'text', replyTo?: string): Promise<ChatMessage> {
    if (DEVELOPMENT_MODE) {
      // Get current user from localStorage
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      
      // Create a mock message for development
      const mockMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        chatId,
        senderId: currentUser?.id || '1', // Use actual current user ID
        senderName: currentUser?.name || 'You',
        senderRole: currentUser?.role || 'admin',
        content,
        messageType,
        timestamp: new Date().toISOString(),
        isRead: true,
        replyTo,
      };
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, MOCK_API_DELAY));
      return mockMessage;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chat/chats/${chatId}/messages`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          content,
          messageType,
          replyTo,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Create a new chat (individual or group)
  async createChat(chatData: CreateChatRequest): Promise<Chat> {
    if (DEVELOPMENT_MODE) {
      // Create a mock chat for development
      const mockChat: Chat = {
        id: `chat-${Date.now()}`,
        name: chatData.name || 'New Chat',
        type: chatData.type,
        participants: chatData.participantIds.map(id => {
          const user = mockUsers.find(u => u.id === id);
          return {
            userId: id,
            userName: user?.name || 'Unknown User',
            userRole: user?.role || 'employee',
            department: user?.department || 'Unknown',
            joinedAt: new Date().toISOString(),
            isOnline: Math.random() > 0.5,
          };
        }),
        createdBy: '1', // Current user ID (mock)
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unreadCount: 0,
        isActive: true,
        description: chatData.description,
      };
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, MOCK_API_DELAY));
      return mockChat;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chat/chats`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(chatData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create chat');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  // Get users that the current user can chat with based on role permissions
  async getAvailableUsers(): Promise<User[]> {
    return this.handleApiCall(
      () => fetch(`${API_BASE_URL}/chat/available-users`, {
        headers: this.getAuthHeaders(),
      }),
      mockUsers,
      'Failed to fetch available users'
    );
  }

  // Mark messages as read
  async markMessagesAsRead(chatId: string): Promise<void> {
    if (DEVELOPMENT_MODE) {
      // In development mode, just return without error
      return Promise.resolve();
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chat/chats/${chatId}/mark-read`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark messages as read');
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
      // Don't throw error for mark as read - it's not critical
    }
  }

  // Delete a message
  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    if (DEVELOPMENT_MODE) {
      // In development mode, just return success
      return Promise.resolve();
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chat/chats/${chatId}/messages/${messageId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  // Edit a message
  async editMessage(chatId: string, messageId: string, newContent: string): Promise<ChatMessage> {
    if (DEVELOPMENT_MODE) {
      // Create a mock edited message for development
      const originalMessage = mockMessages.find(m => m.id === messageId);
      if (originalMessage) {
        return {
          ...originalMessage,
          content: newContent,
          editedAt: new Date().toISOString(),
        };
      }
      throw new Error('Message not found');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chat/chats/${chatId}/messages/${messageId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ content: newContent }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to edit message');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  // Add participants to group chat
  async addParticipants(chatId: string, userIds: string[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/chats/${chatId}/participants`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ userIds }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add participants');
      }
    } catch (error) {
      console.error('Error adding participants:', error);
      throw error;
    }
  }

  // Remove participant from group chat
  async removeParticipant(chatId: string, userId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/chats/${chatId}/participants/${userId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove participant');
      }
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  // Get chat permissions for current user
  getChatPermissions(userRole: UserRole) {
    const permissions = {
      canCreateGroups: ['admin', 'hr', 'manager', 'team_lead'].includes(userRole),
      canChatWith: [] as UserRole[],
      canViewUsers: [] as UserRole[],
    };

    switch (userRole) {
      case 'admin':
        permissions.canChatWith = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
        permissions.canViewUsers = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
        break;
      case 'hr':
        permissions.canChatWith = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
        permissions.canViewUsers = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
        break;
      case 'manager':
        permissions.canChatWith = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
        permissions.canViewUsers = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
        break;
      case 'team_lead':
        permissions.canChatWith = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
        permissions.canViewUsers = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
        break;
      case 'employee':
        permissions.canChatWith = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
        permissions.canViewUsers = ['admin', 'hr', 'manager', 'team_lead', 'employee'];
        break;
    }

    return permissions;
  }
}

export const chatService = new ChatService();