"use strict";

import { UI_STATE_KEY } from "./constants.js";
import { elements } from "./elements.js";
import { state } from "./state.js";

/**
 * Загружает сохраненный фильтр проекта и позицию скролла списка.
 */
export async function loadUiState() {
  const result = await chrome.storage.local.get(UI_STATE_KEY);
  const uiState = result[UI_STATE_KEY];

  if (!uiState || typeof uiState !== "object") {
    return;
  }

  state.activeProjectId =
    typeof uiState.activeProjectId === "string"
      ? uiState.activeProjectId
      : null;

  state.pendingProjectScrollTop =
    Number.isFinite(uiState.projectScrollTop) && uiState.projectScrollTop > 0
      ? uiState.projectScrollTop
      : 0;
}

/**
 * Сохраняет выбранный фильтр и текущую позицию скролла списка.
 */
export async function saveUiState() {
  try {
    await chrome.storage.local.set({
      [UI_STATE_KEY]: {
        activeProjectId: state.activeProjectId,
        projectScrollTop: elements.projectScroll.scrollTop,
      },
    });
  } catch (error) {
    console.error("UI state save error:", error);
  }
}

/**
 * Восстанавливает скролл списка после того, как проекты отрисованы.
 */
export function restoreProjectScroll() {
  if (state.pendingProjectScrollTop <= 0) {
    return;
  }

  requestAnimationFrame(() => {
    elements.projectScroll.scrollTop = state.pendingProjectScrollTop;
    state.pendingProjectScrollTop = 0;
  });
}

/**
 * Ограничивает частоту вызова функции, пока событие срабатывает часто.
 */
export function debounce(callback, delay) {
  let timerId = null;

  return (...args) => {
    window.clearTimeout(timerId);

    timerId = window.setTimeout(() => {
      callback(...args);
    }, delay);
  };
}
