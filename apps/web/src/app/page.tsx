'use client';

import { useState, useEffect, useCallback } from 'react';
import { createConversation, getChatOptions, getConversation, listConversations, type ChatOptionsResponse } from '../lib/api';
import ConversationSidebar from '../components/ConversationSidebar';
import ChatInterface from '../components/ChatInterface';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  status: string;
  sequenceNumber: number;
}

interface BootstrapConversation {
  id: string;
  created: boolean;
}

let bootstrapConversationPromise: Promise<BootstrapConversation> | null = null;

async function getOrCreateInitialConversation(): Promise<BootstrapConversation> {
  const conversations = await listConversations();
  if (conversations.length > 0) {
    return {
      id: conversations[0].id,
      created: false,
    };
  }

  if (!bootstrapConversationPromise) {
    bootstrapConversationPromise = createConversation()
      .then((conversation) => ({
        id: conversation.id,
        created: true,
      }))
      .finally(() => {
        bootstrapConversationPromise = null;
      });
  }

  return bootstrapConversationPromise;
}

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [title, setTitle] = useState<string>('New Conversation');
  const [chatOptions, setChatOptions] = useState<ChatOptionsResponse | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'cerebras' | 'gemini'>('cerebras');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-oss-120b');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

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

  const createAndLoadConversation = useCallback(async () => {
    const conversation = await createConversation();
    await loadConversation(conversation.id);
    setSidebarRefreshKey((current) => current + 1);
  }, [loadConversation]);

  const loadOptions = useCallback(async () => {
    const options = await getChatOptions();
    setChatOptions(options);
    setSelectedProvider(options.defaultProvider);
    setSelectedModel(options.defaultModel);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        await loadOptions();
        const initialConversation = await getOrCreateInitialConversation();
        await loadConversation(initialConversation.id);
        if (initialConversation.created) {
          setSidebarRefreshKey((current) => current + 1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [createAndLoadConversation, loadConversation, loadOptions]);

  const handleSelectConversation = async (id: string) => {
    setIsLoading(true);
    await loadConversation(id);
    setIsLoading(false);
  };

  const handleCreateConversation = async () => {
    setIsLoading(true);
    try {
      await createAndLoadConversation();
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewMessage = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    await loadConversation(conversationId);
    setSidebarRefreshKey((current) => current + 1);
  }, [conversationId, loadConversation]);

  const providerOptions = chatOptions?.providers ?? [];
  const modelOptions =
    providerOptions.find((option) => option.provider === selectedProvider)?.models ?? [selectedModel];

  const handleProviderChange = (provider: 'cerebras' | 'gemini') => {
    setSelectedProvider(provider);
    const nextModel =
      providerOptions.find((option) => option.provider === provider)?.models[0] ?? '';
    setSelectedModel(nextModel);
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
        onCreateConversation={handleCreateConversation}
        refreshKey={sidebarRefreshKey}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
              <p className="text-xs text-gray-500">
                Stable request/response mode
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">
                Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => handleProviderChange(e.target.value as 'cerebras' | 'gemini')}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                {providerOptions.map((option) => (
                  <option key={option.provider} value={option.provider}>
                    {option.provider}
                  </option>
                ))}
              </select>
              <label className="text-xs font-medium text-gray-600">
                Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            conversationId={conversationId}
            initialMessages={messages}
            onNewMessage={handleNewMessage}
            provider={selectedProvider}
            model={selectedModel}
          />
        </div>
      </div>
    </div>
  );
}
