"use strict";

import { PBKDF2_ITERATIONS, SESSION_KEY, STORAGE_KEY } from "./constants.js";
import { state } from "./state.js";
import {
  base64ToBytes,
  bytesToBase64,
  decryptProjects,
  deriveEncryptionKey,
  encryptProjects,
  importEncryptionKey,
} from "./crypto-utils.js";

/**
 * Загружает зашифрованный контейнер vault из постоянного storage.
 */
export async function loadEncryptedContainer() {
  const result = await chrome.storage.local.get(STORAGE_KEY);

  return result[STORAGE_KEY] ?? null;
}

/**
 * Сохраняет ключ расшифровки только в сессионном storage Chrome.
 */
async function saveSessionKey(keyBytes) {
  await chrome.storage.session.set({
    [SESSION_KEY]: bytesToBase64(keyBytes),
  });
}

/**
 * Загружает и импортирует сессионный ключ, если он еще доступен.
 */
async function loadSessionKey() {
  const result = await chrome.storage.session.get(SESSION_KEY);
  const encodedKey = result[SESSION_KEY];

  if (typeof encodedKey !== "string" || encodedKey.length === 0) {
    return null;
  }

  try {
    const keyBytes = base64ToBytes(encodedKey);

    if (keyBytes.byteLength !== 32) {
      throw new Error("Некорректная длина сессионного ключа");
    }

    return importEncryptionKey(keyBytes);
  } catch (error) {
    console.error("Session key import error:", error);

    await clearSessionKey();

    return null;
  }
}

/**
 * Удаляет сессионный ключ из памяти Chrome.
 */
export async function clearSessionKey() {
  await chrome.storage.session.remove(SESSION_KEY);
}

/**
 * Перешифровывает текущие проекты и сохраняет vault.
 */
export async function saveVault() {
  if (!state.encryptionKey) {
    throw new Error("Хранилище заблокировано");
  }

  const oldContainer = await loadEncryptedContainer();

  if (!oldContainer) {
    throw new Error("Контейнер хранилища не найден");
  }

  const salt = base64ToBytes(oldContainer.salt);

  const encryptedContainer = await encryptProjects(
    state.projects,
    state.encryptionKey,
    salt,
    oldContainer.iterations,
  );

  await chrome.storage.local.set({
    [STORAGE_KEY]: encryptedContainer,
  });
}

/**
 * Создает новый пустой vault с мастер-паролем.
 */
export async function createVault(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const { key, keyBytes } = await deriveEncryptionKey(
    password,
    salt,
    PBKDF2_ITERATIONS,
  );

  const encryptedContainer = await encryptProjects(
    [],
    key,
    salt,
    PBKDF2_ITERATIONS,
  );

  await chrome.storage.local.set({
    [STORAGE_KEY]: encryptedContainer,
  });

  await saveSessionKey(keyBytes);

  state.projects = [];
  state.encryptionKey = key;
  state.initialized = true;
}

/**
 * Открывает существующий vault мастер-паролем.
 */
export async function unlockVault(password) {
  const container = await loadEncryptedContainer();

  if (!container) {
    throw new Error("Хранилище не найдено");
  }

  if (
    container.version !== 1 ||
    !container.salt ||
    !container.iv ||
    !container.ciphertext
  ) {
    throw new Error("Формат хранилища поврежден");
  }

  const { key, keyBytes } = await deriveEncryptionKey(
    password,
    base64ToBytes(container.salt),
    container.iterations,
  );

  const projects = await decryptProjects(container, key);

  await saveSessionKey(keyBytes);

  state.projects = projects;
  state.encryptionKey = key;
  state.initialized = true;
}

/**
 * Пытается открыть vault ключом из текущей сессии Chrome.
 */
export async function tryRestoreSession(container) {
  const sessionKey = await loadSessionKey();

  if (!sessionKey) {
    return false;
  }

  try {
    const projects = await decryptProjects(container, sessionKey);

    state.projects = projects;
    state.encryptionKey = sessionKey;
    state.initialized = true;

    return true;
  } catch (error) {
    console.error("Session restore error:", error);

    await clearSessionKey();

    state.projects = [];
    state.encryptionKey = null;

    return false;
  }
}
