'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { createCipher, generateKey } = require('../src/lib/secrets');

test('ida e volta, com IV novo a cada cifra', () => {
  const cipher = createCipher(generateKey());
  const a = cipher.encrypt('segredo', 'ctx');
  const b = cipher.encrypt('segredo', 'ctx');

  assert.notEqual(a, b);
  assert.equal(cipher.decrypt(a, 'ctx'), 'segredo');
  assert.equal(cipher.decrypt(b, 'ctx'), 'segredo');
});

test('contexto diferente nao abre', () => {
  const cipher = createCipher(generateKey());
  assert.throws(() => cipher.decrypt(cipher.encrypt('segredo', 'a'), 'b'));
});

test('cifra adulterada nao abre', () => {
  const cipher = createCipher(generateKey());
  const [version, iv, tag, data] = cipher.encrypt('segredo', 'ctx').split('.');
  const flipped = Buffer.from(data, 'base64url');
  flipped[0] ^= 1;

  assert.throws(() => cipher.decrypt([version, iv, tag, flipped.toString('base64url')].join('.'), 'ctx'));
  assert.throws(() => cipher.decrypt([version, iv, tag.slice(0, 8), data].join('.'), 'ctx'));
});

test('outra chave nao abre', () => {
  const payload = createCipher(generateKey()).encrypt('segredo', 'ctx');
  assert.throws(() => createCipher(generateKey()).decrypt(payload, 'ctx'));
});

test('aceita chave em hex e recusa chave curta', () => {
  assert.ok(createCipher('ab'.repeat(32)));
  assert.throws(() => createCipher('curta'), /SECRETS_KEY/);
});

test('sem chave nao ha cifra', () => {
  assert.equal(createCipher(null), null);
});
