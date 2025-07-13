import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { decrypt, hashUsername } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const anonCode = url.searchParams.get('anonCode');

  if (!anonCode) {
    return NextResponse.json({ error: 'Anon code required' }, { status: 400 });
  }

  const db = (await clientPromise).db();
  const anonCodeHash = hashUsername(anonCode.toLowerCase());

  const messages = await db.collection('messages')
    .find({ recipientUsernameHash: anonCodeHash })
    .sort({ createdAt: -1 })
    .toArray();

  const decryptedMessages = messages.map((msg) => ({
    senderName: decrypt(msg.encryptedSenderName),
    messageText: decrypt(msg.encryptedMessageContent),
    createdAt: msg.createdAt
  }));

  return NextResponse.json({ messages: decryptedMessages });
}
