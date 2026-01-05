import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ChatList from './ChatList';
import ChatBox from './ChatBox';
import ErrorBoundary from '@/components/ErrorBoundary';

const Chat: React.FC = () => {
  return (
    <ErrorBoundary>
      <div className="h-full">
        <Routes>
          <Route path="/" element={<ChatList />} />
          <Route path="/:chatId" element={<ChatBox />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
};

export default Chat;