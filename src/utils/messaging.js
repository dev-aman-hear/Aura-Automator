/**
 * Extension Messaging Protocol Constants and Helpers
 */

(function() {
  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);

  const MessageTypesImpl = {
    // Element Picker
    START_ELEMENT_PICKER: 'START_ELEMENT_PICKER',
    STOP_ELEMENT_PICKER: 'STOP_ELEMENT_PICKER',
    ELEMENT_PICKED: 'ELEMENT_PICKED',

    // Task Recorder
    START_RECORDING: 'START_RECORDING',
    STOP_RECORDING: 'STOP_RECORDING',
    ACTION_RECORDED: 'ACTION_RECORDED',
    RECORDING_STATUS_CHANGED: 'RECORDING_STATUS_CHANGED',
    GET_RECORDING_STATE: 'GET_RECORDING_STATE',

    // Task Execution
    RUN_TASK: 'RUN_TASK',
    PAUSE_TASK: 'PAUSE_TASK',
    RESUME_TASK: 'RESUME_TASK',
    STOP_TASK: 'STOP_TASK',
    STEP_STATUS: 'STEP_STATUS',
    TASK_COMPLETED: 'TASK_COMPLETED',
    TASK_FAILED: 'TASK_FAILED',
    GET_EXECUTION_STATE: 'GET_EXECUTION_STATE',
    EXECUTE_STEP_IN_CONTENT: 'EXECUTE_STEP_IN_CONTENT',

    // Navigation
    NAVIGATE_TAB: 'NAVIGATE_TAB',

    // Status Sync
    PING: 'PING',
    PONG: 'PONG'
  };

  const MessagingImpl = {
    Types: MessageTypesImpl,

    async sendToActiveTab(message) {
      if (typeof chrome === 'undefined' || !chrome.tabs) return null;
      return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs || !tabs[0] || !tabs[0].id) {
            resolve({ success: false, error: 'No active tab found' });
            return;
          }
          chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
            if (chrome.runtime.lastError) {
              const errMsg = chrome.runtime.lastError.message || '';
              const isConnErr = errMsg.includes('Could not establish connection') || errMsg.includes('Receiving end does not exist');
              resolve({
                success: false,
                error: isConnErr
                  ? 'Could not communicate with active webpage tab (Receiving end does not exist). The page may be loading, closed, or a restricted chrome:// URL.'
                  : errMsg
              });
            } else {
              resolve(response || { success: true });
            }
          });
        });
      });
    },

    async sendToTab(tabId, message) {
      if (typeof chrome === 'undefined' || !chrome.tabs) return null;
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message || '';
            const isConnErr = errMsg.includes('Could not establish connection') || errMsg.includes('Receiving end does not exist');
            resolve({
              success: false,
              error: isConnErr
                ? 'Could not communicate with webpage content script (Receiving end does not exist). Ensure target page is loaded and not a restricted URL.'
                : errMsg
            });
          } else {
            resolve(response || { success: true });
          }
        });
      });
    },

    async sendToBackground(message) {
      if (typeof chrome === 'undefined' || !chrome.runtime) return null;
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message || '';
            const isConnErr = errMsg.includes('Could not establish connection') || errMsg.includes('Receiving end does not exist');
            resolve({
              success: false,
              error: isConnErr
                ? 'Extension background service worker is currently waking up. Please try again.'
                : errMsg
            });
          } else {
            resolve(response || { success: true });
          }
        });
      });
    }
  };

  root.MessageTypes = Object.assign(root.MessageTypes || {}, MessageTypesImpl);
  root.Messaging = Object.assign(root.Messaging || {}, MessagingImpl);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MessageTypes: root.MessageTypes, Messaging: root.Messaging };
  }
})();
