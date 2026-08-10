/**
 * Popup Script for Aura Automator
 */

document.addEventListener('DOMContentLoaded', async () => {
  const taskSelect = document.getElementById('taskSelect');
  const runTaskBtn = document.getElementById('runTaskBtn');
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  const manageTasksBtn = document.getElementById('manageTasksBtn');
  const newTaskBtn = document.getElementById('newTaskBtn');
  const recordTaskBtn = document.getElementById('recordTaskBtn');
  const pickerBtn = document.getElementById('pickerBtn');
  const variablesBtn = document.getElementById('variablesBtn');

  const executionBanner = document.getElementById('executionBanner');
  const runningTaskName = document.getElementById('runningTaskName');
  const stateBadge = document.getElementById('stateBadge');
  const loopCounterBadge = document.getElementById('loopCounterBadge');
  const liveTimerBar = document.getElementById('liveTimerBar');
  const liveTimerText = document.getElementById('liveTimerText');
  const lastLogSnippet = document.getElementById('lastLogSnippet');
  const progressBar = document.getElementById('progressBar');
  const pauseTaskBtn = document.getElementById('pauseTaskBtn');
  const resumeTaskBtn = document.getElementById('resumeTaskBtn');
  const stopTaskBtn = document.getElementById('stopTaskBtn');

  const store = typeof AuraStorage !== 'undefined' ? AuraStorage : window.AuraStorage;
  const msg = typeof Messaging !== 'undefined' ? Messaging : window.Messaging;

  // Load Tasks into Dropdown
  async function loadTasks() {
    const tasks = await store.getTasks();
    taskSelect.innerHTML = '<option value="" disabled selected>Select a task to execute...</option>';

    const enabledTasks = tasks.filter(t => t.enabled !== false);
    if (enabledTasks.length === 0) {
      const opt = document.createElement('option');
      opt.disabled = true;
      opt.textContent = 'No tasks created yet';
      taskSelect.appendChild(opt);
      runTaskBtn.disabled = true;
      return;
    }

    enabledTasks.forEach(task => {
      const opt = document.createElement('option');
      opt.value = task.id;
      opt.textContent = task.name;
      taskSelect.appendChild(opt);
    });

    runTaskBtn.disabled = false;
  }

  // Poll Execution Status
  async function checkExecutionState() {
    try {
      const response = await msg.sendToBackground({ type: MessageTypes.GET_EXECUTION_STATE });
      if (!response) return; // Do not hide banner on temporary response delay
      
      const run = response.activeRun;
      const isActive = run && run.state && run.state !== 'IDLE';

      if (isActive) {
        executionBanner.classList.remove('hidden');

        runningTaskName.textContent = run.taskName || 'Automation Running';

        if (stateBadge) {
          stateBadge.textContent = run.state || 'RUNNING';
          if (run.state === 'PAUSED') {
            stateBadge.style.background = 'rgba(245, 158, 11, 0.2)';
            stateBadge.style.color = '#fbbf24';
            stateBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
          } else if (run.state === 'STOPPED') {
            stateBadge.style.background = 'rgba(239, 68, 68, 0.2)';
            stateBadge.style.color = '#f87171';
            stateBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          } else {
            stateBadge.style.background = 'rgba(139, 92, 246, 0.2)';
            stateBadge.style.color = '#a78bfa';
            stateBadge.style.borderColor = 'rgba(139, 92, 246, 0.4)';
          }
        }

        if (loopCounterBadge) {
          loopCounterBadge.textContent = `LOOP #${run.loopCounter || run.loopCount || 1}`;
        }

        if (liveTimerText) {
          if (['WAITING_SUCCESS_RETRY', 'WAITING_ERROR_RETRY'].includes(run.state)) {
            liveTimerText.textContent = `Countdown: ${run.countdownFormatted || '00:00'} (Next action: Restarting)`;
          } else if (run.state === 'MONITORING_RESULT') {
            liveTimerText.textContent = `Monitoring result (${run.elapsedFormatted || '00:00 / 01:30'})`;
          } else if (run.state === 'PAUSED') {
            liveTimerText.textContent = `PAUSED (${run.countdownFormatted || 'Frozen'})`;
          } else {
            liveTimerText.textContent = run.nextAction || `Status: ${run.state}`;
          }
        }

        if (lastLogSnippet && run.activityLog && run.activityLog.length > 0) {
          lastLogSnippet.textContent = run.activityLog[run.activityLog.length - 1];
        }

        // Toggle Pause / Resume buttons
        if (pauseTaskBtn && resumeTaskBtn) {
          if (run.state === 'PAUSED') {
            pauseTaskBtn.classList.add('hidden');
            resumeTaskBtn.classList.remove('hidden');
          } else if (run.state === 'STOPPED') {
            pauseTaskBtn.classList.add('hidden');
            resumeTaskBtn.classList.add('hidden');
          } else {
            pauseTaskBtn.classList.remove('hidden');
            resumeTaskBtn.classList.add('hidden');
          }
        }

        // Calculate progress bar
        let progress = 25;
        if (run.state === 'NAVIGATING') progress = 25;
        else if (run.state === 'ENTERING_DATA') progress = 50;
        else if (run.state === 'SUBMITTING') progress = 75;
        else if (run.state === 'MONITORING_RESULT') progress = 90;
        else if (['WAITING_SUCCESS_RETRY', 'WAITING_ERROR_RETRY'].includes(run.state)) progress = 100;
        if (progressBar) progressBar.style.width = `${progress}%`;

      } else if (run && (run.state === 'IDLE' || !run.state)) {
        executionBanner.classList.add('hidden');
      }
    } catch (err) {
      console.warn('Error in checkExecutionState:', err);
    }
  }

  // Run Selected Task
  runTaskBtn.addEventListener('click', async () => {
    const taskId = taskSelect.value;
    if (!taskId) return;

    runTaskBtn.disabled = true;
    runTaskBtn.textContent = 'Starting...';

    const res = await msg.sendToBackground({
      type: MessageTypes.RUN_TASK,
      taskId: taskId
    });

    if (res && !res.success) {
      alert(`Error starting task: ${res.error}`);
      runTaskBtn.disabled = false;
      runTaskBtn.innerHTML = '<span class="btn-icon">▶</span> Run Task';
    } else {
      checkExecutionState();
    }
  });

  // Pause Task Button
  if (pauseTaskBtn) {
    pauseTaskBtn.addEventListener('click', async () => {
      await msg.sendToBackground({ type: MessageTypes.PAUSE_TASK });
      checkExecutionState();
    });
  }

  // Resume Task Button
  if (resumeTaskBtn) {
    resumeTaskBtn.addEventListener('click', async () => {
      await msg.sendToBackground({ type: MessageTypes.RESUME_TASK });
      checkExecutionState();
    });
  }

  // Stop Active Task Button
  if (stopTaskBtn) {
    stopTaskBtn.addEventListener('click', async () => {
      await msg.sendToBackground({ type: MessageTypes.STOP_TASK });
      checkExecutionState();
    });
  }

  // Navigation Links - Open App directly to specified tab
  function openDashboardTab(tabName = 'tasks') {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      const dashboardUrl = chrome.runtime.getURL('src/dashboard/dashboard.html?tab=' + tabName);
      chrome.tabs.query({ url: chrome.runtime.getURL('src/dashboard/dashboard.html*') }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, { url: dashboardUrl, active: true });
        } else {
          chrome.tabs.create({ url: dashboardUrl, active: true });
        }
        window.close();
      });
    } else {
      window.open('../dashboard/dashboard.html?tab=' + tabName, '_blank');
    }
  }

  openDashboardBtn.addEventListener('click', () => openDashboardTab('settings'));
  manageTasksBtn.addEventListener('click', () => openDashboardTab('tasks'));
  newTaskBtn.addEventListener('click', () => openDashboardTab('new-task'));
  recordTaskBtn.addEventListener('click', () => openDashboardTab('recorder'));
  variablesBtn.addEventListener('click', () => openDashboardTab('variables'));

  // Trigger Element Picker on Active Tab
  pickerBtn.addEventListener('click', async () => {
    await msg.sendToBackground({ type: MessageTypes.START_ELEMENT_PICKER });
    window.close();
  });

  // Status Listener
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MessageTypes.STEP_STATUS) {
      checkExecutionState();
    }
  });

  await loadTasks();
  await checkExecutionState();

  // Lightweight 1-second polling timer while popup is open
  setInterval(checkExecutionState, 1000);
});
