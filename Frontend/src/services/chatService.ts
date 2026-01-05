import { Chat, ChatMessage, CreateChatRequest, User, UserRole } from '@/types';
import CHAT_CONFIG from '@/config/chat';

const { API_BASE_URL } = CHAT_CONFIG;

class ChatService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // Helper to convert Unix timestamp (seconds) to ISO string
  private formatTimestamp(timestamp: number | string | null): string {
    if (!timestamp) return new Date().toISOString();

    // If it's a number (likely seconds like 1766360581), convert to ms
    if (typeof timestamp === 'number') {
      if (timestamp < 10000000000) {
        return new Date(timestamp * 1000).toISOString();
      }
      return new Date(timestamp).toISOString();
    }

    if (typeof timestamp === 'string' && !isNaN(Number(timestamp))) {
      const num = Number(timestamp);
      if (num < 10000000000) return new Date(num * 1000).toISOString();
      return new Date(num).toISOString();
    }

    return new Date(timestamp).toISOString();
  }

  // Get all chat sessions
  async getChats(): Promise<Chat[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/chats/sessions`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Failed to fetch chats');

      const data = await response.json();

      return data.map((session: any) => ({
        id: session.chat_id?.toString(),
        name: session.name || '',
        type: session.chat_type === 'private' ? 'individual' : 'group',
        participants: (session.members || []).map((m: any) => ({
          userId: m.user_id?.toString(),
          userName: m.name || '',
          userRole: m.role as UserRole,
          joinedAt: this.formatTimestamp(m.joined_at),
          isOnline: false,
        })),
        createdBy: session.created_by_id?.toString(),
        createdAt: this.formatTimestamp(session.created_at),
        updatedAt: this.formatTimestamp(session.last_message_at || session.created_at),
        unreadCount: 0,
        isActive: true,
        memberCount: session.member_count,
        lastMessage: session.last_message_at ? {
          id: '',
          chatId: session.chat_id?.toString(),
          timestamp: this.formatTimestamp(session.last_message_at),
          content: 'Active recently',
          senderId: '',
          senderName: '',
          senderRole: 'employee',
          messageType: 'text',
          isRead: true
        } : undefined
      }));
    } catch (error) {
      console.error('Error fetching chats:', error);
      return [];
    }
  }

  // Get messages for a specific chat
  async getChatMessages(chatId: string, chatType: 'individual' | 'group', page: number = 1, limit: number = 50): Promise<ChatMessage[]> {
    const typePath = chatType === 'individual' ? 'private' : 'group';
    try {
      const response = await fetch(
        `${API_BASE_URL}/chats/${typePath}/${chatId}/messages?limit=${limit}`,
        { headers: this.getAuthHeaders() }
      );

      if (!response.ok) throw new Error('Failed to fetch messages');

      const data = await response.json();

      return data.map((msg: any) => ({
        id: msg.id?.toString(),
        chatId: chatId,
        senderId: msg.sender_id?.toString(),
        senderName: '',
        senderRole: 'employee',
        content: msg.content,
        messageType: 'text',
        timestamp: this.formatTimestamp(msg.timestamp),
        isRead: (msg.read_by || []).length > 1,
        replyTo: undefined
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  // Send a message
  async sendMessage(chatId: string, chatType: 'individual' | 'group', content: string, messageType: 'text' | 'emoji' = 'text', replyTo?: string): Promise<ChatMessage> {
    const typePath = chatType === 'individual' ? 'private' : 'group';
    try {
      const response = await fetch(`${API_BASE_URL}/chats/${typePath}/${chatId}/messages`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          chat_type: typePath,
          chat_id: chatId,
          content,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      return {
        id: data.id?.toString(),
        chatId: chatId,
        senderId: data.sender_id?.toString(),
        senderName: 'Me',
        senderRole: 'employee',
        content: data.content,
        messageType: 'text',
        timestamp: this.formatTimestamp(data.timestamp),
        isRead: false,
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Create a new chat
  async createChat(chatData: CreateChatRequest): Promise<Chat> {
    try {
      let url = '';
      let body: any = {};

      if (chatData.type === 'individual') {
        const userId = chatData.participantIds[0];
        url = `${API_BASE_URL}/chats/private/${userId}`;
        body = { user_id: parseInt(userId) };
      } else {
        url = `${API_BASE_URL}/chats/group`;
        body = {
          name: chatData.name,
          member_ids: chatData.participantIds.map(id => parseInt(id))
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to create chat');
      const data = await response.json();

      const newId = (data.chat_id || data.group_id)?.toString();

      // Attempt to populate participants so name resolution works immediately
      const participants = chatData.participantIds.map(id => ({
        userId: id.toString(),
        userName: '',
        userRole: 'employee' as UserRole,
        joinedAt: new Date().toISOString(),
        isOnline: false
      }));

      return {
        id: newId,
        name: chatData.name || '',
        type: chatData.type,
        participants: participants,
        createdBy: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unreadCount: 0,
        isActive: true,
        memberCount: chatData.participantIds.length + 1,
      } as Chat;

    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  // Get available users
  async getAvailableUsers(): Promise<User[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/chats/users`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();

      return data.map((u: any) => ({
        id: u.user_id?.toString(),
        name: u.name,
        email: u.email,
        role: (u.role?.toLowerCase().replace(' ', '') || 'employee') as UserRole,
        department: 'N/A',
        designation: u.role || 'N/A',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  // Mark message as read
  async markMessageAsRead(chatId: string, chatType: 'individual' | 'group', messageId: string): Promise<void> {
    const typePath = chatType === 'individual' ? 'private' : 'group';
    try {
      await fetch(`${API_BASE_URL}/chats/${typePath}/${chatId}/messages/${messageId}/read`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          chat_type: typePath,
          chat_id: chatId,
          msg_id: messageId
        })
      });
    } catch (error) {
      console.error('Error marking read:', error);
    }
  }

  // Send typing status
  async sendTypingStatus(chatId: string, chatType: 'individual' | 'group'): Promise<void> {
    const typePath = chatType === 'individual' ? 'private' : 'group';
    try {
      await fetch(`${API_BASE_URL}/chats/${typePath}/${chatId}/typing`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          chat_type: typePath,
          chat_id: chatId,
          is_typing: true
        })
      });
    } catch (error) {
      console.error('Error sending typing:', error);
    }
  }

  async addParticipants(chatId: string, userIds: string[]): Promise<void> {
    try {
      for (const uid of userIds) {
        await fetch(`${API_BASE_URL}/chats/group/${chatId}/members/add`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ user_id: parseInt(uid) })
        });
      }
    } catch (error) {
      console.error('Error adding participant:', error);
      throw error;
    }
  }

  async removeParticipant(chatId: string, userId: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/chats/group/${chatId}/members/remove`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ user_id: parseInt(userId) })
      });
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  getChatPermissions(userRole: UserRole) {
    const canCreateGroup = ['admin', 'hr', 'manager'].includes(userRole);
    return {
      canCreateGroups: canCreateGroup,
      canChatWith: ['admin', 'hr', 'manager', 'team_lead', 'employee'] as UserRole[],
      canViewUsers: ['admin', 'hr', 'manager', 'team_lead', 'employee'] as UserRole[],
    };
  }

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    console.warn('Delete message not supported by current API');
  }

  async editMessage(chatId: string, messageId: string, newContent: string): Promise<ChatMessage> {
    throw new Error('Edit not supported');
  }
}

export const chatService = new ChatService();