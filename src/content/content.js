/**
 * Main Content Script Entry Point for WebTask Automator
 */

(function() {
  console.log('🤖 Aura Automator Content Script Initialized on:', window.location.href);

  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📬 [ContentScript] Received message:', message.type, message);

      switch (message.type) {
        case 'PING':
          sendResponse({ status: 'ok', url: window.location.href });
          break;

        case 'START_ELEMENT_PICKER':
          if (window.WebTaskElementPicker) {
            window.WebTaskElementPicker.start();
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'ElementPicker not loaded' });
          }
          break;

        case 'STOP_ELEMENT_PICKER':
          if (window.WebTaskElementPicker) {
            window.WebTaskElementPicker.stop();
            sendResponse({ success: true });
          }
          break;

        case 'START_RECORDING':
          if (window.WebTaskRecorder) {
            window.WebTaskRecorder.start(message.steps || []);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Recorder not loaded' });
          }
          break;

        case 'STOP_RECORDING':
          if (window.WebTaskRecorder) {
            const steps = window.WebTaskRecorder.stop();
            sendResponse({ success: true, steps });
          }
          break;

        case 'EXECUTE_STEP_IN_CONTENT':
          if (window.WebTaskAutomationEngine) {
            window.WebTaskAutomationEngine
              .executeStep(message.step, message.variables || {})
              .then(result => sendResponse(result))
              .catch(err => sendResponse({ success: false, error: err.message }));
            return true; // Keep message channel open for async response
          } else {
            sendResponse({ success: false, error: 'AutomationEngine not loaded' });
          }
          break;

        case 'CHECK_PAGE_RESULT':
          if (window.WebTaskAutomationEngine) {
            window.WebTaskAutomationEngine
              .checkPageResult(message.config || {})
              .then(result => sendResponse(result))
              .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
          } else {
            sendResponse({ success: false, error: 'AutomationEngine not loaded' });
          }
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
          break;
      }

      return true;
    });
  }
})();
