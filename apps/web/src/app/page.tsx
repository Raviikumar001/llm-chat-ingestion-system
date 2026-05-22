'use client';

import { useState, useEffect, useCallback } from 'react';
import { createConversation, getConversation } from '../lib/api';
import ConversationSidebar from '../components/ConversationSidebar';
import ChatInterface from '../components/ChatInterface';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  status: string;
  sequenceNumber: number;
}

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [title, setTitle] = useState<string>('New Conversation');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const conversation = await getConversation(id);
      setConversationId(conversation.id);
      setTitle(conversation.title || 'Untitled Conversation');
      setMessages(conversation.messages || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const conversation = await createConversation();
        await loadConversation(conversation.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [loadConversation]);

  const handleSelectConversation = async (id: string) => {
    setIsLoading(true);
    await loadConversation(id);
    setIsLoading(false);
  };

  const handleNewMessage = () => {
    // Refresh conversation list in sidebar
    // The sidebar will re-fetch on its own schedule
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <p className="text-gray-500 text-sm mt-1">Please check that the API server is running</p>
        </div>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">No conversation available</div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <ConversationSidebar
        currentConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
              <p className="text-xs text-gray-500">
                Using Cerebras • gpt-oss-120b
              </p>
            </div>
          </div>
        </header>

        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            conversationId={conversationId}
            initialMessages={messages}
            onNewMessage={handleNewMessage}
          />
        </div>
      </div>
    </div>
  );
}
