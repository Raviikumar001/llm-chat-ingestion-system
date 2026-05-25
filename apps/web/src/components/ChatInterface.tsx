'use client';

import { useState, useRef, useEffect } from 'react';
import { cancelConversation, streamMessage } from '../lib/api';
import { MessageSquareIcon, PlusIcon, SendIcon, SparklesIcon } from './AppIcons';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  status: string;
  sequenceNumber: number;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(value: string) {
  const escaped = escapeHtml(value);

  return escaped
    .replace(/`([^`]+)`/g, '<code class="rounded bg-white/10 px-1.5 py-0.5 text-[0.92em] text-zinc-100">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
}

function isMarkdownTableSeparator(line: string) {
  const normalized = line.trim().replace(/\|/g, '').replace(/:/g, '');
  return normalized.length > 0 && /^-+$/.test(normalized);
}

function parseMarkdownTable(block: string) {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  if (!lines[0].includes('|') || !isMarkdownTableSeparator(lines[1])) {
    return null;
  }

  const toCells = (line: string) =>
    line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell, index, array) => !(index === 0 && cell === '') && !(index === array.length - 1 && cell === ''));

  const headers = toCells(lines[0]);
  const rows = lines.slice(2).map(toCells).filter((cells) => cells.length > 0);

  if (headers.length === 0 || rows.some((row) => row.length !== headers.length)) {
    return null;
  }

  return { headers, rows };
}

function renderMarkdownToHtml(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').trim();

  if (!normalized) {
    return '';
  }

  const blocks = normalized.split(/\n{2,}/);
  const htmlBlocks = blocks.map((block) => {
    if (block.startsWith('```') && block.endsWith('```')) {
      const lines = block.split('\n');
      const language = lines[0].slice(3).trim();
      const code = escapeHtml(lines.slice(1, -1).join('\n'));

      return `
        <pre class="overflow-x-auto rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-zinc-100"><code${language ? ` data-language="${escapeHtml(language)}"` : ''}>${code}</code></pre>
      `;
    }

    if (/^###\s+/.test(block)) {
      return `<h3 class="mt-1 text-lg font-semibold text-white">${renderInlineMarkdown(block.replace(/^###\s+/, ''))}</h3>`;
    }

    if (/^##\s+/.test(block)) {
      return `<h2 class="mt-1 text-xl font-semibold text-white">${renderInlineMarkdown(block.replace(/^##\s+/, ''))}</h2>`;
    }

    if (/^#\s+/.test(block)) {
      return `<h1 class="mt-1 text-2xl font-semibold text-white">${renderInlineMarkdown(block.replace(/^#\s+/, ''))}</h1>`;
    }

    const listLines = block.split('\n');
    const table = parseMarkdownTable(block);

    if (table) {
      return `
        <div class="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
          <table class="min-w-full border-collapse text-left text-[14px] leading-6 text-zinc-100">
            <thead class="bg-white/[0.04]">
              <tr>
                ${table.headers
                  .map((header) => `<th class="border-b border-white/10 px-4 py-3 font-semibold text-white">${renderInlineMarkdown(header)}</th>`)
                  .join('')}
              </tr>
            </thead>
            <tbody>
              ${table.rows
                .map(
                  (row) => `
                    <tr class="align-top">
                      ${row
                        .map((cell) => `<td class="border-t border-white/10 px-4 py-3 text-zinc-300">${renderInlineMarkdown(cell)}</td>`)
                        .join('')}
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (listLines.every((line) => /^[-*]\s+/.test(line.trim()))) {
      return `
        <ul class="space-y-2 pl-5 text-[15px] leading-7 text-zinc-100">
          ${listLines
            .map((line) => `<li class="list-disc">${renderInlineMarkdown(line.trim().replace(/^[-*]\s+/, ''))}</li>`)
            .join('')}
        </ul>
      `;
    }

    if (listLines.every((line) => /^\d+\.\s+/.test(line.trim()))) {
      return `
        <ol class="space-y-2 pl-5 text-[15px] leading-7 text-zinc-100">
          ${listLines
            .map((line) => `<li class="list-decimal">${renderInlineMarkdown(line.trim().replace(/^\d+\.\s+/, ''))}</li>`)
            .join('')}
        </ol>
      `;
    }

    const withLineBreaks = renderInlineMarkdown(block).replace(/\n/g, '<br />');
    return `<p class="text-[15px] leading-7 text-zinc-100">${withLineBreaks}</p>`;
  });

  return htmlBlocks.join('');
}

export default function ChatInterface({
  conversationId,
  initialMessages,
  onNewMessage,
  provider,
  model,
  conversationTitle,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  onNewMessage?: () => void;
  provider: 'cerebras' | 'gemini';
  model: string;
  conversationTitle: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isCancellingRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      status: 'completed',
      sequenceNumber: messages.length + 1,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    const tempAssistantMessageId = `temp-assistant-${Date.now()}`;

    try {
      const tempAssistantMessage: ChatMessage = {
        id: tempAssistantMessageId,
        role: 'assistant',
        content: '',
        status: 'partial',
        sequenceNumber: userMessage.sequenceNumber + 1,
      };

      isCancellingRef.current = false;
      setMessages((prev) => [...prev.filter((m) => m.id !== userMessage.id), userMessage, tempAssistantMessage]);

      await streamMessage(
        conversationId,
        userMessage.content,
        provider,
        model
        ,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantMessageId
                ? {
                    ...m,
                    content: `${m.content}${chunk.text}`,
                    status: 'partial',
                  }
                : m
            )
          );
        },
        async (messageId) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantMessageId
                ? {
                    ...m,
                    id: messageId,
                    status: 'completed',
                  }
                : m
            )
          );
          await Promise.resolve(onNewMessage?.());
        },
        async (streamError) => {
          setError(streamError);
        },
        async (messageId) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantMessageId
                ? {
                    ...m,
                    id: messageId ?? m.id,
                    status: 'cancelled',
                  }
                : m
            )
          );
          await Promise.resolve(onNewMessage?.());
        }
      );
    } catch (err) {
      if (!isCancellingRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantMessageId
              ? { ...m, status: 'failed' }
              : m
          )
        );
        await Promise.resolve(onNewMessage?.());
      }
    } finally {
      setIsLoading(false);
      isCancellingRef.current = false;
    }
  };

  const handleCancel = async () => {
    if (!isLoading) {
      return;
    }

    try {
      isCancellingRef.current = true;
      setError(null);
      await cancelConversation(conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel request');
      isCancellingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getMessageContent = (message: ChatMessage) => {
    if (message.content.trim()) {
      return message.content;
    }

    if (message.role === 'assistant' && message.status === 'failed') {
      return 'Response failed. Please try again.';
    }

    if (message.role === 'assistant' && message.status === 'cancelled') {
      return 'Response cancelled.';
    }

    return '';
  };

  const suggestionPrompts = [
    'Summarize what this system logs for each request.',
    'Compare Cerebras and Gemini for this chat app.',
    'Explain the ingestion flow in simple steps.',
  ];

  const renderComposer = (mode: 'floating' | 'docked') => (
    <div className={mode === 'floating' ? 'w-full max-w-[680px]' : 'mx-auto w-full max-w-[860px]'}>
      <div
        className={`rounded-[30px] border border-white/10 bg-zinc-900/90 p-2 shadow-[0_18px_80px_rgba(0,0,0,0.35)] backdrop-blur ${
          mode === 'floating' ? 'ring-1 ring-white/5' : ''
        }`}
      >
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/20 hover:text-white"
            aria-label="Add prompt helper"
          >
            <PlusIcon className="h-4 w-4" />
          </button>

          <div className="min-h-[48px] flex-1 py-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your inference pipeline..."
              rows={1}
              className="max-h-44 min-h-[44px] w-full resize-none bg-transparent px-2 py-2.5 text-[15px] leading-6 text-zinc-100 outline-hidden placeholder:text-zinc-500"
              disabled={isLoading}
            />
          </div>

          <button
            onClick={isLoading ? handleCancel : handleSend}
            disabled={!isLoading && !input.trim()}
            className={`flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-2xl px-3 text-white transition disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500 ${
              isLoading ? 'bg-red-500 hover:bg-red-400' : 'bg-sky-500 hover:bg-sky-400'
            }`}
            aria-label={isLoading ? 'Cancel response' : 'Send message'}
          >
            {isLoading ? (
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">Stop</span>
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <div className="flex min-h-full flex-col items-center justify-center px-6 pb-16 pt-10">
            <div className="max-w-3xl text-center">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.04] text-white">
                <SparklesIcon className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-zinc-500">{conversationTitle}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
                What are you working on?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-zinc-500 md:text-base">
                Ask about architecture, compare providers, or inspect how a single inference flows through your logging pipeline.
              </p>
            </div>

            <div className="mt-10 flex w-full justify-center">
              {renderComposer('floating')}
            </div>

            <div className="mt-5 grid w-full max-w-[920px] grid-cols-1 gap-3 md:grid-cols-3">
              {suggestionPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  disabled={isLoading}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[90%] sm:max-w-[78%] ${
                  message.role === 'assistant' ? 'pl-1' : ''
                }`}
                >
                  {message.role === 'assistant' && (
                    <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                      <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200">
                        <MessageSquareIcon className="h-4 w-4" />
                      </div>
                      Assistant
                    </div>
                  )}

                  <div
                    className={`rounded-[26px] border px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.16)] ${
                      message.role === 'user'
                        ? 'border-sky-400/20 bg-sky-500 text-white'
                        : message.status === 'partial'
                        ? 'border-white/10 bg-white/[0.05] text-zinc-200'
                        : 'border-white/10 bg-white/[0.03] text-zinc-100'
                    }`}
                  >
                  <div
                    className="prose prose-invert max-w-none prose-p:my-0 prose-headings:mb-3 prose-headings:mt-0 prose-ol:my-0 prose-ul:my-0 prose-pre:my-0 prose-code:before:hidden prose-code:after:hidden [&>*+*]:mt-4"
                    dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(getMessageContent(message)) }}
                  />
                    {message.status === 'partial' && (
                      <div className="mt-3 flex items-center space-x-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" />
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    )}
                    {message.role === 'assistant' && message.status === 'partial' && !message.content && (
                      <p className="mt-0 text-[15px] leading-7 text-zinc-400">Thinking…</p>
                    )}
                    {message.role === 'assistant' && message.status === 'failed' && (
                      <p className="mt-3 text-xs text-red-300">Model request failed</p>
                    )}
                    {message.role === 'assistant' && message.status === 'cancelled' && (
                      <p className="mt-3 text-xs text-zinc-500">Generation cancelled</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {error && (
              <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-4">
                <p className="text-sm text-red-200">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-2 text-xs font-medium text-red-300 underline underline-offset-4"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {hasMessages && (
        <div className="border-t border-white/10 bg-black/25 px-4 py-5 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-col gap-3">
            <div className="flex items-center gap-2 px-1 text-xs text-zinc-500">
              <SparklesIcon className="h-3.5 w-3.5" />
              <span>
                Sending with <span className="font-medium text-zinc-300">{provider}</span> / <span className="font-medium text-zinc-300">{model}</span>
              </span>
            </div>
            {renderComposer('docked')}
          </div>
        </div>
      )}
    </div>
  );
}
