import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  totpCode,
  verifyTotp,
} from './security.mjs';

test('genera TOTP compatible con el vector RFC 6238 de seis cifras', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(totpCode(secret, 59_000), '287082');
  assert.equal(verifyTotp('287082', secret, 59_000), true);
  assert.equal(verifyTotp('000000', secret, 59_000), false);
});

test('los códigos de recuperación se consumen una sola vez', () => {
  const [code] = generateRecoveryCodes(1);
  const stored = JSON.stringify([hashRecoveryCode(code)]);
  const consumed = consumeRecoveryCode(code, stored);
  assert.equal(consumed, '[]');
  assert.equal(consumeRecoveryCode(code, consumed), null);
});
