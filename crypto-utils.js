"use strict";

/**
 * Преобразует байты в base64-строку для хранения.
 */
export function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

/**
 * Преобразует base64-строку обратно в байты.
 */
export function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

/**
 * Получает 256-битный ключевой материал из мастер-пароля через PBKDF2.
 */
async function deriveKeyBytes(password, salt, iterations) {
  const encoder = new TextEncoder();

  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const keyBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    passwordKey,
    256,
  );

  return new Uint8Array(keyBits);
}

/**
 * Импортирует готовые байты ключа как AES-GCM CryptoKey.
 */
export async function importEncryptionKey(keyBytes) {
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Создает AES-GCM ключ и исходные байты ключа из мастер-пароля.
 */
export async function deriveEncryptionKey(password, salt, iterations) {
  const keyBytes = await deriveKeyBytes(password, salt, iterations);
  const key = await importEncryptionKey(keyBytes);

  return {
    key,
    keyBytes,
  };
}

/**
 * Шифрует список проектов и возвращает контейнер для chrome.storage.
 */
export async function encryptProjects(projects, key, salt, iterations) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const serializedData = JSON.stringify(projects);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encoder.encode(serializedData),
  );

  return {
    version: 1,
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Расшифровывает контейнер и возвращает список проектов.
 */
export async function decryptProjects(container, key) {
  const decoder = new TextDecoder();

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(container.iv),
    },
    key,
    base64ToBytes(container.ciphertext),
  );

  const json = decoder.decode(decrypted);
  const projects = JSON.parse(json);

  if (!Array.isArray(projects)) {
    throw new Error("Некорректный формат хранилища");
  }

  return projects;
}
