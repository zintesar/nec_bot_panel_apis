import * as crypto from 'crypto';

export enum WhatsAppLanguage {
  BN = 'bn',
  HI = 'hi',
  EN = 'en',
}

export interface ExtractedWhatsAppMessage {
  from?: string;
  to?: string;
  sender: string;
  body: string;
  messageId: string;
  timestamp: string;
  type: string;
  name?: string;
  displayPhoneNumber?: string;
  recipient?: string;
  isEcho?: boolean;
}

/**
 * LRU In-memory deduplication cache for WhatsApp message IDs.
 * Meta WhatsApp Cloud API webhooks guarantee at-least-once delivery,
 * which can cause retries and duplicate events.
 */
export class SeenMessageIds {
  private readonly ids: Map<string, null> = new Map();
  private readonly limit: number;

  constructor(limit: number = 500) {
    this.limit = limit;
  }

  remember(messageId: string): boolean {
    if (!messageId) {
      return true;
    }
    if (this.ids.has(messageId)) {
      return false; // Already seen duplicate
    }
    this.ids.set(messageId, null);
    while (this.ids.size > this.limit) {
      const oldestKey = this.ids.keys().next().value;
      if (oldestKey !== undefined) {
        this.ids.delete(oldestKey);
      }
    }
    return true;
  }
}

/**
 * Validates Meta's X-Hub-Signature-256 header using the WhatsApp App Secret.
 * Uses constant-time comparison to protect against timing attacks.
 */
export function isSignatureValid(
  appSecret: string | undefined,
  rawBody: Buffer | string | undefined,
  header: string | undefined,
): boolean {
  if (!appSecret) {
    return true;
  }
  if (!header || !header.startsWith('sha256=')) {
    return false;
  }
  if (!rawBody) {
    return false;
  }

  const expectedSignature = header.slice('sha256='.length);
  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');

  if (expectedSignature.length !== digest.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(digest, 'utf8'),
    );
  } catch {
    return false;
  }
}

/**
 * Detects language based on WhatsApp text content (Bengali, Hindi, or fallback).
 */
export function detectLanguageFromText(text: string): WhatsAppLanguage | null {
  if (!text) {
    return null;
  }
  if (/[\u0980-\u09ff]/.test(text)) {
    return WhatsAppLanguage.BN;
  }
  if (/[\u0900-\u097f]/.test(text)) {
    return WhatsAppLanguage.HI;
  }
  return null;
}

/**
 * Normalizes different WhatsApp webhook structures into a flat list of change objects.
 * Handles standard live webhooks, Meta dashboard sample payloads, and direct objects.
 */
function extractChangesFromPayload(payload: any): any[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  // 1. Standard Meta Webhook payload: payload.entry[].changes[]
  if (payload.entry) {
    const entries = Array.isArray(payload.entry) ? payload.entry : [payload.entry];
    const changes: any[] = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      if (Array.isArray(entry.changes)) {
        changes.push(...entry.changes);
      } else if (entry.changes && typeof entry.changes === 'object') {
        changes.push(entry.changes);
      }
    }

    return changes;
  }

  // 2. Meta Dashboard Sample Webhook payload: payload.sample
  if (payload.sample) {
    return Array.isArray(payload.sample) ? payload.sample : [payload.sample];
  }

  // 3. Direct changes array
  if (Array.isArray(payload.changes)) {
    return payload.changes;
  }

  // 4. Single change or direct payload with value object
  if (payload.value && typeof payload.value === 'object') {
    return [payload];
  }

  return [];
}

/**
 * Builds a fast lookup map for contact names keyed by WhatsApp ID (wa_id).
 */
function buildContactMap(contacts: any): Map<string, string> {
  const contactMap = new Map<string, string>();

  if (!Array.isArray(contacts)) {
    return contactMap;
  }

  for (const contact of contacts) {
    if (contact?.wa_id && contact?.profile?.name) {
      contactMap.set(contact.wa_id, contact.profile.name);
    }
  }

  return contactMap;
}

/**
 * Parses and validates an individual text message object.
 * Returns null if the message is non-text, empty, or invalid.
 */
function parseTextMessageItem(
  rawMsg: any,
  options: {
    displayPhoneNumber: string;
    contactMap: Map<string, string>;
    isEcho: boolean;
  },
): ExtractedWhatsAppMessage | null {
  if (!rawMsg || typeof rawMsg !== 'object' || rawMsg.type !== 'text') {
    return null;
  }

  const { displayPhoneNumber, contactMap, isEcho } = options;

  const sender = String(rawMsg.from || (isEcho ? displayPhoneNumber : '') || '').trim();
  const recipient = rawMsg.to ? String(rawMsg.to).trim() : undefined;
  const body = String(rawMsg.text?.body || '').trim();
  const messageId = String(rawMsg.id || '').trim();
  const timestamp = String(rawMsg.timestamp || Math.floor(Date.now() / 1000));

  // Must have a valid sender and message body
  if (!sender || !body) {
    return null;
  }

  const name =
    contactMap.get(sender) ||
    (recipient ? contactMap.get(recipient) : undefined) ||
    '';

  const extracted: ExtractedWhatsAppMessage = {
    from: sender,
    ...(recipient ? { to: recipient } : {}),
    sender,
    body,
    messageId,
    timestamp,
    type: 'text',
    name,
    displayPhoneNumber,
  };

  if (recipient) {
    extracted.recipient = recipient;
  }

  if (isEcho) {
    extracted.isEcho = true;
  }

  return extracted;
}

/**
 * Safely iterates through WhatsApp webhook entries/changes/messages,
 * including incoming messages and smb_message_echoes,
 * filtering and returning text messages only.
 *
 * Safely ignores statuses (sent/delivered/read) and non-text messages without throwing errors.
 */
export function iterTextMessages(payload: any): ExtractedWhatsAppMessage[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => iterTextMessages(item));
  }


  const messages: ExtractedWhatsAppMessage[] = [];
  const changes = extractChangesFromPayload(payload);

  for (const change of changes) {
    if (!change || typeof change !== 'object') {
      continue;
    }

    const value = change.value || change;
    if (!value || typeof value !== 'object') {
      continue;
    }

    const metadata = value.metadata || {};
    const displayPhoneNumber = metadata.display_phone_number || '';
    const contactMap = buildContactMap(value.contacts);
    const isEchoField = change.field === 'smb_message_echoes';

    // 1. Process regular incoming messages (value.messages)
    const incomingMessages = Array.isArray(value.messages) ? value.messages : [];

    for (const rawMsg of incomingMessages) {
      const parsed = parseTextMessageItem(rawMsg, {
        displayPhoneNumber,
        contactMap,
        isEcho: isEchoField,
      });

      if (parsed) {
        messages.push(parsed);
      }
    }

    // 2. Process SMB message echoes (value.message_echoes)
    const echoMessages = Array.isArray(value.message_echoes) ? value.message_echoes : [];

    for (const rawMsg of echoMessages) {
      const parsed = parseTextMessageItem(rawMsg, {
        displayPhoneNumber,
        contactMap,
        isEcho: true,
      });

      if (parsed) {
        messages.push(parsed);
      }
    }
  }

  return messages;
}
