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
  const progressBar = document.getElementById('progressBar');
  const stepCounter = document.getElementById('stepCounter');
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
    const response = await msg.sendToBackground({ type: MessageTypes.GET_EXECUTION_STATE });
    if (response && response.activeRun && response.activeRun.status === 'running') {
      const run = response.activeRun;
      executionBanner.classList.remove('hidden');
      runningTaskName.textContent = run.taskName;
      const progress = Math.round(((run.currentStepIndex) / run.totalSteps) * 100);
      progressBar.style.width = `${progress}%`;
      stepCounter.textContent = `Step ${run.currentStepIndex + 1}/${run.totalSteps}`;
    } else {
      executionBanner.classList.add('hidden');
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

  // Stop Active Task
  stopTaskBtn.addEventListener('click', async () => {
    await msg.sendToBackground({ type: MessageTypes.STOP_TASK });
    checkExecutionState();
  });

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
});
