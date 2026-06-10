import { Chat, ChatMessage, CreateChatRequest, User, UserRole } from '@/types';
import CHAT_CONFIG from '@/config/chat';
import { apiService } from '@/lib/api';

const { API_BASE_URL } = CHAT_CONFIG;

class ChatService {
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
      const data = await apiService.request('/chats/sessions');

      return data.map((session: any) => ({
        id: session.chat_id?.toString(),
        name: session.name || '',
        type: session.chat_type === 'private' ? 'individual' : 'group',
        participants: (session.members || []).map((m: any) => ({
          userId: m.user_id?.toString(),
          userName: m.name || '',
          userRole: m.role || 'employee',
          isAdmin: m.role === 'admin',
          branch: m.department || 'N/A',
          joinedAt: this.formatTimestamp(m.joined_at),
          isOnline: false,
        })),
        createdBy: session.created_by_id?.toString(),
        createdAt: this.formatTimestamp(session.created_at),
        updatedAt: this.formatTimestamp(session.last_message_at || session.created_at),
        unreadCount: session.unread_count || 0,
        isActive: true,
        memberCount: session.member_count,
        lastMessage: session.last_message ? (() => {
          const lm = session.last_message;
          const rawType = (lm.message_type || lm.type || '').toLowerCase();
          let messageType: ChatMessage['messageType'] = 'text';
          if (rawType === 'image' || rawType === 'photo') messageType = 'image';
          else if (rawType === 'file' || rawType === 'document') messageType = 'file';
          else if (rawType === 'emoji') messageType = 'emoji';

          let content = lm.content || '';
          if (messageType === 'text') {
            if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(content) || content.startsWith('data:image/')) messageType = 'image';
            else if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)(\?.*)?$/i.test(content) || content.startsWith('data:application/')) messageType = 'file';
          }

          return {
            id: lm.id?.toString() || '',
            chatId: session.chat_id?.toString(),
            timestamp: this.formatTimestamp(lm.timestamp || session.last_message_at),
            content,
            senderId: lm.sender_id?.toString() || '',
            senderName: lm.sender_name || '',
            senderRole: 'employee',
            messageType,
            isRead: true
          };
        })() : (session.last_message_at ? {
          id: '',
          chatId: session.chat_id?.toString(),
          timestamp: this.formatTimestamp(session.last_message_at),
          content: '',
          senderId: '',
          senderName: '',
          senderRole: 'employee',
          messageType: 'text',
          isRead: true
        } : undefined)
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
      const data = await apiService.request(`/chats/${typePath}/${chatId}/messages?limit=${limit}`);

      return data.map((msg: any) => {
        const rawType = (msg.message_type || msg.type || '').toLowerCase();
        let messageType: ChatMessage['messageType'] = 'text';
        if (rawType === 'image' || rawType === 'photo') messageType = 'image';
        else if (rawType === 'file' || rawType === 'document' || rawType === 'pdf') messageType = 'file';
        else if (rawType === 'emoji') messageType = 'emoji';

        // Support for new with-file API fields
        const fileUrl = msg.file_url;
        const fileName = msg.file_name;
        const fileType = msg.file_type || rawType;

        // Priority: If it's a file message from the new API, we MUST use file_url as the primary content 
        // for rendering, even if a text 'content' exists as a caption.
        let content: string = fileUrl || msg.content || '';

        if (messageType === 'text') {
          // Check for URL extensions
          if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(content) || (fileType && fileType.startsWith('image/'))) messageType = 'image';
          else if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)(\?.*)?$/i.test(content) || fileUrl) messageType = 'file';
          // Check for Base64 data URLs (embedded media)
          else if (content.startsWith('data:image/')) messageType = 'image';
          else if (content.startsWith('data:application/') || content.includes('|data:application/')) messageType = 'file';
        }

        // If it's a file but not an image, and we have a filename, format it as "name|url" 
        // to maintain compatibility with existing MessageBubble component
        if (messageType === 'file' && fileName && content && !content.includes('|')) {
          content = `${fileName}|${content}`;
        }

        return {
          id: msg.id?.toString(),
          chatId: chatId,
          senderId: msg.sender_id?.toString(),
          senderName: '',
          senderRole: 'employee',
          content,
          messageType,
          timestamp: this.formatTimestamp(msg.timestamp),
          isRead: (msg.read_by || []).length > 1,
          replyTo: msg.reply_to?.toString()
        };
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  // Convert File to Base64 (to send actual data instead of URLs)
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  // Upload a file (now returns Base64 string directly)
  async uploadFile(file: File): Promise<string> {
    return this.fileToBase64(file);
  }

  // Send a message with a file attachment (using FormData)
  async sendMessageWithFile(
    chatId: string,
    chatType: 'individual' | 'group',
    file: File,
    content?: string,
    replyTo?: string
  ): Promise<ChatMessage> {
    const typePath = chatType === 'individual' ? 'private' : 'group';
    try {
      const formData = new FormData();
      formData.append('chat_type', typePath);
      formData.append('chat_id', chatId);
      const isImage = file.type.startsWith('image/');
      formData.append('message_type', isImage ? 'image' : 'file');
      if (content !== undefined) formData.append('content', content || '');
      formData.append('file', file);
      if (replyTo) formData.append('reply_to', replyTo);

      const data = await apiService.request(`/chats/${typePath}/${chatId}/messages/with-file`, {
        method: 'POST',
        body: formData,
      });

      // Map response: prefer file_url for content property if available
      let finalContent = data.file_url || data.content || '';

      const fallbackType = isImage ? 'image' : 'file';
      const resolvedMessageType = (data.file_type || data.message_type || fallbackType).startsWith('image') || (data.file_type || data.message_type || fallbackType).includes('image') ? 'image' : 'file';

      if (resolvedMessageType === 'file' && data.file_name && !finalContent.includes('|')) {
        finalContent = `${data.file_name}|${finalContent}`;
      }

      return {
        id: data.id?.toString(),
        chatId: chatId,
        senderId: data.sender_id?.toString(),
        senderName: 'Me',
        senderRole: 'employee',
        content: finalContent,
        messageType: resolvedMessageType as any,
        timestamp: this.formatTimestamp(data.timestamp),
        isRead: false,
        replyTo: data.reply_to?.toString()
      };
    } catch (error) {
      console.error('Error sending message with file:', error);
      throw error;
    }
  }

  // Send a message
  async sendMessage(
    chatId: string,
    chatType: 'individual' | 'group',
    content: string,
    messageType: 'text' | 'emoji' | 'image' | 'file' = 'text',
    replyTo?: string
  ): Promise<ChatMessage> {
    const typePath = chatType === 'individual' ? 'private' : 'group';
    try {
      const data = await apiService.request(`/chats/${typePath}/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          chat_type: typePath,
          chat_id: chatId,
          content,
          message_type: messageType,
          reply_to: replyTo || null
        }),
      });

      // Resolve messageType: prefer what we sent (we know the type), fallback to backend
      let resolvedType: ChatMessage['messageType'] = messageType;
      const rawType = (data.message_type || data.type || '').toLowerCase();
      if (rawType === 'image' || rawType === 'photo') resolvedType = 'image';
      else if (rawType === 'file' || rawType === 'document') resolvedType = 'file';

      return {
        id: data.id?.toString(),
        chatId: chatId,
        senderId: data.sender_id?.toString(),
        senderName: 'Me',
        senderRole: 'employee',
        content: data.file_url || data.content || content,
        messageType: resolvedType,
        timestamp: this.formatTimestamp(data.timestamp),
        isRead: false,
        replyTo: data.reply_to?.toString()
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Create a new chat
  async createChat(chatData: CreateChatRequest): Promise<Chat> {
    try {
      let endpoint = '';
      let body: any = {};

      if (chatData.type === 'individual') {
        const userId = chatData.participantIds[0];
        endpoint = `/chats/private/${userId}`;
        body = { user_id: userId };
      } else {
        endpoint = '/chats/group';
        body = {
          name: chatData.name,
          member_ids: chatData.participantIds
        };
      }

      const data = await apiService.request(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const newId = (data.chat_id || data.group_id)?.toString();

      // Attempt to populate participants so name resolution works immediately
      // We include the creator (current user) and the target participants
      const participants = [
        ...(chatData.participantIds.map(id => ({
          userId: id.toString(),
          userName: '',
          userRole: 'employee' as UserRole,
          branch: 'N/A', // Added missing branch property to fix lint error
          department: 'N/A',
          joinedAt: new Date().toISOString(),
          isOnline: false
        })))
      ];

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
        memberCount: participants.length + 1,
      } as Chat;

    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  // Get available users
  async getAvailableUsers(): Promise<User[]> {
    try {
      const data = await apiService.request('/chats/users');

      return data.map((u: any) => ({
        id: u.user_id?.toString(),
        name: u.name,
        email: u.email,
        role: (u.role?.toLowerCase().replace(' ', '') || 'employee') as UserRole,
        department: u.department || 'N/A',
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
      await apiService.request(`/chats/${typePath}/${chatId}/messages/${messageId}/read`, {
        method: 'POST',
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
      await apiService.request(`/chats/${typePath}/${chatId}/typing`, {
        method: 'POST',
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
      await apiService.request(`/chats/group/${chatId}/members/bulk_add`, {
        method: 'POST',
        body: JSON.stringify({
          group_id: chatId,
          user_ids: userIds
        })
      });
    } catch (error) {
      console.error('Error adding participants:', error);
      throw error;
    }
  }

  async bulkAddParticipants(chatId: string, userIds: string[]): Promise<void> {
    return this.addParticipants(chatId, userIds);
  }

  async removeParticipant(chatId: string, userId: string | string[]): Promise<void> {
    const userIds = Array.isArray(userId) ? userId : [userId];
    try {
      await apiService.request(`/chats/group/${chatId}/members/bulk_remove`, {
        method: 'POST',
        body: JSON.stringify({
          group_id: chatId,
          user_ids: userIds
        })
      });
    } catch (error) {
      console.error('Error removing participants:', error);
      throw error;
    }
  }

  async bulkRemoveParticipants(chatId: string, userIds: string[]): Promise<void> {
    return this.removeParticipant(chatId, userIds);
  }

  async updateGroupName(chatId: string, newName: string): Promise<void> {
    try {
      await apiService.request(`/chats/group/${chatId}/name`, {
        method: 'PUT',
        body: JSON.stringify({
          group_id: chatId,
          name: newName
        })
      });
    } catch (error) {
      console.error('Error updating group name:', error);
      throw error;
    }
  }

  async deleteGroup(chatId: string): Promise<void> {
    try {
      await apiService.request(`/chats/group/${chatId}`, {
        method: 'DELETE',
        body: JSON.stringify({
          group_id: chatId
        })
      });
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  getChatPermissions(userRole: UserRole) {
    const canCreateGroup = ['admin', 'hr', 'manager'].includes(userRole);
    return {
      canCreateGroups: canCreateGroup,
      canChatWith: ['admin', 'hr', 'manager', 'team_lead', 'employee', 'staff'] as UserRole[],
      canViewUsers: ['admin', 'hr', 'manager', 'team_lead', 'employee', 'staff'] as UserRole[],
    };
  }

  async deleteMessage(chatId: string, chatType: 'individual' | 'group', messageId: string): Promise<void> {
    const typePath = chatType === 'individual' ? 'private' : 'group';
    try {
      await apiService.request(`/chats/${typePath}/${chatId}/messages/${messageId}/delete`, {
        method: 'DELETE',
        body: JSON.stringify({
          chat_type: typePath,
          chat_id: chatId,
          msg_id: messageId,
          content: ""
        })
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  async editMessage(chatId: string, chatType: 'individual' | 'group', messageId: string, newContent: string): Promise<void> {
    const typePath = chatType === 'individual' ? 'private' : 'group';
    try {
      await apiService.request(`/chats/${typePath}/${chatId}/messages/${messageId}/edit`, {
        method: 'PUT',
        body: JSON.stringify({
          chat_type: typePath,
          chat_id: chatId,
          msg_id: messageId,
          content: newContent
        })
      });
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }
}

export const chatService = new ChatService();