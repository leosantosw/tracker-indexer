'use strict';

const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

const generateKey = () => randomBytes(KEY_BYTES).toString('base64');

function parseKey(raw) {
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error('SECRETS_KEY invalida: precisa de 32 bytes em base64 ou hex (gere com: npm run keygen)');
  }
  return key;
}

const encode = (buffer) => buffer.toString('base64url');
const decode = (text) => Buffer.from(text, 'base64url');

/**
 * AES-256-GCM with a fresh IV per value. `context` is bound as associated
 * data, so a ciphertext copied into another field fails to decrypt.
 * Returns null without a key: callers treat secrets as read-only then.
 */
function createCipher(rawKey) {
  if (!rawKey) return null;
  const key = parseKey(rawKey);

  function encrypt(plaintext, context) {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(Buffer.from(context));
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [VERSION, encode(iv), encode(cipher.getAuthTag()), encode(data)].join('.');
  }

  function decrypt(payload, context) {
    const [version, iv, tag, data] = String(payload).split('.');
    if (version !== VERSION || !iv || !tag || data === undefined) throw new Error('formato de segredo desconhecido');

    const decipher = createDecipheriv(ALGORITHM, key, decode(iv), { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(decode(tag));
    return Buffer.concat([decipher.update(decode(data)), decipher.final()]).toString('utf8');
  }

  return { encrypt, decrypt };
}

module.exports = { createCipher, generateKey };
