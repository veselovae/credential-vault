"use strict";

import { createButton, createTextElement, setShowPasswordButtonLabel } from "./dom.js";
import { elements } from "./elements.js";
import { state } from "./state.js";
import { debounce, loadUiState, restoreProjectScroll, saveUiState } from "./ui-state.js";
import {
  clearSessionKey,
  createVault,
  loadEncryptedContainer,
  saveVault,
  tryRestoreSession,
  unlockVault,
} from "./vault-storage.js";

const saveUiStateDebounced = debounce(saveUiState, 150);
const EXPORT_FORMAT = "credential-vault-export";
const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Блокирует vault и возвращает пользователя на экран ввода пароля.
 */
async function lockVault() {
  try {
    await clearSessionKey();
  } catch (error) {
    console.error("Session clear error:", error);
  }

  state.projects = [];
  state.encryptionKey = null;

  elements.masterPassword.value = "";
  elements.confirmPassword.value = "";
  elements.searchInput.value = "";

  elements.authTitle.textContent = "Открыть хранилище";

  elements.authDescription.textContent =
    "Введите мастер-пароль. До перезапуска Chrome повторный ввод не потребуется.";

  elements.authSubmitButton.textContent = "Разблокировать";

  elements.confirmPasswordField.classList.add("hidden");
  elements.confirmPassword.required = false;

  showAuthScreen();
}

/**
 * Экраны приложения.
 */
/**
 * Показывает экран авторизации.
 */
function showAuthScreen() {
  elements.authScreen.classList.remove("hidden");
  elements.vaultScreen.classList.add("hidden");
  elements.lockButton.classList.add("hidden");

  elements.authError.classList.add("hidden");
  elements.authError.textContent = "";

  elements.masterPassword.focus();
}

/**
 * Показывает основной экран vault и восстанавливает список проектов.
 */
function showVaultScreen() {
  elements.authScreen.classList.add("hidden");
  elements.vaultScreen.classList.remove("hidden");
  elements.lockButton.classList.remove("hidden");

  renderProjects();
  restoreProjectScroll();
}

/**
 * Показывает сообщение об ошибке авторизации.
 */
/**
 * Показывает сообщение об ошибке авторизации.
 */
function showAuthError(message) {
  elements.authError.textContent = message;
  elements.authError.classList.remove("hidden");
}

/**
 * Находит проект по id в текущем состоянии.
 */
function findProject(projectId) {
  return state.projects.find((project) => project.id === projectId);
}

/**
 * Находит credentials по id внутри проекта.
 */
function findCredential(project, credentialId) {
  return project.credentials.find(
    (credential) => credential.id === credentialId,
  );
}

/**
 * Фильтрует проекты.
 */
/**
 * Возвращает проекты с учетом выбранного проекта и поисковой строки.
 */
function getFilteredProjects() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase("ru");
  const sourceProjects = state.activeProjectId
    ? state.projects.filter((project) => project.id === state.activeProjectId)
    : state.projects;

  if (!query) {
    return sourceProjects;
  }

  return sourceProjects
    .map((project) => {
      const projectMatches = project.name
        .toLocaleLowerCase("ru")
        .includes(query);

      const matchingCredentials = project.credentials.filter((credential) => {
        const searchableText = [
          credential.role,
          credential.login,
          credential.url,
          credential.notes,
        ]
          .join(" ")
          .toLocaleLowerCase("ru");

        return searchableText.includes(query);
      });

      if (!projectMatches && matchingCredentials.length === 0) {
        return null;
      }

      return {
        ...project,
        credentials: projectMatches ? project.credentials : matchingCredentials,
      };
    })
    .filter(Boolean);
}

/**
 * Создает кнопку-фильтр для одного проекта или варианта "Все".
 */
function createProjectFilterChip(text, projectId) {
  const isActive = state.activeProjectId === projectId;
  const chip = createButton(
    text,
    `filter-chip${isActive ? " filter-chip-active" : ""}`,
    () => {
      state.activeProjectId = projectId;
      elements.projectScroll.scrollTop = 0;
      saveUiState();
      renderProjects();
    },
  );

  chip.setAttribute("aria-pressed", String(isActive));

  return chip;
}

/**
 * Перерисовывает панель фильтров проектов.
 */
function renderProjectFilters() {
  elements.projectFilters.replaceChildren();

  if (
    state.activeProjectId &&
    !state.projects.some((project) => project.id === state.activeProjectId)
  ) {
    state.activeProjectId = null;
    saveUiState();
  }

  elements.projectFilters.append(createProjectFilterChip("Все", null));

  for (const project of state.projects) {
    elements.projectFilters.append(createProjectFilterChip(project.name, project.id));
  }
}

/**
 * Главный рендер.
 */
/**
 * Перерисовывает список проектов и empty state.
 */
function renderProjects() {
  renderProjectFilters();
  elements.projectList.replaceChildren();

  const projects = getFilteredProjects();

  elements.emptyState.classList.toggle("hidden", projects.length !== 0);

  for (const project of projects) {
    elements.projectList.append(createProjectCard(project));
  }
}

/**
 * Создает карточку проекта со списком credentials и действиями.
 */
function createProjectCard(project) {
  const card = document.createElement("article");
  card.className = "project-card";

  const header = document.createElement("div");
  header.className = "project-header";

  const title = createTextElement("h2", project.name);

  const actions = document.createElement("div");
  actions.className = "project-actions";

  actions.append(
    createButton("Добавить роль", "button button-primary small-button", () =>
      openCredentialDialog(project.id),
    ),
    createButton("Переименовать", "button button-secondary small-button", () =>
      openProjectDialog(project),
    ),
    createButton("Удалить", "button button-danger small-button", () =>
      deleteProject(project.id),
    ),
  );

  header.append(title, actions);
  card.append(header);

  const credentialsList = document.createElement("div");
  credentialsList.className = "credentials-list";

  if (project.credentials.length === 0) {
    credentialsList.append(
      createTextElement("p", "В этом проекте пока нет credentials.", "muted"),
    );
  } else {
    for (const credential of project.credentials) {
      credentialsList.append(createCredentialCard(project, credential));
    }
  }

  card.append(credentialsList);

  return card;
}

/**
 * Создает карточку одной credential-записи.
 */
function createCredentialCard(project, credential) {
  const card = document.createElement("section");
  card.className = "credential-card";

  const header = document.createElement("div");
  header.className = "credential-title";

  const title = createTextElement("h3", credential.role);

  const actions = document.createElement("div");
  actions.className = "credential-actions";

  actions.append(
    createButton(
      "Изменить",
      "button button-secondary small-button icon-action-button",
      () => openCredentialDialog(project.id, credential),
      { icon: "edit", iconOnly: true },
    ),
    createButton(
      "Удалить",
      "button button-danger small-button icon-action-button",
      () => deleteCredential(project.id, credential.id),
      { icon: "delete", iconOnly: true },
    ),
  );

  header.append(title, actions);
  card.append(header);

  const values = document.createElement("dl");

  values.append(
    createValueRow("Логин", credential.login, () =>
      copyToClipboard(credential.login),
    ),
  );

  values.append(createPasswordRow(credential.password));

  if (credential.url) {
    values.append(createUrlRow(credential.url));
  }

  if (credential.notes) {
    values.append(createValueRow("Заметки", credential.notes, null, "notes"));
  }

  card.append(values);

  return card;
}

/**
 * Создает строку значения credential с опциональной кнопкой копирования.
 */
function createValueRow(label, value, copyHandler, valueClassName = "") {
  const row = document.createElement("div");
  row.className = "credential-value";

  const term = createTextElement("dt", label);
  const description = createTextElement("dd", value, valueClassName);

  row.append(term, description);

  if (copyHandler) {
    row.append(
      createButton(
        "Копировать",
        "button button-secondary small-button icon-action-button",
        copyHandler,
        { icon: "copy", iconOnly: true },
      ),
    );
  } else {
    row.append(document.createElement("span"));
  }

  return row;
}

/**
 * Создает строку пароля с кнопками показа и копирования.
 */
function createPasswordRow(password) {
  const row = document.createElement("div");
  row.className = "credential-value";

  const term = createTextElement("dt", "Пароль");
  const description = createTextElement("dd", "••••••••••••", "password-value");

  let visible = false;

  const toggleButton = createButton(
    "Показать",
    "button button-secondary small-button icon-action-button",
    () => {
      visible = !visible;

      description.textContent = visible ? password : "••••••••••••";

      const toggleLabel = visible ? "Скрыть" : "Показать";
      toggleButton.title = toggleLabel;
      toggleButton.setAttribute("aria-label", toggleLabel);
    },
    { icon: "show", iconOnly: true },
  );

  const copyButton = createButton(
    "Копировать",
    "button button-secondary small-button icon-action-button",
    () => copyToClipboard(password),
    { icon: "copy", iconOnly: true },
  );

  const actions = document.createElement("div");
  actions.className = "credential-actions";
  actions.append(toggleButton, copyButton);

  row.append(term, description, actions);

  return row;
}

/**
 * Создает строку URL со ссылкой и кнопкой копирования.
 */
function createUrlRow(url) {
  const row = document.createElement("div");
  row.className = "credential-value";

  const term = createTextElement("dt", "URL");

  const description = document.createElement("dd");
  const link = document.createElement("a");

  link.textContent = url;
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  description.append(link);

  row.append(
    term,
    description,
    createButton(
      "Копировать",
      "button button-secondary small-button icon-action-button",
      () => copyToClipboard(url),
      { icon: "copy", iconOnly: true },
    ),
  );

  return row;
}

/**
 * Копирует значение в буфер обмена.
 */
async function copyToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch (error) {
    console.error("Clipboard error:", error);
    window.alert("Не удалось скопировать значение");
  }
}

/**
 * Экспортирует все проекты и credentials в JSON без шифрования.
 */
function exportCredentials() {
  const confirmed = window.confirm(
    "Экспорт содержит все логины, пароли и заметки в открытом виде. " +
      "Храните полученный JSON-файл в безопасном месте. Продолжить?",
  );

  if (!confirmed) {
    return;
  }

  const exportData = {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: state.projects,
  };
  const file = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = `credential-vault-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Проверяет структуру JSON-файла экспорта до изменения текущего vault.
 */
function validateCredentialImport(data) {
  const isString = (value, maxLength) =>
    typeof value === "string" && value.length <= maxLength;

  if (
    !data ||
    data.format !== EXPORT_FORMAT ||
    data.version !== 1 ||
    !Array.isArray(data.projects)
  ) {
    throw new Error("Файл не является экспортом Credential Vault версии 1");
  }

  for (const project of data.projects) {
    if (
      !project ||
      !isString(project.id, 100) ||
      !isString(project.name, 100) ||
      !project.name.trim() ||
      !Array.isArray(project.credentials)
    ) {
      throw new Error("В файле обнаружен проект с некорректным форматом");
    }

    for (const credential of project.credentials) {
      if (
        !credential ||
        !isString(credential.id, 100) ||
        !isString(credential.role, 100) ||
        !credential.role.trim() ||
        !isString(credential.login, 300) ||
        !credential.login.trim() ||
        !isString(credential.password, 1000) ||
        !credential.password ||
        !isString(credential.url ?? "", 1000) ||
        !isString(credential.notes ?? "", 3000)
      ) {
        throw new Error("В файле обнаружена credential-запись с некорректным форматом");
      }
    }
  }

  return data.projects;
}

/**
 * Объединяет импортированные данные с текущими, не перезаписывая совпадения.
 */
function mergeImportedProjects(currentProjects, importedProjects) {
  const projects = currentProjects.map((project) => ({
    ...project,
    credentials: project.credentials.map((credential) => ({ ...credential })),
  }));
  let addedProjects = 0;
  let addedCredentials = 0;
  let skippedCredentials = 0;

  for (const importedProject of importedProjects) {
    const normalizedName = importedProject.name.trim().toLocaleLowerCase("ru");
    let project = projects.find((item) => item.id === importedProject.id);

    if (!project) {
      project = projects.find(
        (item) =>
          item.name.trim().toLocaleLowerCase("ru") === normalizedName,
      );
    }

    if (!project) {
      project = {
        id: importedProject.id,
        name: importedProject.name,
        credentials: [],
      };
      projects.push(project);
      addedProjects += 1;
    }

    for (const importedCredential of importedProject.credentials) {
      const isDuplicate = project.credentials.some(
        (credential) => credential.id === importedCredential.id,
      );

      if (isDuplicate) {
        skippedCredentials += 1;
        continue;
      }

      project.credentials.push({
        id: importedCredential.id,
        role: importedCredential.role,
        login: importedCredential.login,
        password: importedCredential.password,
        url: importedCredential.url ?? "",
        notes: importedCredential.notes ?? "",
      });
      addedCredentials += 1;
    }
  }

  return { projects, addedProjects, addedCredentials, skippedCredentials };
}

/**
 * Импортирует JSON, объединяя данные с текущими без перезаписи совпадений.
 */
async function importCredentials(file) {
  if (!file) {
    return;
  }

  if (file.size > MAX_IMPORT_FILE_SIZE) {
    throw new Error("Размер файла импорта не должен превышать 10 МБ");
  }

  const importedProjects = validateCredentialImport(
    JSON.parse(await file.text()),
  );
  const mergeResult = mergeImportedProjects(state.projects, importedProjects);

  if (mergeResult.addedCredentials === 0 && mergeResult.addedProjects === 0) {
    window.alert("Новых проектов и credentials не найдено.");
    return;
  }

  const confirmed = window.confirm(
    `Добавить проектов: ${mergeResult.addedProjects}; ` +
      `credentials: ${mergeResult.addedCredentials}. ` +
      `Совпадений, которые останутся без изменений: ${mergeResult.skippedCredentials}. ` +
      "Продолжить?",
  );

  if (!confirmed) {
    return;
  }

  const previousProjects = state.projects;
  state.projects = mergeResult.projects;

  try {
    await saveVault();
  } catch (error) {
    state.projects = previousProjects;
    throw error;
  }

  renderProjects();
  window.alert(
    `Импортировано проектов: ${mergeResult.addedProjects}; ` +
      `credentials: ${mergeResult.addedCredentials}.`,
  );
}

/**
 * Диалог проекта.
 */
/**
 * Открывает диалог создания или редактирования проекта.
 */
function openProjectDialog(project = null) {
  elements.projectForm.reset();

  if (project) {
    elements.projectDialogTitle.textContent = "Редактировать проект";

    elements.projectId.value = project.id;
    elements.projectName.value = project.name;
  } else {
    elements.projectDialogTitle.textContent = "Новый проект";
    elements.projectId.value = "";
  }

  elements.projectDialog.showModal();
  elements.projectName.focus();
}

/**
 * Удаляет проект после подтверждения и сохраняет vault.
 */
async function deleteProject(projectId) {
  const project = findProject(projectId);

  if (!project) {
    return;
  }

  const confirmed = window.confirm(
    `Удалить проект «${project.name}» и все credentials внутри?`,
  );

  if (!confirmed) {
    return;
  }

  state.projects = state.projects.filter((item) => item.id !== projectId);

  await saveVault();
  renderProjects();
}

/**
 * Диалог credentials.
 */
/**
 * Открывает диалог создания или редактирования credential.
 */
function openCredentialDialog(projectId, credential = null) {
  elements.credentialForm.reset();

  elements.credentialProjectId.value = projectId;
  elements.credentialPassword.type = "password";
  setShowPasswordButtonLabel(elements.togglePasswordButton, "Показать");

  if (credential) {
    elements.credentialDialogTitle.textContent = "Редактировать credentials";

    elements.credentialId.value = credential.id;
    elements.credentialRole.value = credential.role;
    elements.credentialLogin.value = credential.login;
    elements.credentialPassword.value = credential.password;
    elements.credentialUrl.value = credential.url;
    elements.credentialNotes.value = credential.notes;
  } else {
    elements.credentialDialogTitle.textContent = "Новые credentials";

    elements.credentialId.value = "";
  }

  elements.credentialDialog.showModal();
  elements.credentialRole.focus();
}

/**
 * Удаляет credential после подтверждения и сохраняет vault.
 */
async function deleteCredential(projectId, credentialId) {
  const project = findProject(projectId);

  if (!project) {
    return;
  }

  const credential = findCredential(project, credentialId);

  if (!credential) {
    return;
  }

  const confirmed = window.confirm(
    `Удалить credentials для роли «${credential.role}»?`,
  );

  if (!confirmed) {
    return;
  }

  project.credentials = project.credentials.filter(
    (item) => item.id !== credentialId,
  );

  await saveVault();
  renderProjects();
}

/**
 * Auth submit.
 */
elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = elements.masterPassword.value;

  elements.authError.classList.add("hidden");
  elements.authSubmitButton.disabled = true;

  try {
    if (!state.initialized) {
      const confirmation = elements.confirmPassword.value;

      if (password.length < 12) {
        throw new Error("Мастер-пароль должен содержать минимум 12 символов");
      }

      if (password !== confirmation) {
        throw new Error("Мастер-пароли не совпадают");
      }

      await createVault(password);
    } else {
      await unlockVault(password);
    }

    elements.masterPassword.value = "";
    elements.confirmPassword.value = "";

    await loadUiState();
    showVaultScreen();
  } catch (error) {
    console.error(error);

    showAuthError(
      state.initialized
        ? "Не удалось открыть хранилище. Проверьте мастер-пароль."
        : error.message,
    );
  } finally {
    elements.authSubmitButton.disabled = false;
  }
});

/**
 * Project submit.
 */
elements.projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = elements.projectName.value.trim();
  const projectId = elements.projectId.value;

  if (!name) {
    return;
  }

  if (projectId) {
    const project = findProject(projectId);

    if (project) {
      project.name = name;
    }
  } else {
    state.projects.push({
      id: crypto.randomUUID(),
      name,
      credentials: [],
    });
  }

  await saveVault();

  elements.projectDialog.close();
  renderProjects();
});

/**
 * Credential submit.
 */
elements.credentialForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const project = findProject(elements.credentialProjectId.value);

  if (!project) {
    window.alert("Проект не найден");
    return;
  }

  const credentialData = {
    role: elements.credentialRole.value.trim(),
    login: elements.credentialLogin.value.trim(),
    password: elements.credentialPassword.value,
    url: elements.credentialUrl.value.trim(),
    notes: elements.credentialNotes.value.trim(),
  };

  if (
    !credentialData.role ||
    !credentialData.login ||
    !credentialData.password
  ) {
    window.alert("Заполните роль, логин и пароль");
    return;
  }

  const credentialId = elements.credentialId.value;

  if (credentialId) {
    const credential = findCredential(project, credentialId);

    if (credential) {
      Object.assign(credential, credentialData);
    }
  } else {
    project.credentials.push({
      id: crypto.randomUUID(),
      ...credentialData,
    });
  }

  await saveVault();

  elements.credentialDialog.close();
  renderProjects();
});

/**
 * Остальные события.
 */
elements.addProjectButton.addEventListener("click", () => {
  openProjectDialog();
});

elements.exportCredentialsButton.addEventListener("click", () => {
  try {
    exportCredentials();
  } catch (error) {
    console.error("Credential export error:", error);
    window.alert("Не удалось экспортировать credentials.");
  }
});

elements.importCredentialsButton.addEventListener("click", () => {
  elements.importCredentialsFile.click();
});

elements.importCredentialsFile.addEventListener("change", async () => {
  const [file] = elements.importCredentialsFile.files;
  elements.importCredentialsFile.value = "";

  try {
    await importCredentials(file);
  } catch (error) {
    console.error("Credential import error:", error);
    window.alert(`Не удалось импортировать файл: ${error.message}`);
  }
});

elements.lockButton.addEventListener("click", lockVault);

elements.searchInput.addEventListener("input", renderProjects);

elements.projectScroll.addEventListener("scroll", saveUiStateDebounced);

window.addEventListener("pagehide", saveUiState);

elements.togglePasswordButton.addEventListener("click", () => {
  const passwordInput = elements.credentialPassword;
  const isPassword = passwordInput.type === "password";

  passwordInput.type = isPassword ? "text" : "password";

  setShowPasswordButtonLabel(
    elements.togglePasswordButton,
    isPassword ? "Скрыть" : "Показать",
  );
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialogId = button.dataset.closeDialog;
    document.querySelector(`#${dialogId}`).close();
  });
});

/**
 * Инициализация.
 */
/**
 * Инициализирует popup: загружает vault, восстанавливает сессию или показывает auth.
 */
async function initialize() {
  try {
    const container = await loadEncryptedContainer();

    state.initialized = Boolean(container);

    /*
     * Если vault уже существует, сначала пробуем открыть его
     * ключом из текущей сессии Chrome.
     */
    if (container) {
      const restored = await tryRestoreSession(container);

      if (restored) {
        await loadUiState();
        showVaultScreen();
        return;
      }
    }

    /*
     * Сессионного ключа нет или он не подошёл.
     * Показываем обычный экран авторизации.
     */
    if (state.initialized) {
      elements.authTitle.textContent = "Открыть хранилище";

      elements.authDescription.textContent =
        "Введите мастер-пароль. До перезапуска Chrome повторный ввод не потребуется.";

      elements.authSubmitButton.textContent = "Разблокировать";

      elements.confirmPasswordField.classList.add("hidden");
      elements.confirmPassword.required = false;
    } else {
      elements.authTitle.textContent = "Создать хранилище";

      elements.authDescription.textContent =
        "Придумайте мастер-пароль. Восстановить его будет невозможно.";

      elements.authSubmitButton.textContent = "Создать хранилище";

      elements.confirmPasswordField.classList.remove("hidden");
      elements.confirmPassword.required = true;
    }

    showAuthScreen();
  } catch (error) {
    console.error("Initialization error:", error);

    showAuthError("Не удалось инициализировать расширение");
  }
}

initialize();
