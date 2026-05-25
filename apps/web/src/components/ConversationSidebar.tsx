'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { listConversations } from '../lib/api';
import {
  BarChartIcon,
  ChevronDownIcon,
  ClockIcon,
  MessageSquareIcon,
  OlliveMark,
  PlusIcon,
  SearchIcon,
  SidebarIcon,
} from './AppIcons';

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
  isCollapsed,
  onToggleCollapsed,
}: {
  currentConversationId: string;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void;
  refreshKey: number;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');
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

  const filteredConversations = conversations.filter((conversation) => {
    if (!query.trim()) {
      return true;
    }

    const haystack = [
      conversation.title ?? '',
      conversation.lastMessagePreview ?? '',
    ].join(' ').toLowerCase();

    return haystack.includes(query.trim().toLowerCase());
  });

  const formatLastUpdated = (value: string | null) => {
    if (!value) {
      return 'Just created';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Recently updated';
    }

    const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getConversationLabel = (conversation: Conversation) => {
    if (conversation.title?.trim()) {
      return conversation.title;
    }

    return conversation.messageCount === 0 ? 'New chat' : 'Untitled conversation';
  };

  return (
    <aside
      className={`hidden shrink-0 border-r border-white/10 bg-black/55 backdrop-blur xl:flex xl:flex-col ${
        isCollapsed ? 'w-[92px]' : 'w-[290px]'
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-100">
            <OlliveMark className="h-5 w-5" />
          </div>
          <div className={isCollapsed ? 'hidden' : 'block'}>
            <p className="text-sm font-semibold text-zinc-100">Ollive Chat</p>
            <p className="text-xs text-zinc-500">Inference workspace</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:text-zinc-100"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <SidebarIcon className="h-4 w-4" />
        </button>
      </div>

      <div className={`space-y-4 px-4 py-4 ${isCollapsed ? 'hidden' : 'block'}`}>
        <button
          onClick={onCreateConversation}
          className="flex w-full items-center justify-between rounded-2xl bg-zinc-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-700"
        >
          <span className="flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            New chat
          </span>
          <ChevronDownIcon className="h-4 w-4 text-zinc-400" />
        </button>

        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-4 text-sm text-zinc-100 outline-hidden transition placeholder:text-zinc-500 focus:border-zinc-600 focus:bg-white/[0.05]"
          />
        </label>

        <Link
          href="/observability"
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300">
            <BarChartIcon className="h-4 w-4" />
          </span>
          <span>Observability</span>
        </Link>
      </div>

      <div className={`px-4 pb-3 ${isCollapsed ? 'hidden' : 'block'}`}>
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Recent chats
          </p>
          <p className="text-xs text-zinc-600">{conversations.length}</p>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto px-3 pb-4 ${isCollapsed ? 'hidden' : 'block'}`}>
        {isLoading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
            Loading conversations...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-200">Unable to load chats right now.</p>
            <button
              onClick={loadConversations}
              className="mt-2 text-xs font-medium text-red-300 underline underline-offset-4"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && filteredConversations.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-500">
            {query.trim() ? 'No conversations match your search.' : 'No conversations yet.'}
          </div>
        )}

        <div className="space-y-2">
          {filteredConversations.map((conv) => {
            const active = conv.id === currentConversationId;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  active
                    ? 'border-sky-500/40 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.1)]'
                    : 'border-white/5 bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    active ? 'bg-sky-500/15 text-sky-300' : 'bg-white/5 text-zinc-400'
                  }`}>
                    <MessageSquareIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className={`truncate text-sm font-medium ${active ? 'text-white' : 'text-zinc-100'}`}>
                        {getConversationLabel(conv)}
                      </p>
                      <span className="shrink-0 text-[11px] text-zinc-500">
                        {formatLastUpdated(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                      {conv.lastMessagePreview || 'No messages yet'}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
                      <ClockIcon className="h-3.5 w-3.5" />
                      <span>{conv.messageCount} message{conv.messageCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
