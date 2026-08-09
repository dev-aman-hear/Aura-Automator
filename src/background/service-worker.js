/**
 * Service Worker (Background Script) for WebTask Automator
 * Manages task execution controller, recording controller, tab lifecycle, navigation, and cross-component messaging.
 */

importScripts('../storage/storage.js', '../utils/variables.js', '../utils/messaging.js');

class TaskExecutionManager {
  constructor() {
    this.activeRun = null; // Currently running task execution state
    this.recordingState = {
      isRecording: false,
      tabId: null,
      steps: []
    };
    this.initListeners();
  }

  initListeners() {
    chrome.runtime.onInstalled.addListener(async (details) => {
      console.log('🚀 [ServiceWorker] WebTask Automator installed/updated:', details.reason);
      await AuraStorage.init();
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        // Handle task run page navigation
        if (this.activeRun && this.activeRun.tabId === tabId) {
          this.onTabLoaded(tabId, tab);
        }
        // Handle persistent task recording across page navigation
        if (this.recordingState.isRecording && this.recordingState.tabId === tabId) {
          this.onRecordingTabLoaded(tabId);
        }
      }
    });
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('📩 [ServiceWorker] Received message:', message.type, message);

    try {
      switch (message.type) {
        case MessageTypes.RUN_TASK:
          const runRes = await this.startTask(message.taskId, message.customVariables);
          sendResponse(runRes);
          break;

        case MessageTypes.STOP_TASK:
          await this.stopActiveTask('Stopped by user');
          sendResponse({ success: true });
          break;

        case MessageTypes.GET_EXECUTION_STATE:
          sendResponse({
            activeRun: this.activeRun ? {
              taskId: this.activeRun.taskId,
              taskName: this.activeRun.taskName,
              status: this.activeRun.status,
              currentStepIndex: this.activeRun.currentStepIndex,
              totalSteps: this.activeRun.steps.length,
              stepLogs: this.activeRun.stepLogs
            } : null
          });
          break;

        case MessageTypes.START_ELEMENT_PICKER:
          await this.forwardToActiveTab({ type: 'START_ELEMENT_PICKER' });
          sendResponse({ success: true });
          break;

        case MessageTypes.STOP_ELEMENT_PICKER:
          await this.forwardToActiveTab({ type: 'STOP_ELEMENT_PICKER' });
          sendResponse({ success: true });
          break;

        case MessageTypes.START_RECORDING:
          await this.startRecording(message.url);
          sendResponse({ success: true, recordingState: this.recordingState });
          break;

        case MessageTypes.STOP_RECORDING:
          await this.stopRecording();
          sendResponse({ success: true, steps: this.recordingState.steps });
          break;

        case MessageTypes.GET_RECORDING_STATE:
          sendResponse({ success: true, recordingState: this.recordingState });
          break;

        case 'ACTION_RECORDED':
          if (message.allSteps) {
            this.recordingState.steps = message.allSteps;
          }
          // Broadcast to extension dashboard tabs
          chrome.runtime.sendMessage({
            type: 'ACTION_RECORDED',
            allSteps: this.recordingState.steps
          }).catch(() => {});
          sendResponse({ success: true });
          break;

        case 'ELEMENT_PICKED':
          const pickedItem = {
            id: 'pick_' + Date.now(),
            timestamp: Date.now(),
            url: sender && sender.tab ? sender.tab.url : '',
            selector: message.selector,
            tagName: (message.preview && message.preview.tagName) || 'element',
            text: (message.preview && message.preview.text) || '',
            idAttr: (message.preview && message.preview.id) || '',
            nameAttr: (message.preview && message.preview.name) || ''
          };

          await AuraStorage.savePickedElement(pickedItem);

          chrome.runtime.sendMessage({
            type: 'ELEMENT_PICKED',
            item: pickedItem,
            selector: message.selector,
            preview: message.preview
          }).catch(() => {});
          sendResponse({ success: true, item: pickedItem });
          break;

        case MessageTypes.NAVIGATE_TAB:
          const tab = await this.openOrReuseTab(message.url);
          sendResponse({ success: true, tabId: tab.id });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type in background' });
          break;
      }
    } catch (err) {
      console.error('❌ [ServiceWorker] Error handling message:', err);
      sendResponse({ success: false, error: err.message });
    }
  }

  // --- RECORDING CONTROLLER ---
  async startRecording(url) {
    let targetTab = null;
    if (url) {
      targetTab = await this.openOrReuseTab(url);
      await this.waitForTabComplete(targetTab.id);
    } else {
      targetTab = await this.getActiveTab();
    }

    if (!targetTab || !targetTab.id) {
      throw new Error('No active tab available for recording');
    }

    await this.injectContentScripts(targetTab.id);

    this.recordingState = {
      isRecording: true,
      tabId: targetTab.id,
      steps: []
    };

    await Messaging.sendToTab(targetTab.id, {
      type: 'START_RECORDING',
      steps: []
    });

    this.broadcastRecordingState();
    console.log('🔴 [ServiceWorker] Task recording started on tab:', targetTab.id);
  }

  async stopRecording() {
    if (this.recordingState.tabId) {
      await Messaging.sendToTab(this.recordingState.tabId, { type: 'STOP_RECORDING' });
    }
    this.recordingState.isRecording = false;
    this.broadcastRecordingState();
    console.log('⏹️ [ServiceWorker] Task recording stopped. Captured steps:', this.recordingState.steps.length);
  }

  async onRecordingTabLoaded(tabId) {
    if (!this.recordingState.isRecording || this.recordingState.tabId !== tabId) return;

    console.log('🔄 [ServiceWorker] Recording tab navigated. Re-injecting recording state on tab:', tabId);
    await this.injectContentScripts(tabId);
    await Messaging.sendToTab(tabId, {
      type: 'START_RECORDING',
      steps: this.recordingState.steps
    });
  }

  broadcastRecordingState() {
    chrome.runtime.sendMessage({
      type: MessageTypes.RECORDING_STATUS_CHANGED,
      recordingState: this.recordingState
    }).catch(() => {});
  }

  // --- TASK EXECUTION CONTROLLER ---
  async startTask(taskId, customVariables = {}) {
    if (this.activeRun && this.activeRun.status === 'running') {
      return { success: false, error: 'Another task is currently running' };
    }

    const task = await AuraStorage.getTask(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    if (!task.steps || task.steps.length === 0) {
      return { success: false, error: 'Task has no automation steps' };
    }

    const globalVars = await AuraStorage.getVariables();
    const settings = await AuraStorage.getSettings();

    const mergedVariables = {
      ...globalVars,
      ...(task.variables || {}),
      ...customVariables
    };

    let targetTab = await this.getActiveTab();
    if (task.url && (!targetTab || !targetTab.url || !targetTab.url.includes(new URL(task.url).hostname))) {
      targetTab = await this.openOrReuseTab(task.url);
      await this.waitForTabComplete(targetTab.id);
    }

    this.activeRun = {
      taskId: task.id,
      taskName: task.name,
      tabId: targetTab.id,
      steps: task.steps,
      currentStepIndex: 0,
      status: 'running',
      variables: mergedVariables,
      settings: settings,
      stepLogs: [],
      startTime: Date.now(),
      waitingForNav: false
    };

    console.log(`▶️ [ServiceWorker] Starting task execution: "${task.name}" on tab ${targetTab.id}`);
    this.broadcastStatus();

    this.executeNextStep();
    return { success: true, taskId: task.id };
  }

  async executeNextStep() {
    if (!this.activeRun || this.activeRun.status !== 'running') return;

    const run = this.activeRun;
    if (run.currentStepIndex >= run.steps.length) {
      await this.finishActiveTask('completed');
      return;
    }

    const step = run.steps[run.currentStepIndex];
    console.log(`➡️ [ServiceWorker] Executing step ${run.currentStepIndex + 1}/${run.steps.length}:`, step.type, step);

    const stepLog = {
      stepIndex: run.currentStepIndex,
      type: step.type,
      description: step.description || `${step.type} ${step.selector || step.url || ''}`,
      status: 'running',
      startTime: Date.now()
    };

    run.stepLogs[run.currentStepIndex] = stepLog;
    this.broadcastStatus();

    if (step.type === 'navigate') {
      let targetUrl = step.url;
      if (self.VariableEngine) {
        targetUrl = self.VariableEngine.interpolate(targetUrl, run.variables);
      }
      console.log(`🌐 [ServiceWorker] Navigating tab ${run.tabId} to: ${targetUrl}`);

      run.waitingForNav = true;
      try {
        await chrome.tabs.update(run.tabId, { url: targetUrl });
      } catch (err) {
        stepLog.status = 'failed';
        stepLog.error = err.message;
        await this.finishActiveTask('failed', `Navigation failed: ${err.message}`);
      }
      return;
    }

    await this.injectContentScripts(run.tabId);

    const retries = run.settings.retries || 3;
    const retryDelay = run.settings.retryDelay || 1000;
    let stepSuccess = false;
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      if (!this.activeRun || this.activeRun.status !== 'running') return;

      const response = await Messaging.sendToTab(run.tabId, {
        type: 'EXECUTE_STEP_IN_CONTENT',
        step: step,
        variables: run.variables
      });

      if (response && response.success) {
        stepSuccess = true;
        break;
      }

      lastError = response ? response.error : 'No response from webpage content script';
      console.warn(`⚠️ Step ${run.currentStepIndex + 1} attempt ${attempt}/${retries} failed: ${lastError}`);

      if (attempt < retries) {
        await new Promise(r => setTimeout(r, retryDelay));
      }
    }

    stepLog.duration = Date.now() - stepLog.startTime;

    if (stepSuccess) {
      stepLog.status = 'success';
      run.currentStepIndex++;
      this.broadcastStatus();
      setTimeout(() => this.executeNextStep(), 200);
    } else {
      stepLog.status = 'failed';
      stepLog.error = lastError;
      this.broadcastStatus();
      await this.finishActiveTask('failed', `Step ${run.currentStepIndex + 1} failed: ${lastError}`);
    }
  }

  async onTabLoaded(tabId, tab) {
    if (!this.activeRun || this.activeRun.tabId !== tabId) return;

    if (this.activeRun.waitingForNav) {
      console.log(`✅ [ServiceWorker] Tab navigation completed: ${tab.url}`);
      this.activeRun.waitingForNav = false;

      if (this.activeRun.stepLogs[this.activeRun.currentStepIndex]) {
        this.activeRun.stepLogs[this.activeRun.currentStepIndex].status = 'success';
        this.activeRun.stepLogs[this.activeRun.currentStepIndex].duration = Date.now() - this.activeRun.stepLogs[this.activeRun.currentStepIndex].startTime;
      }

      this.activeRun.currentStepIndex++;
      this.broadcastStatus();

      setTimeout(() => this.executeNextStep(), 500);
    }
  }

  async stopActiveTask(reason = 'Stopped by user') {
    if (this.activeRun) {
      await this.finishActiveTask('stopped', reason);
    }
  }

  async finishActiveTask(status, errorMsg = null) {
    if (!this.activeRun) return;

    const run = this.activeRun;
    run.status = status;
    run.endTime = Date.now();
    run.duration = run.endTime - run.startTime;
    run.error = errorMsg;

    console.log(`🏁 [ServiceWorker] Task finished [${status}]:`, run.taskName, errorMsg || '');

    await AuraStorage.addHistoryEntry({
      taskId: run.taskId,
      taskName: run.taskName,
      status: status,
      duration: run.duration,
      error: errorMsg,
      stepLogs: run.stepLogs
    });

    this.broadcastStatus();
    this.activeRun = null;
  }

  broadcastStatus() {
    if (!this.activeRun) return;
    const msg = {
      type: MessageTypes.STEP_STATUS,
      activeRun: {
        taskId: this.activeRun.taskId,
        taskName: this.activeRun.taskName,
        status: this.activeRun.status,
        currentStepIndex: this.activeRun.currentStepIndex,
        totalSteps: this.activeRun.steps.length,
        stepLogs: this.activeRun.stepLogs,
        error: this.activeRun.error
      }
    };
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  // --- HELPER UTILITIES ---
  async injectContentScripts(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        files: [
          'src/utils/selectors.js',
          'src/utils/variables.js',
          'src/content/element-selector.js',
          'src/content/element-picker.js',
          'src/content/automation-engine.js',
          'src/content/recorder.js',
          'src/content/content.js'
        ]
      });
    } catch (e) {
      console.warn('Content script injection warning:', e.message);
    }
  }

  async getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs && tabs[0] ? tabs[0] : null);
      });
    });
  }

  async openOrReuseTab(url) {
    const activeTab = await this.getActiveTab();
    if (activeTab && (!activeTab.url || activeTab.url === 'about:blank' || activeTab.url.startsWith('chrome://'))) {
      await chrome.tabs.update(activeTab.id, { url, active: true });
      return activeTab;
    }
    return await chrome.tabs.create({ url, active: true });
  }

  async waitForTabComplete(tabId, timeout = 10000) {
    return new Promise((resolve) => {
      let timer = setTimeout(() => resolve(false), timeout);
      const listener = (tid, changeInfo) => {
        if (tid === tabId && changeInfo.status === 'complete') {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(true);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  async forwardToActiveTab(message) {
    const activeTab = await this.getActiveTab();
    if (activeTab && activeTab.id) {
      await this.injectContentScripts(activeTab.id);
      await Messaging.sendToTab(activeTab.id, message);
    }
  }
}

const executionManager = new TaskExecutionManager();
