import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';

const ChatDebug: React.FC = () => {
  const { chatId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { chats, activeChat } = useChat();

  return (
    <div className="p-6 bg-white">
      <h1 className="text-2xl font-bold mb-4">Chat Debug Information</h1>
      
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">URL Information:</h3>
          <p>Current Path: {location.pathname}</p>
          <p>Chat ID from URL: {chatId || 'None'}</p>
        </div>
        
        <div>
          <h3 className="font-semibold">User Information:</h3>
          <p>User Role: {user?.role}</p>
          <p>Expected Chat Base URL: /{user?.role}/chat</p>
        </div>
        
        <div>
          <h3 className="font-semibold">Chat Context:</h3>
          <p>Available Chats: {chats.length}</p>
          <p>Active Chat: {activeChat?.id || 'None'}</p>
        </div>
        
        <div>
          <h3 className="font-semibold">Available Chats:</h3>
          <ul className="list-disc list-inside">
            {chats.map(chat => (
              <li key={chat.id}>
                {chat.id} - {chat.name} ({chat.type})
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ChatDebug;