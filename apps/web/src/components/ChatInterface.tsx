'use client';

import { useState, useRef, useEffect } from 'react';
import { sendMessageWithOptions } from '../lib/api';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  status: string;
  sequenceNumber: number;
}

export default function ChatInterface({
  conversationId,
  initialMessages,
  onNewMessage,
  provider,
  model,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  onNewMessage?: () => void;
  provider: 'cerebras' | 'gemini';
  model: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        content: 'Thinking...',
        status: 'partial',
        sequenceNumber: userMessage.sequenceNumber + 1,
      };

      setMessages((prev) => [...prev.filter((m) => m.id !== userMessage.id), userMessage, tempAssistantMessage]);

      const result = await sendMessageWithOptions(
        conversationId,
        userMessage.content,
        provider,
        model
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantMessageId
            ? {
                ...m,
                id: result.message.id,
                content: result.message.content,
                status: result.message.status,
                sequenceNumber: result.message.sequenceNumber,
              }
            : m
        )
      );
      await Promise.resolve(onNewMessage?.());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantMessageId
            ? { ...m, content: '', status: 'failed' }
            : m
        )
      );
      await Promise.resolve(onNewMessage?.());
    } finally {
      setIsLoading(false);
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

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg font-medium">Start a conversation</p>
            <p className="text-sm mt-1">Send a message to begin chatting</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.status === 'partial'
                  ? 'bg-gray-100 text-gray-900 border border-gray-300'
                  : 'bg-white text-gray-900 border border-gray-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{getMessageContent(message)}</p>
              {message.status === 'partial' && (
                <div className="flex items-center space-x-1 mt-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              )}
              {message.role === 'assistant' && message.status === 'failed' && (
                <p className="mt-2 text-xs text-red-600">Model request failed</p>
              )}
              {message.role === 'assistant' && message.status === 'cancelled' && (
                <p className="mt-2 text-xs text-gray-500">Generation cancelled</p>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mx-4">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 text-xs underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="flex items-end space-x-2 max-w-4xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="rounded-lg px-4 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
