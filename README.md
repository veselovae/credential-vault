# Local Credential Vault

Local Credential Vault is a Chrome extension for storing project credentials locally in an encrypted vault. It is designed as a small popup app: unlock the vault with a master password, filter projects, and copy logins or passwords when needed.

## Features

- Local encrypted credential storage in `chrome.storage.local`
- Master-password based encryption with PBKDF2 and AES-GCM
- Session unlock through `chrome.storage.session`
- Projects with multiple credential records
- Search by project, role, login, URL, and notes
- Project filter chips with saved selected filter
- Saved scroll position in the credential list
- Copy buttons for login, password, and URL
- Password reveal toggle

## Security Notes

The master password is not stored. It is used to derive an encryption key, and the key is saved only in Chrome session storage while the browser session is active.

If the master password is forgotten, the encrypted vault cannot be recovered. This project currently does not include a built-in vault reset flow.

## Project Structure

- `manifest.json` - Chrome extension manifest
- `popup.html` - popup markup
- `popup.css` - popup styles
- `popup.js` - main popup flow, rendering, dialogs, and event handlers
- `constants.js` - storage keys and crypto constants
- `state.js` - shared runtime state
- `elements.js` - DOM element references
- `dom.js` - DOM helpers for buttons, icons, and text elements
- `crypto-utils.js` - base64 helpers, key derivation, encryption, and decryption
- `vault-storage.js` - encrypted vault and session key storage logic
- `ui-state.js` - saved filter and scroll state
- `icons/` - action icons used in the popup

## Development

No build step is required. The popup uses native ES modules:

```html
<script type="module" src="popup.js"></script>
```

To load the extension locally:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select this project directory

After changing files, reload the extension from `chrome://extensions`.

## Validation

You can run a quick syntax check for the JavaScript files with Node:

```powershell
node --check popup.js
node --check crypto-utils.js
node --check vault-storage.js
node --check ui-state.js
node --check dom.js
node --check elements.js
node --check state.js
node --check constants.js
```
