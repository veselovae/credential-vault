"use strict";

const ACTION_ICONS = {
  copy: "icons/copy-regular-full.svg",
  delete: "icons/trash-solid-full.svg",
  edit: "icons/pen-to-square-regular-full.svg",
  show: "icons/eye-regular-full.svg",
};

/**
 * Создает текстовый DOM-элемент и опционально назначает ему CSS-класс.
 */
export function createTextElement(tag, text, className) {
  const element = document.createElement(tag);

  element.textContent = text;

  if (className) {
    element.className = className;
  }

  return element;
}

/**
 * Создает иконку для кнопки действия.
 */
function createIcon(iconName) {
  const icon = document.createElement("img");

  icon.src = ACTION_ICONS[iconName];
  icon.alt = "";
  icon.className = "button-icon";
  icon.setAttribute("aria-hidden", "true");

  return icon;
}

/**
 * Обновляет видимую подпись, title и aria-label кнопки.
 */
export function setButtonLabel(button, text, options = {}) {
  button.title = text;
  button.setAttribute("aria-label", text);
  button.replaceChildren();

  if (options.icon) {
    button.append(createIcon(options.icon));
  }

  if (!options.iconOnly) {
    button.append(document.createTextNode(text));
  }
}

/**
 * Создает кнопку с обработчиком клика и стандартным оформлением подписи.
 */
export function createButton(text, className, onClick, options = {}) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = className;
  button.addEventListener("click", onClick);
  setButtonLabel(button, text, options);

  return button;
}

/**
 * Настраивает кнопку показа пароля с иконкой глаза.
 */
export function setShowPasswordButtonLabel(button, text) {
  setButtonLabel(button, text, { icon: "show", iconOnly: true });
}
