import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ollive Chat',
  description: 'LLM Chatbot with Inference Logging',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen flex flex-col overflow-hidden">
        {children}
      </body>
    </html>
  );
}
