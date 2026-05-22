import { createConversation, getConversation } from '../lib/api';
import ChatInterface from '../components/ChatInterface';

export default async function ChatPage() {
  // Create a new conversation on page load
  let conversation;
  try {
    conversation = await createConversation();
  } catch {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 font-medium">Failed to create conversation</p>
          <p className="text-gray-500 text-sm mt-1">Please check that the API server is running</p>
        </div>
      </div>
    );
  }

  // Load conversation with messages (should be empty for new conversation)
  let conversationWithMessages;
  try {
    conversationWithMessages = await getConversation(conversation.id);
  } catch {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 font-medium">Failed to load conversation</p>
          <p className="text-gray-500 text-sm mt-1">Please try again</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {conversation.title || 'New Conversation'}
            </h1>
            <p className="text-xs text-gray-500">
              Using Cerebras • gpt-oss-120b
            </p>
          </div>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface
          conversationId={conversation.id}
          initialMessages={conversationWithMessages.messages || []}
        />
      </div>
    </main>
  );
}
