import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SignalChat',
  description: 'LLM Chatbot with Inference Logging',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ backgroundColor: '#08090c', colorScheme: 'dark' }}>
      <body
        className="h-screen flex flex-col overflow-hidden"
        style={{ backgroundColor: '#08090c', color: '#f4f4f5' }}
      >
        {children}
      </body>
    </html>
  );
}
