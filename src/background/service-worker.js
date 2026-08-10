/**
 * Service Worker (Background Script) for Aura Automator
 * State-Machine Driven Website Automation Engine & Task Execution Controller.
 */

importScripts('/src/storage/storage.js', '/src/utils/variables.js', '/src/utils/messaging.js');

class TaskExecutionManager {
  constructor() {
    this.activeRun = null; // Currently running task execution state
    this.recordingState = {
      isRecording: false,
      tabId: null,
      steps: []
    };

    this.initListeners();
    this.restoreActiveRun();
    this.startTimerLoop();
  }

  startTimerLoop() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.onTimerTick();
    }, 1000);
  }

  async restoreActiveRun() {
    try {
      const stored = await AuraStorage.getActiveRun();
      if (stored && (stored.state && stored.state !== 'STOPPED' && stored.state !== 'IDLE')) {
        this.activeRun = stored;
        console.log('🔄 [ServiceWorker] Restored active state machine run from storage:', stored.taskName, `(Loop #${stored.loopCounter || 1})`, `State: ${stored.state}`);
      }
    } catch (e) {
      console.error('Error restoring active run:', e);
    }
  }

  initListeners() {
    chrome.runtime.onInstalled.addListener(async (details) => {
      console.log('🚀 [ServiceWorker] Aura Automator installed/updated:', details.reason);
      await AuraStorage.init();
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        if (this.activeRun && this.activeRun.tabId === tabId) {
          this.onTabLoaded(tabId, tab);
        }
        if (this.recordingState.isRecording && this.recordingState.tabId === tabId) {
          this.onRecordingTabLoaded(tabId);
        }
      }
    });
  }

  formatTime(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  getTimestamp() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `[${h}:${m}:${s}]`;
  }

  logActivity(message) {
    if (!this.activeRun) return;
    const entry = `${this.getTimestamp()} ${message}`;
    if (!this.activeRun.activityLog) this.activeRun.activityLog = [];
    this.activeRun.activityLog.push(entry);
    if (this.activeRun.activityLog.length > 150) this.activeRun.activityLog.shift();
    console.log(`🤖 [Engine Log] ${entry}`);
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('📩 [ServiceWorker] Received message:', message.type, message);

    try {
      switch (message.type) {
        case MessageTypes.RUN_TASK:
          const runRes = await this.startTask(message.taskId, message.customVariables);
          sendResponse(runRes);
          break;

        case MessageTypes.PAUSE_TASK:
          const pauseRes = await this.pauseTask();
          sendResponse(pauseRes);
          break;

        case MessageTypes.RESUME_TASK:
          const resumeRes = await this.resumeTask();
          sendResponse(resumeRes);
          break;

        case MessageTypes.STOP_TASK:
          await this.stopActiveTask('Stopped by user');
          sendResponse({ success: true });
          break;

        case 'STOP_CONTINUOUS_LOOP':
          await this.stopActiveTask('Stopped by user');
          sendResponse({ success: true });
          break;

        case MessageTypes.GET_EXECUTION_STATE:
          if (!this.activeRun) {
            this.activeRun = await AuraStorage.getActiveRun();
          }
          sendResponse({
            activeRun: this.activeRun ? {
              taskId: this.activeRun.taskId,
              taskName: this.activeRun.taskName,
              websiteUrl: this.activeRun.websiteUrl,
              inputSelector: this.activeRun.inputSelector,
              inputText: this.activeRun.inputText,
              submitSelector: this.activeRun.submitSelector,
              successSelector: this.activeRun.successSelector,
              errorSelector: this.activeRun.errorSelector,
              state: this.activeRun.state || 'IDLE',
              loopCounter: this.activeRun.loopCounter || 0,
              countdownSeconds: this.activeRun.countdownSeconds || 0,
              countdownFormatted: this.activeRun.countdownFormatted || '00:00',
              elapsedFormatted: this.activeRun.elapsedFormatted || '00:00',
              nextAction: this.activeRun.nextAction || '',
              activityLog: this.activeRun.activityLog || [],
              status: this.activeRun.state || 'IDLE',
              currentStepIndex: this.activeRun.currentStepIndex || 0,
              totalSteps: (this.activeRun.steps || []).length,
              stepLogs: this.activeRun.stepLogs || [],
              taskLoop: true,
              taskLoopInterval: this.activeRun.taskLoopInterval || 0,
              loopCount: this.activeRun.loopCounter || 1,
              nextRunTime: this.activeRun.nextRunTime || null,
              stepEndTime: this.activeRun.stepEndTime || null,
              error: this.activeRun.error || null
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

  // --- STATE MACHINE AUTOMATION ENGINE ---

  async startTask(taskId, customVariables = {}) {
    if (this.activeRun && ['STARTING_LOOP', 'NAVIGATING', 'ENTERING_DATA', 'SUBMITTING', 'MONITORING_RESULT', 'WAITING_SUCCESS_RETRY', 'WAITING_ERROR_RETRY', 'PAUSED'].includes(this.activeRun.state)) {
      return { success: false, error: 'Another automation task is currently active' };
    }

    const task = await AuraStorage.getTask(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    const globalVars = await AuraStorage.getVariables();
    const settings = await AuraStorage.getSettings();

    const mergedVariables = {
      ...globalVars,
      ...(task.variables || {}),
      ...customVariables
    };

    let targetTab = await this.getActiveTab();
    const isRestrictedTab = !targetTab || !targetTab.url || 
      targetTab.url.startsWith('chrome://') || 
      targetTab.url.startsWith('chrome-extension://') || 
      targetTab.url.startsWith('edge://') || 
      targetTab.url.startsWith('about:');

    const targetUrl = task.websiteUrl || task.url || (task.steps && task.steps[0] && task.steps[0].url) || 'https://example.com';

    if (isRestrictedTab || (targetUrl && targetTab && targetTab.url && !targetTab.url.includes(new URL(targetUrl).hostname))) {
      targetTab = await this.openOrReuseTab(targetUrl);
      await this.waitForTabComplete(targetTab.id);
      await new Promise(r => setTimeout(r, 600));
    }

    // Extract workflow parameters from task or step definitions
    const inputStep = (task.steps || []).find(s => s.type === 'type');
    const clickStep = (task.steps || []).find(s => s.type === 'click');
    const errCondStep = (task.steps || []).find(s => s.conditionType === 'element_exists' && (s.selector || '').includes('error'));
    const succCondStep = (task.steps || []).find(s => s.conditionType === 'element_exists' && (s.selector || '').includes('success'));

    this.activeRun = {
      taskId: task.id,
      taskName: task.name,
      websiteUrl: targetUrl,
      inputSelector: task.inputSelector || (inputStep ? inputStep.selector : '#instagram-link'),
      inputText: task.inputText || (inputStep ? inputStep.text : '{Link01}'),
      submitSelector: task.submitSelector || (clickStep ? clickStep.selector : '#submit-btn'),
      successSelector: task.successSelector || (succCondStep ? succCondStep.selector : 'div.thanks-page-success'),
      errorSelector: task.errorSelector || (errCondStep ? errCondStep.selector : 'div.thanks-page-error'),
      serverErrorDetection: task.serverErrorDetection !== undefined ? task.serverErrorDetection : 'server_connection_error',
      successDelay: task.successDelay || task.loopInterval || 300000,   // 5 minutes
      errorDelay: task.errorDelay || 120000,                             // 2 minutes
      resultTimeout: task.resultTimeout || 90000,                        // 90 seconds
      resultMinimumWait: task.resultMinimumWait || 60000,               // 60 seconds

      tabId: targetTab.id,
      steps: task.steps || [],
      currentStepIndex: 0,
      state: 'IDLE',
      previousState: null,
      loopCounter: 0, // Increments ONLY when Step 1 actually starts!
      countdownSeconds: 0,
      countdownFormatted: '00:00',
      elapsedFormatted: '00:00',
      nextAction: 'Starting Loop #1',
      activityLog: [],
      stepLogs: [],
      variables: mergedVariables,
      settings: settings,
      taskLoop: true,
      startTime: Date.now()
    };

    console.log(`▶️ [ServiceWorker] Starting State Machine Task: "${task.name}"`);
    this.logActivity(`Task "${task.name}" initialized`);
    this.broadcastStatus();

    // Begin execution from Step 1
    this.startLoopStep1();
    return { success: true, taskId: task.id };
  }

  // STEP 1 — START LOOP
  async startLoopStep1() {
    if (!this.activeRun || this.activeRun.state === 'STOPPED') return;

    // Increment loopCounter ONLY when Step 1 actually starts
    this.activeRun.loopCounter = (this.activeRun.loopCounter || 0) + 1;
    this.activeRun.state = 'STARTING_LOOP';
    this.activeRun.nextAction = `Opening website`;
    this.logActivity(`Loop #${this.activeRun.loopCounter} started`);
    this.broadcastStatus();

    this.activeRun.state = 'NAVIGATING';
    this.logActivity(`Opening website (${this.activeRun.websiteUrl})`);
    this.broadcastStatus();

    try {
      const targetUrl = this.activeRun.websiteUrl;
      const tab = await this.openOrReuseTab(targetUrl);
      this.activeRun.tabId = tab.id;
      await this.waitForTabComplete(tab.id);
      await this.injectContentScripts(tab.id);
      await new Promise(r => setTimeout(r, 600));

      if (this.activeRun.state === 'PAUSED' || this.activeRun.state === 'STOPPED') return;

      // Continue to Step 2 — ENTER DATA
      this.executeStep2EnterData();
    } catch (err) {
      this.logActivity(`Navigation error: ${err.message}`);
      this.handleErrorResult(`Navigation failed: ${err.message}`);
    }
  }

  // STEP 2 — ENTER DATA
  async executeStep2EnterData() {
    if (!this.activeRun || this.activeRun.state === 'STOPPED' || this.activeRun.state === 'PAUSED') return;

    this.activeRun.state = 'ENTERING_DATA';
    this.activeRun.nextAction = `Entering input data`;
    this.logActivity(`Entering data into input field (${this.activeRun.inputSelector || 'target input'})`);
    this.broadcastStatus();

    try {
      const inputSel = this.activeRun.inputSelector;
      let inputVal = this.activeRun.inputText || '';

      if (inputSel) {
        if (self.VariableEngine) {
          inputVal = self.VariableEngine.interpolate(inputVal, this.activeRun.variables);
        }

        const res = await this.sendStepToTab(this.activeRun.tabId, {
          type: 'EXECUTE_STEP_IN_CONTENT',
          step: { type: 'type', selector: inputSel, text: inputVal },
          variables: this.activeRun.variables
        });

        if (!res || !res.success) {
          throw new Error(res ? res.error : 'Failed to populate input element');
        }
        this.logActivity('Input populated');
      } else {
        this.logActivity('No inputSelector specified, continuing');
      }

      if (this.activeRun.state === 'PAUSED' || this.activeRun.state === 'STOPPED') return;

      // Continue to Step 3 — SUBMIT
      this.executeStep3Submit();
    } catch (err) {
      this.logActivity(`Data entry error: ${err.message}`);
      this.handleErrorResult(`Input entry failed: ${err.message}`);
    }
  }

  // STEP 3 — SUBMIT
  async executeStep3Submit() {
    if (!this.activeRun || this.activeRun.state === 'STOPPED' || this.activeRun.state === 'PAUSED') return;

    this.activeRun.state = 'SUBMITTING';
    this.activeRun.nextAction = `Clicking submit`;
    this.logActivity(`Clicking submit button (${this.activeRun.submitSelector || 'target button'})`);
    this.broadcastStatus();

    try {
      const submitSel = this.activeRun.submitSelector;

      if (submitSel) {
        const res = await this.sendStepToTab(this.activeRun.tabId, {
          type: 'EXECUTE_STEP_IN_CONTENT',
          step: { type: 'click', selector: submitSel },
          variables: this.activeRun.variables
        });

        if (!res || !res.success) {
          throw new Error(res ? res.error : 'Failed to click submit button');
        }
        this.logActivity('Submit clicked');
      } else {
        this.logActivity('No submitSelector specified, starting monitoring');
      }

      if (this.activeRun.state === 'PAUSED' || this.activeRun.state === 'STOPPED') return;

      // Start RESULT MONITORING
      this.startResultMonitoring();
    } catch (err) {
      this.logActivity(`Submit error: ${err.message}`);
      this.handleErrorResult(`Submit failed: ${err.message}`);
    }
  }

  // RESULT MONITORING
  startResultMonitoring() {
    if (!this.activeRun || this.activeRun.state === 'STOPPED' || this.activeRun.state === 'PAUSED') return;

    this.activeRun.state = 'MONITORING_RESULT';
    this.activeRun.monitoringStartTime = Date.now();
    this.activeRun.resultTimeout = this.activeRun.resultTimeout || 120000;
    this.activeRun.nextAction = `Waiting 2 min for result (00:00 / 02:00)`;
    this.logActivity('Waiting 2 minutes after submit to check condition');
    this.broadcastStatus();
  }

  async checkResultMonitoringTick() {
    if (!this.activeRun || this.activeRun.state !== 'MONITORING_RESULT') return;

    const elapsedMs = Date.now() - (this.activeRun.monitoringStartTime || Date.now());
    const timeoutMs = this.activeRun.resultTimeout || 120000;

    const elapsedSec = Math.floor(elapsedMs / 1000);
    const timeoutSec = Math.floor(timeoutMs / 1000);
    this.activeRun.elapsedFormatted = `${this.formatTime(elapsedSec)} / ${this.formatTime(timeoutSec)}`;
    this.activeRun.nextAction = `Waiting 2 min for result (${this.activeRun.elapsedFormatted})`;

    // Check page for server error, success, or error selectors
    const res = await this.sendStepToTab(this.activeRun.tabId, {
      type: 'CHECK_PAGE_RESULT',
      config: {
        successSelector: this.activeRun.successSelector || 'p.thanks-page-body, div.thanks-page-success',
        errorSelector: this.activeRun.errorSelector || 'div.thanks-page-error, #error-message',
        serverErrorDetection: this.activeRun.serverErrorDetection || 'server_connection_error'
      }
    });

    if (this.activeRun.state !== 'MONITORING_RESULT') return;

    if (res && res.success && res.result) {
      const { successFound, errorFound, serverErrorFound, extractedDelayMs, details } = res.result;

      // 1. Server/Connection Error -> Immediate Retry from Step 1
      if (serverErrorFound) {
        this.logActivity(`Server error detected! Retrying Step 1 immediately.`);
        this.activeRun.state = 'SERVER_ERROR_RETRY';
        this.activeRun.nextAction = `Retrying immediately (Server Error)`;
        this.broadcastStatus();
        setTimeout(() => this.startLoopStep1(), 500);
        return;
      }

      // 2. Success Result -> Wait 5 minutes (minimum 300,000 ms) -> Restart Step 1 (Loop +1)
      if (successFound) {
        const configuredMs = this.activeRun.successDelay || 300000;
        const delayMs = Math.max(configuredMs, extractedDelayMs || 0, 300000);
        const delayMins = Math.round(delayMs / 60000);
        this.logActivity(`Success: ${details || 'Success condition matched'}. Starting Step 1 after ${delayMins} minute(s)`);
        this.activeRun.state = 'WAITING_SUCCESS_RETRY';
        this.activeRun.countdownSeconds = Math.round(delayMs / 1000);
        this.activeRun.countdownFormatted = this.formatTime(this.activeRun.countdownSeconds);
        this.activeRun.nextAction = `Restarting Step 1 in ${this.activeRun.countdownFormatted}`;
        this.broadcastStatus();
        return;
      }

      // 3. Error Result -> Use parsed dynamic wait + 15s buffer (if present), else default to errorDelay (120,000 ms = 2 min)
      if (errorFound) {
        const delayMs = (extractedDelayMs && extractedDelayMs > 0) ? extractedDelayMs : (this.activeRun.errorDelay || 120000);
        const delaySecs = Math.round(delayMs / 1000);
        const logTimeStr = this.formatTime(delaySecs);
        this.logActivity(`Error: ${details || 'Error condition matched'}. Retrying Step 1 in ${logTimeStr} (Parsed time + 15s buffer)`);
        this.activeRun.state = 'WAITING_ERROR_RETRY';
        this.activeRun.countdownSeconds = delaySecs;
        this.activeRun.countdownFormatted = this.formatTime(this.activeRun.countdownSeconds);
        this.activeRun.nextAction = `Retrying Step 1 in ${this.activeRun.countdownFormatted}`;
        this.broadcastStatus();
        return;
      }
    }

    // 4. Timeout reached after 2 min wait -> Re-check or default to 2 min retry
    if (elapsedMs >= timeoutMs) {
      this.logActivity(`2 min wait complete. Retrying Step 1 after 2 minutes countdown`);
      this.activeRun.state = 'WAITING_ERROR_RETRY';
      this.activeRun.countdownSeconds = Math.round((this.activeRun.errorDelay || 120000) / 1000);
      this.activeRun.countdownFormatted = this.formatTime(this.activeRun.countdownSeconds);
      this.activeRun.nextAction = `Retrying Step 1 in ${this.activeRun.countdownFormatted}`;
      this.broadcastStatus();
    }
  }

  handleErrorResult(reason) {
    if (!this.activeRun || this.activeRun.state === 'STOPPED') return;

    this.logActivity(`Attempt failed (${reason}). Waiting 2 minutes`);
    this.activeRun.state = 'WAITING_ERROR_RETRY';
    this.activeRun.countdownSeconds = Math.round((this.activeRun.errorDelay || 120000) / 1000);
    this.activeRun.countdownFormatted = this.formatTime(this.activeRun.countdownSeconds);
    this.activeRun.nextAction = `Restarting in ${this.activeRun.countdownFormatted}`;
    this.broadcastStatus();
  }

  // 1-SECOND TIMER TICK HANDLER
  onTimerTick() {
    if (!this.activeRun) return;

    // PAUSED STATE: Freeze countdown!
    if (this.activeRun.state === 'PAUSED') {
      this.activeRun.nextAction = `PAUSED (Remaining: ${this.activeRun.countdownFormatted || '00:00'})`;
      this.broadcastStatus();
      return;
    }

    // MONITORING RESULT STATE
    if (this.activeRun.state === 'MONITORING_RESULT') {
      this.checkResultMonitoringTick();
      return;
    }

    // WAITING SUCCESS / ERROR COUNTDOWN STATES
    if (['WAITING_SUCCESS_RETRY', 'WAITING_ERROR_RETRY'].includes(this.activeRun.state)) {
      if (this.activeRun.countdownSeconds > 0) {
        this.activeRun.countdownSeconds -= 1;
        this.activeRun.countdownFormatted = this.formatTime(this.activeRun.countdownSeconds);
        this.activeRun.nextAction = `Restarting in ${this.activeRun.countdownFormatted}`;
        this.broadcastStatus();
      } else {
        // Countdown finished -> restart from Step 1 (which increments loopCounter!)
        this.logActivity(`Starting Loop #${(this.activeRun.loopCounter || 0) + 1}`);
        this.startLoopStep1();
      }
    }
  }

  // PAUSE CONTROLLER
  async pauseTask() {
    if (!this.activeRun || this.activeRun.state === 'STOPPED' || this.activeRun.state === 'IDLE') {
      return { success: false, error: 'No active task to pause' };
    }
    if (this.activeRun.state === 'PAUSED') return { success: true };

    this.activeRun.previousState = this.activeRun.state;
    this.activeRun.state = 'PAUSED';
    this.logActivity('Automation PAUSED');
    this.broadcastStatus();
    return { success: true };
  }

  // RESUME CONTROLLER
  async resumeTask() {
    if (!this.activeRun || this.activeRun.state === 'STOPPED' || this.activeRun.state === 'IDLE') {
      return { success: false, error: 'No active task to resume' };
    }
    if (this.activeRun.state !== 'PAUSED') return { success: true };

    const targetState = this.activeRun.previousState || 'STARTING_LOOP';
    this.activeRun.state = targetState;
    this.logActivity('Automation RESUMED');
    this.broadcastStatus();

    if (['STARTING_LOOP', 'NAVIGATING'].includes(targetState)) {
      this.startLoopStep1();
    } else if (targetState === 'ENTERING_DATA') {
      this.executeStep2EnterData();
    } else if (targetState === 'SUBMITTING') {
      this.executeStep3Submit();
    }
    return { success: true };
  }

  // STOP CONTROLLER
  async stopActiveTask(reason = 'Stopped by user') {
    if (!this.activeRun) return { success: true };

    this.activeRun.state = 'STOPPED';
    this.activeRun.nextAction = 'STOPPED';
    this.logActivity(`Automation STOPPED (${reason})`);
    this.broadcastStatus();

    const run = this.activeRun;
    await AuraStorage.addHistoryEntry({
      taskId: run.taskId,
      taskName: `${run.taskName} (Loops: ${run.loopCounter || 1})`,
      status: 'stopped',
      duration: Date.now() - run.startTime,
      error: reason,
      stepLogs: run.stepLogs,
      activityLog: run.activityLog
    });

    await AuraStorage.clearActiveRun();
  }

  onTabLoaded(tabId, tab) {
    if (!this.activeRun || this.activeRun.tabId !== tabId) return;
    console.log(`✅ [ServiceWorker] Tab navigation completed: ${tab.url}`);
  }

  broadcastStatus() {
    if (!this.activeRun) return;
    AuraStorage.saveActiveRun(this.activeRun);

    const msg = {
      type: MessageTypes.STEP_STATUS,
      activeRun: {
        taskId: this.activeRun.taskId,
        taskName: this.activeRun.taskName,
        websiteUrl: this.activeRun.websiteUrl,
        inputSelector: this.activeRun.inputSelector,
        inputText: this.activeRun.inputText,
        submitSelector: this.activeRun.submitSelector,
        successSelector: this.activeRun.successSelector,
        errorSelector: this.activeRun.errorSelector,
        state: this.activeRun.state || 'IDLE',
        loopCounter: this.activeRun.loopCounter || 0,
        countdownSeconds: this.activeRun.countdownSeconds || 0,
        countdownFormatted: this.activeRun.countdownFormatted || '00:00',
        elapsedFormatted: this.activeRun.elapsedFormatted || '00:00',
        nextAction: this.activeRun.nextAction || '',
        activityLog: this.activeRun.activityLog || [],
        status: this.activeRun.state || 'IDLE',
        currentStepIndex: this.activeRun.currentStepIndex || 0,
        totalSteps: (this.activeRun.steps || []).length,
        stepLogs: this.activeRun.stepLogs || [],
        taskLoop: true,
        taskLoopInterval: this.activeRun.taskLoopInterval || 0,
        loopCount: this.activeRun.loopCounter || 1,
        nextRunTime: this.activeRun.nextRunTime || null,
        stepEndTime: this.activeRun.stepEndTime || null,
        error: this.activeRun.error || null
      }
    };
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  // --- HELPER UTILITIES ---
  async injectContentScripts(tabId) {
    try {
      let tab = null;
      let attempts = 0;

      while (attempts < 5) {
        tab = await new Promise(resolve => {
          if (typeof chrome === 'undefined' || !chrome.tabs) resolve(null);
          else chrome.tabs.get(tabId, (t) => resolve(chrome.runtime.lastError ? null : t));
        });

        if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
          break;
        }
        attempts++;
        await new Promise(r => setTimeout(r, 400));
      }

      if (!tab || !tab.url) return false;

      if (tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') || 
          tab.url.startsWith('edge://') || 
          tab.url.startsWith('about:') ||
          tab.url.includes('chrome.google.com/webstore')) {
        console.warn('⚠️ [ServiceWorker] Cannot inject content scripts into restricted URL:', tab.url);
        return false;
      }

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
      return true;
    } catch (e) {
      console.warn('⚠️ Content script injection warning:', e.message);
      return false;
    }
  }

  async getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs && tabs[0] ? tabs[0] : null);
      });
    });
  }

  async sendStepToTab(tabId, message) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.injectContentScripts(tabId);
      const res = await Messaging.sendToTab(tabId, message);
      if (res && res.success) return res;
      
      const err = (res && res.error) ? res.error : '';
      if (err.includes('Receiving end does not exist') || err.includes('Could not communicate')) {
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      return res || { success: false, error: 'No response from content script' };
    }
    return { success: false, error: 'Could not communicate with webpage content script' };
  }

  async openOrReuseTab(url) {
    const activeTab = await this.getActiveTab();
    
    // If active tab is a new tab or blank, navigate it
    if (activeTab && (!activeTab.url || activeTab.url === 'about:blank' || activeTab.url.startsWith('chrome://newtab'))) {
      await chrome.tabs.update(activeTab.id, { url, active: true });
      await this.waitForTabComplete(activeTab.id);
      return activeTab;
    }

    // Check if an existing non-extension tab is already matching this domain or URL
    const allTabs = await new Promise(resolve => {
      if (typeof chrome === 'undefined' || !chrome.tabs) resolve([]);
      else chrome.tabs.query({}, resolve);
    });

    try {
      const targetHost = new URL(url).hostname;
      const existingTab = allTabs.find(t => t.url && t.url.includes(targetHost) && !t.url.startsWith('chrome-extension://'));
      if (existingTab) {
        await chrome.tabs.update(existingTab.id, { url, active: true });
        await this.waitForTabComplete(existingTab.id);
        return existingTab;
      }
    } catch (e) {}

    // Create a new tab
    const newTab = await chrome.tabs.create({ url, active: true });
    await this.waitForTabComplete(newTab.id);
    return newTab;
  }

  async waitForTabComplete(tabId, timeout = 15000) {
    const currentTab = await new Promise(resolve => {
      if (typeof chrome === 'undefined' || !chrome.tabs) resolve(null);
      else chrome.tabs.get(tabId, (t) => resolve(chrome.runtime.lastError ? null : t));
    });

    if (currentTab && currentTab.status === 'complete' && currentTab.url && 
        !currentTab.url.startsWith('chrome://') && 
        !currentTab.url.startsWith('chrome-extension://') && 
        !currentTab.url.startsWith('about:')) {
      return true;
    }

    return new Promise((resolve) => {
      let timer = setTimeout(() => resolve(false), timeout);
      const listener = (tid, changeInfo, tab) => {
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
    if (!activeTab || !activeTab.id) {
      return { success: false, error: 'No active tab found' };
    }
    const injected = await this.injectContentScripts(activeTab.id);
    if (!injected) {
      return {
        success: false,
        error: `Cannot operate on URL "${activeTab.url || 'unknown'}". System and extension pages cannot be targeted.`
      };
    }
    const res = await Messaging.sendToTab(activeTab.id, message);
    if (res && !res.success && res.error && res.error.includes('Receiving end does not exist')) {
      await new Promise(r => setTimeout(r, 200));
      return await Messaging.sendToTab(activeTab.id, message);
    }
    return res;
  }
}

const executionManager = new TaskExecutionManager();
