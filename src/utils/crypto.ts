/**
 * AES-256-GCM encryption/decryption via the WebCrypto API.
 *
 * File format:
 *   [version: 1 byte][salt: 16 bytes][iv: 12 bytes][ciphertext: remaining bytes]
 *
 * Uses PBKDF2 with 600,000 iterations for key derivation.
 * No third-party dependencies — WebCrypto only.
 */

import type { TaxInput } from '../engine/types';

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const VERSION = 0x01;

export class EncryptedFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptedFileError';
  }
}

/**
 * Derive an AES-256-GCM key from a password using PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a TaxInput object with a password.
 * Returns a Uint8Array in the format: [version][salt][iv][ciphertext]
 */
export async function encryptTaxInput(input: TaxInput, password: string): Promise<Uint8Array<ArrayBuffer>> {
  const plaintext = new TextEncoder().encode(JSON.stringify(input));

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext,
  );

  // Assemble: [version 1B][salt 16B][iv 12B][ciphertext...]
  const result = new Uint8Array(1 + SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  result[0] = VERSION;
  result.set(salt, 1);
  result.set(iv, 1 + SALT_LENGTH);
  result.set(new Uint8Array(ciphertext), 1 + SALT_LENGTH + IV_LENGTH);

  return result;
}

/**
 * Decrypt a Uint8Array back into a TaxInput object.
 * Throws EncryptedFileError on wrong password, corrupt file, or version mismatch.
 */
export async function decryptTaxInput(data: Uint8Array<ArrayBuffer>, password: string): Promise<TaxInput> {
  const minLength = 1 + SALT_LENGTH + IV_LENGTH + 1; // At least 1 byte of ciphertext
  if (data.byteLength < minLength) {
    throw new EncryptedFileError('File is too short to be a valid encrypted file');
  }

  const version = data[0];
  if (version !== VERSION) {
    throw new EncryptedFileError(
      `Unsupported file version: ${version}. Expected version ${VERSION}.`,
    );
  }

  const salt = data.slice(1, 1 + SALT_LENGTH);
  const iv = data.slice(1 + SALT_LENGTH, 1 + SALT_LENGTH + IV_LENGTH);
  const ciphertext = data.slice(1 + SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext,
    );
  } catch {
    throw new EncryptedFileError('Decryption failed — wrong password or corrupt file');
  }

  const json = new TextDecoder().decode(plaintext);

  try {
    const parsed: unknown = JSON.parse(json);
    // Basic validation: ensure it has the expected shape
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      !('taxYear' in parsed) ||
      !('filingStatus' in parsed)
    ) {
      throw new EncryptedFileError('Decrypted data is not a valid tax return');
    }
    return parsed as TaxInput;
  } catch (err) {
    if (err instanceof EncryptedFileError) throw err;
    throw new EncryptedFileError('Decrypted data is not valid JSON');
  }
}
