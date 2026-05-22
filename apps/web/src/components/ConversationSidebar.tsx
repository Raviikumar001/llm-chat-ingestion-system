'use client';

import { useState, useEffect } from 'react';
import { listConversations } from '../lib/api';

interface Conversation {
  id: string;
  title: string | null;
  status: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  messageCount: number;
}

export default function ConversationSidebar({
  currentConversationId,
  onSelectConversation,
  onCreateConversation,
  refreshKey,
}: {
  currentConversationId: string;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void;
  refreshKey: number;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, [refreshKey]);

  async function loadConversations() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await listConversations();
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-64 bg-white border-r h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900">Conversations</h2>
          <button
            onClick={onCreateConversation}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            New
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
        )}

        {error && (
          <div className="p-4">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={loadConversations}
              className="text-blue-600 text-xs underline mt-1"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && conversations.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            No conversations yet
          </div>
        )}

        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            className={`w-full text-left p-3 border-b hover:bg-gray-50 transition-colors ${
              conv.id === currentConversationId ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
            }`}
          >
            <p className="font-medium text-sm text-gray-900 truncate">
              {conv.title || 'Untitled Conversation'}
            </p>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {conv.lastMessagePreview || 'No messages yet'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
