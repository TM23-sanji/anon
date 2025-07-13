import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { encrypt, hashUsername } from '@/lib/crypto';

async function ensureTTL() {
  const db = (await clientPromise).db();
  const collection = db.collection('messages');

  try {
    const indexes = await collection.indexes();
    const ttlIndex = indexes.find(
      idx => idx.key?.createdAt === 1 && idx.name === 'createdAt_1'
    );

    if (!ttlIndex) {
      await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });
    } else if (ttlIndex.expireAfterSeconds !== 86400) {
      await collection.dropIndex('createdAt_1');
      await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });
    }
  } catch (err: any) {
    if (err.codeName === 'NamespaceNotFound') {
      // Collection does not exist yet. Will be created on first insert.
      return;
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  const {
    recipientAnonCode,
    senderName,
    messageContent,
  } = await req.json() as {
    recipientAnonCode?: string;
    senderName?: string;
    messageContent?: string;
  };

  if (!recipientAnonCode || !messageContent) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const db = (await clientPromise).db();
  const recipientHash = hashUsername(recipientAnonCode.toLowerCase());

  await db.collection('messages').insertOne({
    recipientUsernameHash: recipientHash,
    encryptedSenderName: encrypt(senderName?.trim() || 'Anonymous'),
    encryptedMessageContent: encrypt(messageContent),
    createdAt: new Date(),
  });

  // Only after insert (collection now exists) ensure TTL index
  await ensureTTL();

  return NextResponse.json({ message: 'Message sent' }, { status: 201 });
}
