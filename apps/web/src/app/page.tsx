'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import {
  createConversation,
  getChatOptions,
  getConversation,
  listConversations,
  renameConversation,
  type ChatOptionsResponse,
} from '../lib/api';
import ConversationSidebar from '../components/ConversationSidebar';
import ChatInterface from '../components/ChatInterface';
import {
  BarChartIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  OlliveMark,
  PencilIcon,
  SlidersIcon,
  SparklesIcon,
} from '../components/AppIcons';

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  const getConversationLabel = useCallback((nextTitle: string | null, nextMessages: ChatMessage[]) => {
    if (nextTitle?.trim()) {
      return nextTitle;
    }

    return nextMessages.length === 0 ? 'New chat' : 'Untitled Conversation';
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const conversation = await getConversation(id);
      setConversationId(conversation.id);
      const nextMessages = conversation.messages || [];
      const resolvedTitle = getConversationLabel(conversation.title, nextMessages);
      setTitle(resolvedTitle);
      setDraftTitle(conversation.title?.trim() || resolvedTitle);
      setMessages(nextMessages);
      setIsEditingTitle(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    }
  }, [getConversationLabel]);

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

  const initializeWorkspace = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await loadOptions();
      const initialConversation = await getOrCreateInitialConversation();
      await loadConversation(initialConversation.id);
      if (initialConversation.created) {
        setSidebarRefreshKey((current) => current + 1);
      }
    } catch (err) {
      setConversationId(null);
      setMessages([]);
      setTitle('SignalChat');
      setDraftTitle('SignalChat');
      setError(err instanceof Error ? err.message : 'Failed to initialize');
    } finally {
      setIsLoading(false);
    }
  }, [loadConversation, loadOptions]);

  useEffect(() => {
    void initializeWorkspace();
  }, [initializeWorkspace]);

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

  const handleStartEditingTitle = () => {
    setDraftTitle(title === 'New chat' ? '' : title);
    setIsEditingTitle(true);
  };

  const handleCancelEditingTitle = () => {
    setDraftTitle(title);
    setIsEditingTitle(false);
  };

  const handleSaveTitle = async () => {
    if (!conversationId) {
      return;
    }

    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      setError('Conversation title cannot be empty');
      return;
    }

    try {
      setIsSavingTitle(true);
      const updatedConversation = await renameConversation(conversationId, nextTitle);
      const resolvedTitle = updatedConversation.title || nextTitle;
      setTitle(resolvedTitle);
      setDraftTitle(resolvedTitle);
      setSidebarRefreshKey((current) => current + 1);
      setIsEditingTitle(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename conversation');
    } finally {
      setIsSavingTitle(false);
    }
  };

  if (isLoading && !chatOptions && !conversationId) {
    return (
      <div className="flex h-full bg-[#08090c] text-zinc-100">
        <div className="hidden w-[290px] shrink-0 border-r border-white/10 bg-black/55 xl:flex xl:flex-col" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-white/10 bg-black/35 px-4 py-4">
            <div className="mx-auto h-12 w-full max-w-6xl rounded-2xl bg-white/[0.03]" />
          </div>
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="space-y-4 text-center">
              <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
              <div className="h-4 w-40 animate-pulse rounded-full bg-white/[0.05]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#08090c] text-zinc-100">
      <ConversationSidebar
        currentConversationId={conversationId ?? ''}
        onSelectConversation={handleSelectConversation}
        onCreateConversation={handleCreateConversation}
        refreshKey={sidebarRefreshKey}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((current) => !current)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-white/10 bg-black/35 px-4 py-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((current) => !current)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-100 transition hover:bg-white/[0.06]"
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <OlliveMark className="h-5 w-5" />
              </button>
              <div>
                {conversationId ? (
                  <div className="flex items-center gap-2">
                    {isEditingTitle ? (
                      <>
                        <input
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleSaveTitle();
                            }

                            if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelEditingTitle();
                            }
                          }}
                          className="min-w-[220px] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-lg font-semibold tracking-tight text-white outline-hidden focus:border-white/20"
                          placeholder="Conversation title"
                          maxLength={200}
                          disabled={isSavingTitle}
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveTitle()}
                          disabled={isSavingTitle}
                          className="rounded-full border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
                          aria-label="Save conversation title"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditingTitle}
                          disabled={isSavingTitle}
                          className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                          aria-label="Cancel renaming conversation"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <h1 className="text-lg font-semibold tracking-tight text-white">{title}</h1>
                        <button
                          type="button"
                          onClick={handleStartEditingTitle}
                          className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                          aria-label="Rename conversation"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <ChevronDownIcon className="h-4 w-4 text-zinc-500" />
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold tracking-tight text-white">SignalChat</h1>
                    <ChevronDownIcon className="h-4 w-4 text-zinc-500" />
                  </div>
                )}
                {!error && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Lightweight inference logging workspace
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/observability"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              >
                <BarChartIcon className="h-4 w-4 text-zinc-400" />
                Observability
              </Link>

              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <SparklesIcon className="h-4 w-4 text-zinc-400" />
                <select
                  value={selectedProvider}
                  onChange={(e) => handleProviderChange(e.target.value as 'cerebras' | 'gemini')}
                  className="bg-transparent text-sm font-medium text-zinc-100 outline-hidden"
                >
                  {providerOptions.map((option) => (
                    <option key={option.provider} value={option.provider} className="bg-zinc-900">
                      {option.provider}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <SlidersIcon className="h-4 w-4 text-zinc-400" />
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="max-w-[190px] bg-transparent text-sm font-medium text-zinc-100 outline-hidden"
                >
                  {modelOptions.map((model) => (
                    <option key={model} value={model} className="bg-zinc-900">
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {conversationId ? (
            <ChatInterface
              conversationId={conversationId}
              initialMessages={messages}
              onNewMessage={handleNewMessage}
              provider={selectedProvider}
              model={selectedModel}
              conversationTitle={title}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6">
              <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-white/[0.03] p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] border border-red-500/20 bg-red-500/10 text-red-200">
                  <SparklesIcon className="h-6 w-6" />
                </div>
                <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white">
                  Workspace temporarily unavailable
                </h2>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  We could not load your conversations right now.
                </p>
                <p className="mt-2 text-sm leading-7 text-zinc-500">
                  Start Postgres, then retry the workspace to continue chatting.
                </p>
                <button
                  type="button"
                  onClick={() => void initializeWorkspace()}
                  className="mt-6 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-white"
                >
                  Retry workspace
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
