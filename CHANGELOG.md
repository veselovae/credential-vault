# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project uses semantic versioning when possible.

## [Unreleased]

### Added

- Nothing yet.

### Changed

- Nothing yet.

### Fixed

- Nothing yet.

## [1.0.0] - 2026-07-14

### Added

- Added a Chrome Manifest V3 popup extension for local credential storage.
- Added encrypted vault storage in `chrome.storage.local`.
- Added master-password based key derivation with PBKDF2.
- Added AES-GCM encryption and decryption for stored projects.
- Added temporary session unlock through `chrome.storage.session`.
- Added project management: create, rename, and delete projects.
- Added credential management inside projects: create, edit, and delete records.
- Added login, password, URL, role, and notes fields for credentials.
- Added search across projects and credential fields.
- Added project filter chips.
- Added saved selected filter and saved list scroll position.
- Added copy actions for login, password, and URL.
- Added password reveal controls.
- Split the popup code into ES modules.
- Added project documentation in `README.md`.

### Security

- The master password is not stored.
- The session key is kept only in Chrome session storage.
- Forgotten master passwords cannot currently be recovered through the extension.
