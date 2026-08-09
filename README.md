# ⚡ Aura Automator (Chrome & Edge Extension)

> A polished, production-quality **Manifest V3** browser extension that allows users to create, record, edit, and execute website task automations with a modern desktop UI, visual element picker, variable system, and reliable DOM automation engine.

---

## 🌟 Features

- 🎯 **Visual Element Picker**: Hover over any webpage element to inspect it with a visual outline overlay and auto-generate robust, framework-agnostic CSS/XPath selectors.
- 🔴 **Task Recording Mode**: Observe live user clicks, inputs, dropdown selections, and checkboxes to generate editable automation steps automatically.
- ✍️ **Reliable Framework-Aware Text Entry**: Native property setters (`HTMLInputElement.prototype` / `HTMLTextAreaElement.prototype`) trigger React, Vue, Angular, and `contenteditable` synthetic event handlers reliably.
- ⏳ **Smart Element Waiting**: Built-in polling & `MutationObserver` wait loops for dynamic and delayed elements (configurable timeout and retries).
- 🔑 **Variable Interpolation**: Support for custom variables (`{name}`, `{email}`, `{phone}`, `{subject}`) and built-in dynamic tags (`{date}`, `{time}`, `{timestamp}`, `{uuid}`).
- 📋 **Full Web Dashboard**: Desktop-style options application (Linear/Raycast inspired design) with Task Manager, Drag & Drop Step Builder, Global Variables Manager, Execution History logs, and Dark/Light themes.
- ⚡ **Compact Extension Popup**: Quick task launcher, live execution status progress bar, stop controls, and quick action links.
- 📦 **Import & Export**: Backup all tasks, variables, and settings to `webtask-backup.json` and restore seamlessly.
- 🛡️ **Security & Password Protection**: Passwords are never sent to external servers. Password field interactions trigger security warnings during recording to prevent plaintext storage.

---

## 🚀 Installation

### Google Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click **Load unpacked**.
4. Select the project directory (`Autoclicker and Paste`).

### Microsoft Edge
1. Open Edge and navigate to `edge://extensions`.
2. Enable **Developer mode** in the left sidebar or top toggle.
3. Click **Load unpacked**.
4. Select the project directory (`Autoclicker and Paste`).

---

## 📖 How to Use

### 1. Creating a Task
1. Click the **WebTask Automator** extension icon and select **📋 Open Full Dashboard** (or click **+ New Task**).
2. Enter the **Task Name** and **Target Website URL** (e.g., `https://example.com/contact`).
3. Click **➕ Add Action Step** to append automation actions:
   - **Navigate**: Open URL
   - **Click / Double Click / Focus**: Click or focus elements
   - **Type / Paste Text**: Enter plain text or variables into input/textarea/contenteditable
   - **Select Dropdown**: Choose dropdown option by value or label
   - **Check / Uncheck**: Checkbox toggles
   - **Press Key**: Send `Enter`, `Tab`, `Escape`, or keyboard shortcuts
   - **Wait Duration / Element / Text / Page Load**: Timing and readiness checks
   - **Hover / Scroll**: Scroll into view or hover over elements
4. Click **Save Task**.

### 2. Using the Visual Element Picker
1. When configuring a step selector, click **🎯 Select Element** (or launch from Popup).
2. Hover over any target element on your active webpage tab to see a highlight outline and selector badge preview.
3. Click the element to select it—the generated CSS selector will be automatically populated into your task step.
4. Press **ESC** at any time to cancel.

### 3. Task Recording Mode
1. In the Dashboard, open the **🔴 Recorder** tab.
2. Enter a target URL and click **Start Recording**.
3. Perform actions on the target site (clicking buttons, filling forms, checking boxes).
4. When finished, click **Stop Recording** on the floating banner and click **Convert to Task** to customize and save the workflow.

### 4. Reusable Variables
1. Open the **🔑 Variables** tab in the Dashboard.
2. Define custom key-value pairs (e.g., `name` = `Aman`, `email` = `aman@example.com`).
3. In any text step, type `{name}` or `{email}`. During execution, WebTask Automator automatically replaces the placeholders with real values.

### 5. Import & Export Backup
- Open **⚙️ Settings & Backup** tab.
- Click **📥 Export Backup (JSON)** to save `webtask-backup.json`.
- Click **📤 Import Backup (JSON)** to restore tasks from file.

---

## 🧪 Local Testing Laboratory

The extension includes a standalone local test suite page (`test-page.html`).

To test:
1. Open `test-page.html` directly in your browser.
2. Run the pre-configured sample task (**Sample Contact Form Test**) from the extension Popup or Dashboard.
3. Observe automatic field filling, dropdown selection, checkbox toggling, submit button click, and status output!

---

## 🔒 Permissions & Security

WebTask Automator requests minimum necessary permissions:
- `"storage"`: Used to store saved tasks, variables, settings, and execution history locally using `chrome.storage.local`.
- `"tabs"`: Used to manage tab navigation during multi-step automations.
- `"scripting"` & `"activeTab"`: Used to inject DOM automation and element picker content scripts.
- `"host_permissions": ["<all_urls>"]`: Enables task execution on target websites specified by the user.

### Security Guarantees
- **No External Servers**: All task data, variables, and execution logs remain 100% strictly local in `chrome.storage.local`.
- **Password Detection**: Interacting with `input[type="password"]` during recording displays a security warning prompt to prevent saving plaintext passwords.
- **Strict Compliance**: Does not bypass website security, CAPTCHAs, or fingerprinting restrictions.

---

## 📁 Project Architecture

```text
webtask-automator/
├── manifest.json                 # Extension Manifest V3 configuration
├── icons/                        # PNG Extension Icons (16x16, 48x48, 128x128)
├── src/
│   ├── background/
│   │   └── service-worker.js     # Background Task Controller & Tab Navigation Manager
│   ├── content/
│   │   ├── content.js            # Main Content Script Message Router
│   │   ├── element-picker.js     # Visual Element Picker Overlay & Highlight
│   │   ├── element-selector.js   # Content Script Selector Adapter
│   │   ├── automation-engine.js  # Framework-Aware DOM Execution Engine
│   │   └── recorder.js           # Live DOM Event Task Recorder
│   ├── popup/
│   │   ├── popup.html            # Extension Popup HTML
│   │   ├── popup.css             # Extension Popup Styling
│   │   └── popup.js              # Popup Controller
│   ├── dashboard/
│   │   ├── dashboard.html        # Main Web Dashboard App HTML
│   │   ├── dashboard.css         # Modern Desktop Theme Stylesheet
│   │   └── dashboard.js          # Dashboard Controller Logic
│   ├── storage/
│   │   └── storage.js            # chrome.storage.local Promise Wrappers
│   └── utils/
│       ├── selectors.js          # CSS & XPath Selector Engine
│       ├── variables.js          # Variable Interpolation Engine
│       └── messaging.js          # Cross-Component Messaging Protocol
├── test-page.html                # Standalone Test Suite Page
└── README.md                     # Documentation
```
