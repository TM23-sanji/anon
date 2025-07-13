'use client';

import { useState, useEffect } from 'react';
import { Send, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  senderName: string;
  messageText: string;
  createdAt: string;
}

export default function HomePage() {
  const [myAnonCode, setMyAnonCode] = useState('');
  const [inboxMessages, setInboxMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [sendInput, setSendInput] = useState('');
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [lastSentTime, setLastSentTime] = useState<number>(0);

  const isRateLimited = () => {
    const now = Date.now();
    return (now - lastSentTime) < 5000; // 5 second client-side cooldown
  };

  async function handleFetchMessages() {
    if (!myAnonCode.trim()) {
      setError('Please enter your Anon Code.');
      return;
    }

    setIsFetching(true);
    setError(null);

    try {
      const res = await fetch(`/api/fetch-message?anonCode=${encodeURIComponent(myAnonCode.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setInboxMessages(data.messages);
        setError(null);
      } else {
        setError(data.error ?? 'Failed to fetch messages');
      }
    } catch {
      setError('Error fetching messages');
    } finally {
      setIsFetching(false);
    }
  }

  // Auto-clear status/error after 3 seconds
  useEffect(() => {
    if (sendStatus || error) {
      const timer = setTimeout(() => {
        setSendStatus(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [sendStatus, error]);

  async function handleSend() {
    setSendStatus(null);
    setError(null);

    if (isRateLimited()) {
      setError('You are sending too quickly. Please wait a few seconds.');
      return;
    }

    const trimmed = sendInput.trim();
    const parts = trimmed.match(/^@(\S+)\s+@(\S+)\s+(.+)$/);

    if (!parts) {
      setError('Format: @recipient @sender message');
      return;
    }

    const [, recipientAnonCode, senderUsername, messageContent] = parts;

    // Validate lengths
    if (senderUsername.length > 50) {
      setError('Sender name too long (max 50 characters)');
      return;
    }

    if (messageContent.length > 500) {
      setError('Message too long (max 500 characters)');
      return;
    }

    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientAnonCode,
          senderName: senderUsername,
          messageContent,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSendStatus('Message sent!');
        setSendInput('');
        setLastSentTime(Date.now());
      } else {
        setError(data.error ?? 'Failed to send');
      }
    } catch {
      setError('Error sending message');
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100">
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 pb-24">

        {/* Anon Code Input with Search */}
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={myAnonCode}
              onChange={(e) => setMyAnonCode(e.target.value)}
              placeholder="eg: agentX (your anon code)"
              className="flex-1 border border-stone-300 dark:border-stone-700 rounded-lg px-3 py-2 bg-stone-100 dark:bg-stone-800 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <button
              onClick={handleFetchMessages}
              disabled={isFetching}
              className="text-white rounded-lg p-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Inbox */}
        {myAnonCode && (
          <section className="mb-16">
            {error && <p className="text-red-500 mb-2">{error}</p>}
            {inboxMessages.length === 0 && !error && (
              <p className="text-stone-500 dark:text-stone-400">No messages yet. Share your code to receive some!</p>
            )}
            <div className="space-y-3">
              {inboxMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className="bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg p-4 shadow-sm transition"
                >
                  <p className="font-semibold text-stone-700 dark:text-stone-200">
                    <span className="text-stone-500">From:</span> {msg.senderName}
                  </p>
                  <p className="mt-1 text-stone-800 dark:text-stone-100">{msg.messageText}</p>
                  <p className="text-xs text-stone-500 mt-2">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Fixed single-line Send Bar */}
      <footer className="fixed bottom-0 inset-x-0 bg-white dark:bg-stone-900 border-t border-stone-300 dark:border-stone-700 shadow-lg px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            type="text"
            placeholder="@receiverCode @senderCode msg"
            value={sendInput}
            onChange={(e) => setSendInput(e.target.value)}
            className="flex-1 border border-stone-300 dark:border-stone-700 rounded-lg px-4 py-2 bg-white dark:bg-stone-800 placeholder-stone-400 dark:placeholder-stone-500 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <button
            onClick={handleSend}
            className="text-white rounded-lg p-2 transition"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {sendStatus && <p className="mt-2 text-green-600 text-sm text-center">{sendStatus}</p>}
        {error && <p className="mt-2 text-red-500 text-sm text-center">{error}</p>}
      </footer>
    </div>
  );
}
