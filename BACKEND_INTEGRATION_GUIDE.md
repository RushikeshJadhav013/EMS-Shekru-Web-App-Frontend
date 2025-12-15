# Backend Integration Guide for Chat Feature

## Quick Setup

To integrate the chat feature with your backend:

1. **Disable Development Mode**
   ```typescript
   // In Frontend/src/config/chat.ts
   export const CHAT_CONFIG = {
     DEVELOPMENT_MODE: false, // Change this to false
     API_BASE_URL: 'http://localhost:8000', // Your backend URL
     // ... other settings
   };
   ```

2. **Implement Required API Endpoints**

### Required Endpoints

#### 1. Get User's Chats
```
GET /chat/chats
Headers: Authorization: Bearer {token}
Response: Chat[]
```

#### 2. Get Chat Messages
```
GET /chat/chats/{chatId}/messages?page=1&limit=50
Headers: Authorization: Bearer {token}
Response: ChatMessage[]
```

#### 3. Send Message
```
POST /chat/chats/{chatId}/messages
Headers: Authorization: Bearer {token}
Body: {
  content: string,
  messageType: 'text' | 'emoji',
  replyTo?: string
}
Response: ChatMessage
```

#### 4. Create Chat
```
POST /chat/chats
Headers: Authorization: Bearer {token}
Body: {
  type: 'individual' | 'group',
  name?: string,
  description?: string,
  participantIds: string[]
}
Response: Chat
```

#### 5. Get Available Users
```
GET /chat/available-users
Headers: Authorization: Bearer {token}
Response: User[]
```

#### 6. Mark Messages as Read
```
POST /chat/chats/{chatId}/mark-read
Headers: Authorization: Bearer {token}
Response: void
```

#### 7. Delete Message
```
DELETE /chat/chats/{chatId}/messages/{messageId}
Headers: Authorization: Bearer {token}
Response: void
```

#### 8. Edit Message
```
PUT /chat/chats/{chatId}/messages/{messageId}
Headers: Authorization: Bearer {token}
Body: { content: string }
Response: ChatMessage
```

### Data Types

Refer to `Frontend/src/types/index.ts` for complete TypeScript definitions:

- `Chat`
- `ChatMessage`
- `ChatParticipant`
- `CreateChatRequest`

### Role-Based Permissions

Implement server-side validation for:
- Who can chat with whom based on roles
- Who can create groups
- Department-based filtering

### Error Handling

Return appropriate HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

### Testing

The frontend includes comprehensive mock data for testing. Once your APIs are ready:

1. Set `DEVELOPMENT_MODE: false` in config
2. Test each endpoint individually
3. Verify role-based permissions
4. Test real-time features (if implemented)

### Optional: Real-time Features

For real-time messaging, implement WebSocket connections:
- Message delivery notifications
- Typing indicators
- Online presence
- Live message updates

The frontend is designed to easily integrate WebSocket functionality when ready.