/**
 * Main Web Dashboard Controller for WebTask Automator
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Global State
  let currentTasks = [];
  let currentVariables = {};
  let currentHistory = [];
  let currentSettings = {};
  let currentPickedElements = [];
  let editingTask = null;
  let activePickerStepIndex = null;
  let recordedSteps = [];

  // DOM Elements - Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const globalSearchInput = document.getElementById('globalSearchInput');

  // DOM Elements - Tasks Tab
  const tasksGrid = document.getElementById('tasksGrid');
  const newTaskBtn = document.getElementById('newTaskBtn');
  const sidebarNewTaskBtn = document.getElementById('sidebarNewTaskBtn');
  const taskCountBadge = document.getElementById('taskCountBadge');
  const metricTotalTasks = document.getElementById('metricTotalTasks');
  const metricActiveTasks = document.getElementById('metricActiveTasks');
  const metricTotalRuns = document.getElementById('metricTotalRuns');
  const metricSuccessRate = document.getElementById('metricSuccessRate');

  // DOM Elements - Picked Elements Library
  const pickedElementsTableBody = document.getElementById('pickedElementsTableBody');
  const triggerDashboardPickerBtn = document.getElementById('triggerDashboardPickerBtn');
  const clearPickedBtn = document.getElementById('clearPickedBtn');

  // DOM Elements - Task Editor Modal
  const taskEditorModal = document.getElementById('taskEditorModal');
  const editorModalTitle = document.getElementById('editorModalTitle');
  const closeEditorModalBtn = document.getElementById('closeEditorModalBtn');
  const cancelTaskBtn = document.getElementById('cancelTaskBtn');
  const saveTaskBtn = document.getElementById('saveTaskBtn');
  const taskNameInput = document.getElementById('taskNameInput');
  const taskUrlInput = document.getElementById('taskUrlInput');
  const taskLoopToggle = document.getElementById('taskLoopToggle');
  const taskLoopIntervalInput = document.getElementById('taskLoopIntervalInput');
  const loopIntervalGroup = document.getElementById('loopIntervalGroup');
  const editorStepsList = document.getElementById('editorStepsList');
  const addStepBtn = document.getElementById('addStepBtn');

  // DOM Elements - Recorder Tab
  const recorderUrlInput = document.getElementById('recorderUrlInput');
  const startRecorderBtn = document.getElementById('startRecorderBtn');
  const convertToTaskBtn = document.getElementById('convertToTaskBtn');
  const recordedStepsList = document.getElementById('recordedStepsList');

  // DOM Elements - Variables Tab
  const variablesTableBody = document.getElementById('variablesTableBody');
  const addVariableBtn = document.getElementById('addVariableBtn');

  // DOM Elements - History Tab
  const historyTableBody = document.getElementById('historyTableBody');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyDetailModal = document.getElementById('historyDetailModal');
  const historyDetailTitle = document.getElementById('historyDetailTitle');
  const historyDetailBody = document.getElementById('historyDetailBody');
  const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
  const closeHistoryModalFooterBtn = document.getElementById('closeHistoryModalFooterBtn');

  // DOM Elements - Settings Tab
  const settingStepTimeout = document.getElementById('settingStepTimeout');
  const settingRetries = document.getElementById('settingRetries');
  const settingRetryDelay = document.getElementById('settingRetryDelay');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const exportBackupBtn = document.getElementById('exportBackupBtn');
  const importBackupBtn = document.getElementById('importBackupBtn');
  const importFileInput = document.getElementById('importFileInput');

  // --- INITIALIZATION ---
  async function init() {
    await AuraStorage.init();
    await loadAllData();
    setupTabNavigation();
    setupEventListeners();
    setupMessageListeners();
    checkUrlParams();
  }

  async function loadAllData() {
    currentTasks = await AuraStorage.getTasks();
    currentVariables = await AuraStorage.getVariables();
    currentHistory = await AuraStorage.getHistory();
    currentSettings = await AuraStorage.getSettings();
    currentPickedElements = await AuraStorage.getPickedElements();

    renderMetrics();
    renderTasksGrid();
    renderVariablesTable();
    renderHistoryTable();
    renderPickedElementsTable();
    populateSettingsForm();
  }

  // --- TAB NAVIGATION ---
  function setupTabNavigation() {
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tabTarget = item.getAttribute('data-tab');
        switchTab(tabTarget);
      });
    });
  }

  function switchTab(tabTarget) {
    if (tabTarget === 'new-task') {
      openTaskEditor();
      return;
    }

    navItems.forEach(nav => nav.classList.remove('active'));
    tabPanes.forEach(pane => pane.classList.remove('active'));

    const activeNav = document.querySelector(`.nav-item[data-tab="${tabTarget}"]`);
    const activePane = document.getElementById(`tab-${tabTarget}`);

    if (activeNav) activeNav.classList.add('active');
    if (activePane) activePane.classList.add('active');

    if (tabTarget === 'recorder') {
      checkRecordingState();
    }
  }

  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      switchTab(tabParam);
    }
  }

  // --- THEME TOGGLE ---
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    themeToggleBtn.textContent = isLight ? '☀️' : '🌙';
  });

  // --- METRICS & TASKS RENDER ---
  function renderMetrics() {
    metricTotalTasks.textContent = currentTasks.length;
    metricActiveTasks.textContent = currentTasks.filter(t => t.enabled !== false).length;
    metricTotalRuns.textContent = currentHistory.length;

    if (currentHistory.length > 0) {
      const successes = currentHistory.filter(h => h.status === 'completed').length;
      const rate = Math.round((successes / currentHistory.length) * 100);
      metricSuccessRate.textContent = `${rate}%`;
    } else {
      metricSuccessRate.textContent = '100%';
    }

    taskCountBadge.textContent = `${currentTasks.length} tasks`;
  }

  function renderTasksGrid(filterQuery = '') {
    tasksGrid.innerHTML = '';

    const filtered = currentTasks.filter(task => {
      if (!filterQuery) return true;
      const q = filterQuery.toLowerCase();
      return task.name.toLowerCase().includes(q) || (task.url && task.url.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      tasksGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <span class="empty-icon">📋</span>
          <p>No automation tasks found. Click <strong>Create New Task</strong> to build your first workflow.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.innerHTML = `
        <div class="task-card-header">
          <div class="task-title-group">
            <h4>${escapeHtml(task.name)}</h4>
            <a href="${escapeHtml(task.url || '#')}" target="_blank" class="task-url">${escapeHtml(task.url || 'No URL')}</a>
          </div>
          <label class="switch" title="Enable/Disable Task">
            <input type="checkbox" class="task-toggle-btn" data-id="${task.id}" ${task.enabled !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="task-card-body">
          <div class="step-summary-badge">
            ⚙️ ${task.steps ? task.steps.length : 0} Automation Steps ${task.loopTask ? ' | 🔁 Continuous Loop Active' : ''}
          </div>
        </div>

        <div class="task-card-footer">
          <div class="action-btn-group">
            <button class="btn btn-primary btn-sm run-task-btn" data-id="${task.id}">▶ Run</button>
            <button class="btn btn-secondary btn-sm edit-task-btn" data-id="${task.id}">✏ Edit</button>
            <button class="btn btn-secondary btn-sm dup-task-btn" data-id="${task.id}" title="Duplicate">📋</button>
            <button class="btn btn-danger btn-sm del-task-btn" data-id="${task.id}" title="Delete">🗑</button>
          </div>
        </div>
      `;

      // Event Listeners on Card Buttons
      card.querySelector('.run-task-btn').onclick = () => runTask(task.id);
      card.querySelector('.edit-task-btn').onclick = () => openTaskEditor(task);
      card.querySelector('.dup-task-btn').onclick = () => duplicateTask(task.id);
      card.querySelector('.del-task-btn').onclick = () => deleteTask(task.id);
      card.querySelector('.task-toggle-btn').onchange = (e) => toggleTaskEnabled(task.id, e.target.checked);

      tasksGrid.appendChild(card);
    });
  }

  // Task Actions
  async function runTask(taskId) {
    const res = await Messaging.sendToBackground({ type: MessageTypes.RUN_TASK, taskId });
    if (res && res.success) {
      alert('▶ Task execution started in background!');
    } else {
      alert(`Error starting task: ${res ? res.error : 'Unknown error'}`);
    }
  }

  async function duplicateTask(taskId) {
    await AuraStorage.duplicateTask(taskId);
    await loadAllData();
  }

  async function deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
      await AuraStorage.deleteTask(taskId);
      await loadAllData();
    }
  }

  async function toggleTaskEnabled(taskId, enabled) {
    const task = await AuraStorage.getTask(taskId);
    if (task) {
      task.enabled = enabled;
      await AuraStorage.saveTask(task);
      renderMetrics();
    }
  }

  // --- TASK EDITOR MODAL & STEP BUILDER ---
  function openTaskEditor(task = null) {
    editingTask = task;
    editorModalTitle.textContent = task ? 'Edit Automation Task' : 'Create Automation Task';

    taskNameInput.value = task ? task.name : '';
    taskUrlInput.value = task ? task.url : '';

    if (taskLoopToggle) {
      taskLoopToggle.checked = !!(task && task.loopTask);
      if (loopIntervalGroup) {
        loopIntervalGroup.style.display = taskLoopToggle.checked ? 'block' : 'none';
      }
      taskLoopToggle.onchange = () => {
        if (loopIntervalGroup) {
          loopIntervalGroup.style.display = taskLoopToggle.checked ? 'block' : 'none';
        }
      };
    }
    if (taskLoopIntervalInput) {
      taskLoopIntervalInput.value = task && task.loopInterval !== undefined ? task.loopInterval : 1000;
    }

    const inSel = document.getElementById('taskInputSelector');
    const inTxt = document.getElementById('taskInputText');
    const subSel = document.getElementById('taskSubmitSelector');
    const succSel = document.getElementById('taskSuccessSelector');
    const errSel = document.getElementById('taskErrorSelector');
    const servErr = document.getElementById('taskServerErrorDetection');
    const succDel = document.getElementById('taskSuccessDelay');
    const errDel = document.getElementById('taskErrorDelay');
    const resTimeout = document.getElementById('taskResultTimeout');
    const resMinWait = document.getElementById('taskResultMinWait');

    if (inSel) inSel.value = task ? (task.inputSelector || '') : '#instagram-link';
    if (inTxt) inTxt.value = task ? (task.inputText || '') : '{Link01}';
    if (subSel) subSel.value = task ? (task.submitSelector || '') : '#submit-btn';
    if (succSel) succSel.value = task ? (task.successSelector || '') : 'div.thanks-page-success';
    if (errSel) errSel.value = task ? (task.errorSelector || '') : 'div.thanks-page-error';
    if (servErr) servErr.value = task ? (task.serverErrorDetection || 'server_connection_error') : 'server_connection_error';
    if (succDel) succDel.value = task ? (task.successDelay || 300000) : 300000;
    if (errDel) errDel.value = task ? (task.errorDelay || 120000) : 120000;
    if (resTimeout) resTimeout.value = task ? (task.resultTimeout || 120000) : 120000;
    if (resMinWait) resMinWait.value = task ? (task.resultMinimumWait || 120000) : 120000;

    const steps = task && task.steps ? JSON.parse(JSON.stringify(task.steps)) : [
      { id: 'step_1', type: 'navigate', url: task && task.url ? task.url : 'https://example.com', description: 'Open Website URL' }
    ];

    renderEditorSteps(steps);
    taskEditorModal.classList.remove('hidden');
  }

  function closeTaskEditor() {
    taskEditorModal.classList.add('hidden');
    editingTask = null;
  }

  function renderEditorSteps(steps) {
    editorStepsList.innerHTML = '';

    steps.forEach((step, index) => {
      const card = document.createElement('div');
      card.className = 'step-card';
      const isIfCard = step.type === 'if_condition';
      const isLoopCard = step.type === 'repeat' || (step.loopMode && step.loopMode !== 'fixed');
      card.className = `step-card ${isIfCard ? 'if-card' : ''} ${isLoopCard ? 'loop-card' : ''}`;
      card.dataset.index = index;

      card.innerHTML = `
        <div class="step-card-header">
          <span class="step-number-badge">${isIfCard ? '⚡ IF / ELSE' : (isLoopCard ? '<span class="loop-anim-icon">🔁</span> LOOP' : `Step ${index + 1}`)}</span>
          <div class="step-controls">
            <button class="btn btn-secondary btn-sm move-up-btn" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button class="btn btn-secondary btn-sm move-down-btn" ${index === steps.length - 1 ? 'disabled' : ''}>▼</button>
            <button class="btn btn-secondary btn-sm dup-step-btn">📋</button>
            <button class="btn btn-danger btn-sm del-step-btn">✕</button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label>Action Type</label>
            <select class="step-type-select">
              <option value="if_condition" ${step.type === 'if_condition' ? 'selected' : ''}>⚡ IF / ELSE Condition Logic</option>
              <option value="navigate" ${step.type === 'navigate' ? 'selected' : ''}>🌐 Open URL</option>
              <option value="click" ${step.type === 'click' ? 'selected' : ''}>🖱️ Click Element</option>
              <option value="double_click" ${step.type === 'double_click' ? 'selected' : ''}>🖱️ Double Click</option>
              <option value="focus" ${step.type === 'focus' ? 'selected' : ''}>🎯 Focus Element</option>
              <option value="type" ${step.type === 'type' ? 'selected' : ''}>✍️ Type Text</option>
              <option value="paste" ${step.type === 'paste' ? 'selected' : ''}>📋 Paste Text</option>
              <option value="clear" ${step.type === 'clear' ? 'selected' : ''}>🧹 Clear Field</option>
              <option value="select" ${step.type === 'select' ? 'selected' : ''}>🔽 Select Dropdown</option>
              <option value="check" ${step.type === 'check' ? 'selected' : ''}>☑️ Check Box</option>
              <option value="uncheck" ${step.type === 'uncheck' ? 'selected' : ''}>⏹️ Uncheck Box</option>
              <option value="press_key" ${step.type === 'press_key' ? 'selected' : ''}>⌨️ Press Key</option>
              <option value="wait_time" ${step.type === 'wait_time' ? 'selected' : ''}>⏱️ Wait Duration (ms)</option>
              <option value="wait_element" ${step.type === 'wait_element' ? 'selected' : ''}>⏳ Wait for Element</option>
              <option value="wait_text" ${step.type === 'wait_text' ? 'selected' : ''}>🔤 Wait for Text</option>
              <option value="wait_page_load" ${step.type === 'wait_page_load' ? 'selected' : ''}>🔄 Wait Page Load</option>
              <option value="hover" ${step.type === 'hover' ? 'selected' : ''}>👆 Hover Element</option>
              <option value="scroll_element" ${step.type === 'scroll_element' ? 'selected' : ''}>📜 Scroll to Element</option>
              <option value="scroll_page" ${step.type === 'scroll_page' ? 'selected' : ''}>📜 Scroll Page</option>
              <option value="repeat" ${step.type === 'repeat' ? 'selected' : ''}>🔁 Repeat Loop Action</option>
            </select>
          </div>
        </div>

        <div class="step-dynamic-fields">
          <!-- Rendered based on action type -->
        </div>
      `;

      const dynamicContainer = card.querySelector('.step-dynamic-fields');
      renderStepDynamicFields(step, dynamicContainer, index);

      // Event Listeners for Step Controls
      card.querySelector('.step-type-select').onchange = (e) => {
        step.type = e.target.value;
        renderEditorSteps(getEditorStepsFromDOM());
      };
      card.querySelector('.move-up-btn').onclick = () => moveStep(index, -1);
      card.querySelector('.move-down-btn').onclick = () => moveStep(index, 1);
      card.querySelector('.dup-step-btn').onclick = () => duplicateStepIndex(index);
      card.querySelector('.del-step-btn').onclick = () => deleteStepIndex(index);

      editorStepsList.appendChild(card);
    });
  }

  function renderStepDynamicFields(step, container, index) {
    container.innerHTML = '';
    const type = step.type;

    if (type === 'if_condition') {
      const condType = step.conditionType || 'element_exists';
      const thenAct = step.thenAction || 'continue';
      const elseAct = step.elseAction || 'continue';

      container.innerHTML = `
        <div class="form-group">
          <label style="font-weight: 700; color: var(--accent-primary);">⚡ IF Condition Rule</label>
          <select class="step-condition-type-select">
            <option value="element_exists" ${condType === 'element_exists' ? 'selected' : ''}>👁️ Target Element Exists / Visible</option>
            <option value="element_not_exists" ${condType === 'element_not_exists' ? 'selected' : ''}>🚫 Target Element Does Not Exist</option>
            <option value="text_contains" ${condType === 'text_contains' ? 'selected' : ''}>🔤 Webpage Contains Text</option>
            <option value="text_not_contains" ${condType === 'text_not_contains' ? 'selected' : ''}>🔤 Webpage Does Not Contain Text</option>
            <option value="variable_equals" ${condType === 'variable_equals' ? 'selected' : ''}>🔢 Variable Equals Expected Value</option>
            <option value="variable_not_equals" ${condType === 'variable_not_equals' ? 'selected' : ''}>🔢 Variable Does Not Equal Expected Value</option>
            <option value="variable_contains" ${condType === 'variable_contains' ? 'selected' : ''}>🔢 Variable Contains Substring</option>
            <option value="checkbox_checked" ${condType === 'checkbox_checked' ? 'selected' : ''}>☑️ Checkbox / Radio Is Checked</option>
            <option value="url_contains" ${condType === 'url_contains' ? 'selected' : ''}>🌐 Page URL Contains Substring</option>
            <option value="server_connection_error" ${condType === 'server_connection_error' ? 'selected' : ''}>🖥️ Server Connection Error / 502 / 503 / Offline</option>
          </select>
        </div>

        <div class="condition-target-fields" style="margin-top: 8px;">
          <!-- Dynamically populated condition inputs -->
        </div>

        <!-- THEN Branch Box -->
        <div class="branch-block then-branch">
          <div class="branch-header">⚡ THEN Branch (If Condition is TRUE)</div>
          <div class="form-row">
            <div class="form-group flex-1">
              <label>Action to Perform</label>
              <select class="step-then-action-select">
                <option value="continue" ${thenAct === 'continue' ? 'selected' : ''}>➡️ Continue to Next Step</option>
                <option value="skip_steps" ${thenAct === 'skip_steps' ? 'selected' : ''}>⏭️ Skip Next N Steps</option>
                <option value="jump_to_step" ${thenAct === 'jump_to_step' ? 'selected' : ''}>🎯 Jump to Step #</option>
                <option value="stop_task" ${thenAct === 'stop_task' ? 'selected' : ''}>🛑 Stop Task Execution</option>
              </select>
            </div>
            <div class="form-group then-skip-group flex-1" style="display: ${thenAct === 'skip_steps' ? 'block' : 'none'};">
              <label>Steps to Skip</label>
              <input type="number" class="step-then-skip-input" value="${step.thenSkipCount || 1}" min="1" max="100">
            </div>
            <div class="form-group then-jump-group flex-1" style="display: ${thenAct === 'jump_to_step' ? 'block' : 'none'};">
              <label>Target Step Index</label>
              <input type="number" class="step-then-jump-input" value="${step.thenJumpStep || 1}" min="1" max="100">
            </div>
          </div>
        </div>

        <!-- ELSE Branch Box -->
        <div class="branch-block else-branch">
          <div class="branch-header">🔀 ELSE Branch (If Condition is FALSE)</div>
          <div class="form-row">
            <div class="form-group flex-1">
              <label>Action to Perform</label>
              <select class="step-else-action-select">
                <option value="continue" ${elseAct === 'continue' ? 'selected' : ''}>➡️ Continue to Next Step</option>
                <option value="skip_steps" ${elseAct === 'skip_steps' ? 'selected' : ''}>⏭️ Skip Next N Steps</option>
                <option value="jump_to_step" ${elseAct === 'jump_to_step' ? 'selected' : ''}>🎯 Jump to Step #</option>
                <option value="stop_task" ${elseAct === 'stop_task' ? 'selected' : ''}>🛑 Stop Task Execution</option>
              </select>
            </div>
            <div class="form-group else-skip-group flex-1" style="display: ${elseAct === 'skip_steps' ? 'block' : 'none'};">
              <label>Steps to Skip</label>
              <input type="number" class="step-else-skip-input" value="${step.elseSkipCount || 1}" min="1" max="100">
            </div>
            <div class="form-group else-jump-group flex-1" style="display: ${elseAct === 'jump_to_step' ? 'block' : 'none'};">
              <label>Target Step Index</label>
              <input type="number" class="step-else-jump-input" value="${step.elseJumpStep || 1}" min="1" max="100">
            </div>
          </div>
        </div>
      `;

      const condTargetContainer = container.querySelector('.condition-target-fields');
      const renderCondTargets = () => {
        const cType = container.querySelector('.step-condition-type-select').value;
        if (['element_exists', 'element_not_exists', 'checkbox_checked'].includes(cType)) {
          condTargetContainer.innerHTML = `
            <div class="form-group">
              <label>Target Selector / XPath</label>
              <div class="input-with-button">
                <input type="text" class="step-selector-input" value="${escapeHtml(step.selector || '')}" placeholder="e.g. #submitBtn or //button[text()='Submit']">
                <button type="button" class="picker-trigger-btn" data-index="${index}">🎯 Select Element</button>
              </div>
            </div>
          `;
          const pBtn = condTargetContainer.querySelector('.picker-trigger-btn');
          if (pBtn) pBtn.onclick = () => triggerElementPicker(index);
        } else if (['text_contains', 'text_not_contains', 'url_contains'].includes(cType)) {
          condTargetContainer.innerHTML = `
            <div class="form-group">
              <label>Text String to Match</label>
              <input type="text" class="step-text-input" value="${escapeHtml(step.text || '')}" placeholder="e.g. Success or Thank You">
            </div>
            ${cType !== 'url_contains' ? `
              <div class="form-group">
                <label>Optional Container Selector</label>
                <input type="text" class="step-selector-input" value="${escapeHtml(step.selector || '')}" placeholder="Leave blank for entire webpage">
              </div>
            ` : ''}
          `;
        } else if (['variable_equals', 'variable_not_equals', 'variable_contains'].includes(cType)) {
          condTargetContainer.innerHTML = `
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Variable / Token</label>
                <input type="text" class="step-var-val-input" value="${escapeHtml(step.variableValue || '{name}')}" placeholder="e.g. {name} or {status}">
              </div>
              <div class="form-group flex-1">
                <label>Expected Value</label>
                <input type="text" class="step-expected-input" value="${escapeHtml(step.expectedValue || '')}" placeholder="e.g. Approved or 100">
              </div>
            </div>
          `;
        }
      };

      renderCondTargets();

      container.querySelector('.step-condition-type-select').onchange = () => {
        renderCondTargets();
      };

      const thenSel = container.querySelector('.step-then-action-select');
      thenSel.onchange = () => {
        container.querySelector('.then-skip-group').style.display = thenSel.value === 'skip_steps' ? 'block' : 'none';
        container.querySelector('.then-jump-group').style.display = thenSel.value === 'jump_to_step' ? 'block' : 'none';
      };

      const elseSel = container.querySelector('.step-else-action-select');
      elseSel.onchange = () => {
        container.querySelector('.else-skip-group').style.display = elseSel.value === 'skip_steps' ? 'block' : 'none';
        container.querySelector('.else-jump-group').style.display = elseSel.value === 'jump_to_step' ? 'block' : 'none';
      };

      return;
    } else if (type === 'navigate') {
      container.innerHTML = `
        <div class="form-group">
          <label>URL to Open</label>
          <input type="url" class="step-url-input" value="${escapeHtml(step.url || '')}" placeholder="https://example.com">
        </div>
      `;
    } else if (['click', 'double_click', 'focus', 'clear', 'check', 'uncheck', 'hover', 'scroll_element', 'wait_element'].includes(type)) {
      container.innerHTML = `
        <div class="form-group">
          <label>Target CSS Selector / XPath</label>
          <div class="input-with-button">
            <input type="text" class="step-selector-input" value="${escapeHtml(step.selector || '')}" placeholder="e.g. #submitBtn or //button[text()='Submit']">
            <button type="button" class="picker-trigger-btn" data-index="${index}">🎯 Select Element</button>
          </div>
        </div>
      `;
    } else if (type === 'type' || type === 'paste') {
      container.innerHTML = `
        <div class="form-group">
          <label>Target CSS Selector / XPath</label>
          <div class="input-with-button">
            <input type="text" class="step-selector-input" value="${escapeHtml(step.selector || '')}" placeholder="e.g. textarea[name='message']">
            <button type="button" class="picker-trigger-btn" data-index="${index}">🎯 Select Element</button>
          </div>
        </div>
        <div class="form-group">
          <label>Text to Enter</label>
          <textarea class="step-text-input" rows="3" placeholder="Hello {name}, iteration {loop_index}...">${escapeHtml(step.text || '')}</textarea>
          <div class="variable-pills-container">
            <span class="variable-pill" data-var="{name}">{name}</span>
            <span class="variable-pill" data-var="{email}">{email}</span>
            <span class="variable-pill" data-var="{loop_index}">{loop_index}</span>
            <span class="variable-pill" data-var="{loop_count}">{loop_count}</span>
          </div>
        </div>
      `;
    } else if (type === 'select') {
      container.innerHTML = `
        <div class="form-group">
          <label>Target CSS Selector</label>
          <div class="input-with-button">
            <input type="text" class="step-selector-input" value="${escapeHtml(step.selector || '')}" placeholder="e.g. select#country">
            <button type="button" class="picker-trigger-btn" data-index="${index}">🎯 Select Element</button>
          </div>
        </div>
        <div class="form-group">
          <label>Option Value or Label</label>
          <input type="text" class="step-value-input" value="${escapeHtml(step.value || '')}" placeholder="e.g. US or Support">
        </div>
      `;
    } else if (type === 'press_key') {
      container.innerHTML = `
        <div class="form-row">
          <div class="form-group flex-1">
            <label>Key Name</label>
            <input type="text" class="step-key-input" value="${escapeHtml(step.key || 'Enter')}" placeholder="Enter, Tab, Escape, ArrowDown">
          </div>
          <div class="form-group flex-1">
            <label>Optional Target Selector</label>
            <input type="text" class="step-selector-input" value="${escapeHtml(step.selector || '')}" placeholder="Body or input field">
          </div>
        </div>
      `;
    } else if (type === 'wait_time') {
      container.innerHTML = `
        <div class="form-group">
          <label>Duration (milliseconds)</label>
          <input type="number" class="step-duration-input" value="${step.duration || 2000}" min="100" step="100">
          <div class="duration-presets-container" style="display: flex; gap: 6px; margin-top: 6px;">
            <button type="button" class="btn btn-secondary btn-sm duration-preset-btn" data-ms="3000">3 sec</button>
            <button type="button" class="btn btn-secondary btn-sm duration-preset-btn" data-ms="10000">10 sec</button>
            <button type="button" class="btn btn-secondary btn-sm duration-preset-btn" data-ms="30000">30 sec</button>
            <button type="button" class="btn btn-secondary btn-sm duration-preset-btn" data-ms="60000">1 min</button>
          </div>
        </div>
      `;
      setTimeout(() => {
        container.querySelectorAll('.duration-preset-btn').forEach(btn => {
          btn.onclick = () => {
            const input = container.querySelector('.step-duration-input');
            if (input) input.value = btn.getAttribute('data-ms');
          };
        });
      }, 0);
    } else if (type === 'wait_text') {
      container.innerHTML = `
        <div class="form-group">
          <label>Text to Wait For</label>
          <input type="text" class="step-text-input" value="${escapeHtml(step.text || '')}" placeholder="e.g. Success or Thank You">
        </div>
        <div class="form-group">
          <label>Optional Container Selector</label>
          <input type="text" class="step-selector-input" value="${escapeHtml(step.selector || '')}" placeholder="Leave blank for entire page">
        </div>
      `;
    } else if (type === 'scroll_page') {
      container.innerHTML = `
        <div class="form-group">
          <label>Vertical Scroll Position Y (px)</label>
          <input type="number" class="step-y-input" value="${step.y || 500}" step="50">
        </div>
      `;
    } else if (type === 'repeat') {
      const mode = step.loopMode || 'fixed';
      container.innerHTML = `
        <div class="form-row">
          <div class="form-group flex-1">
            <label>🔁 Loop Execution Mode</label>
            <select class="step-loop-mode-select">
              <option value="fixed" ${mode === 'fixed' ? 'selected' : ''}>🔢 Fixed Repeat Count (N Times)</option>
              <option value="while_element" ${mode === 'while_element' ? 'selected' : ''}>👁️ While Target Element Exists</option>
              <option value="while_text" ${mode === 'while_text' ? 'selected' : ''}>🔤 While Text Appears On Page</option>
              <option value="for_each" ${mode === 'for_each' ? 'selected' : ''}>📋 For Each Element Matching Selector</option>
            </select>
          </div>
          <div class="form-group flex-1">
            <label>Target Action to Repeat</label>
            <select class="step-subaction-select">
              <option value="click" ${step.actionType === 'click' ? 'selected' : ''}>🖱️ Click Element</option>
              <option value="type" ${step.actionType === 'type' ? 'selected' : ''}>✍️ Type Text</option>
              <option value="press_key" ${step.actionType === 'press_key' ? 'selected' : ''}>⌨️ Press Key</option>
              <option value="scroll_page" ${step.actionType === 'scroll_page' ? 'selected' : ''}>📜 Scroll Page</option>
            </select>
          </div>
        </div>

        <div class="form-row repeat-count-group" style="display: ${mode === 'fixed' ? 'flex' : 'none'}; gap: 12px; margin-bottom: 12px;">
          <div class="form-group flex-1">
            <label>🔁 Repeat Count (x)</label>
            <input type="number" class="step-repeat-input" value="${step.repeat || 1}" min="1" max="500" placeholder="1">
          </div>
          <div class="form-group flex-1">
            <label>⏱️ Interval Between Repeats (ms)</label>
            <input type="number" class="step-interval-input" value="${step.repeatInterval !== undefined ? step.repeatInterval : 500}" min="0" step="100" placeholder="500">
          </div>
        </div>

        <div class="form-group">
          <label>Target CSS Selector / XPath</label>
          <div class="input-with-button">
            <input type="text" class="step-selector-input" value="${escapeHtml(step.selector || '')}" placeholder="e.g. .list-item button">
            <button type="button" class="picker-trigger-btn" data-index="${index}">🎯 Select Element</button>
          </div>
        </div>

        <div class="form-group max-loops-group" style="display: ${['while_element', 'while_text'].includes(mode) ? 'block' : 'none'};">
          <label>Safety Guard Max Iterations Limit</label>
          <input type="number" class="step-max-loops-input" value="${step.maxLoops || 50}" min="1" max="1000">
        </div>
      `;

      container.querySelector('.step-loop-mode-select').onchange = (e) => {
        const m = e.target.value;
        const countGrp = container.querySelector('.repeat-count-group');
        if (countGrp) countGrp.style.display = m === 'fixed' ? 'flex' : 'none';
        const maxGrp = container.querySelector('.max-loops-group');
        if (maxGrp) maxGrp.style.display = ['while_element', 'while_text'].includes(m) ? 'block' : 'none';
      };
    }

    // Attach Picker button event listener
    const pickerBtn = container.querySelector('.picker-trigger-btn');
    if (pickerBtn) {
      pickerBtn.onclick = () => triggerElementPicker(index);
    }

    // Attach Variable pill event listeners
    const pills = container.querySelectorAll('.variable-pill');
    pills.forEach(pill => {
      pill.onclick = () => {
        const textInput = container.querySelector('.step-text-input');
        if (textInput) {
          const varTag = pill.getAttribute('data-var');
          textInput.value += varTag;
        }
      };
    });
  }

  function getEditorStepsFromDOM() {
    const cards = editorStepsList.querySelectorAll('.step-card');
    const steps = [];

    cards.forEach((card, idx) => {
      const type = card.querySelector('.step-type-select').value;
      const step = {
        id: `step_${idx + 1}_${Date.now()}`,
        type: type
      };

      if (type === 'if_condition') {
        const condTypeSel = card.querySelector('.step-condition-type-select');
        if (condTypeSel) step.conditionType = condTypeSel.value;

        const selIn = card.querySelector('.step-selector-input');
        if (selIn) step.selector = selIn.value;

        const textIn = card.querySelector('.step-text-input');
        if (textIn) step.text = textIn.value;

        const varValIn = card.querySelector('.step-var-val-input');
        if (varValIn) step.variableValue = varValIn.value;

        const expIn = card.querySelector('.step-expected-input');
        if (expIn) step.expectedValue = expIn.value;

        const thenActSel = card.querySelector('.step-then-action-select');
        if (thenActSel) step.thenAction = thenActSel.value;

        const thenSkipIn = card.querySelector('.step-then-skip-input');
        if (thenSkipIn) step.thenSkipCount = parseInt(thenSkipIn.value, 10) || 1;

        const thenJumpIn = card.querySelector('.step-then-jump-input');
        if (thenJumpIn) step.thenJumpStep = parseInt(thenJumpIn.value, 10) || 1;

        const elseActSel = card.querySelector('.step-else-action-select');
        if (elseActSel) step.elseAction = elseActSel.value;

        const elseSkipIn = card.querySelector('.step-else-skip-input');
        if (elseSkipIn) step.elseSkipCount = parseInt(elseSkipIn.value, 10) || 1;

        const elseJumpIn = card.querySelector('.step-else-jump-input');
        if (elseJumpIn) step.elseJumpStep = parseInt(elseJumpIn.value, 10) || 1;
      } else {
        const urlIn = card.querySelector('.step-url-input');
        if (urlIn) step.url = urlIn.value;

        const selIn = card.querySelector('.step-selector-input');
        if (selIn) step.selector = selIn.value;

        const textIn = card.querySelector('.step-text-input');
        if (textIn) step.text = textIn.value;

        const valIn = card.querySelector('.step-value-input');
        if (valIn) step.value = valIn.value;

        const keyIn = card.querySelector('.step-key-input');
        if (keyIn) step.key = keyIn.value;

        const loopModeSel = card.querySelector('.step-loop-mode-select');
        if (loopModeSel) step.loopMode = loopModeSel.value;

        const maxLoopsIn = card.querySelector('.step-max-loops-input');
        if (maxLoopsIn) step.maxLoops = parseInt(maxLoopsIn.value, 10) || 50;

        const subAct = card.querySelector('.step-subaction-select');
        if (subAct) step.actionType = subAct.value;

        const durIn = card.querySelector('.step-duration-input');
        if (durIn) step.duration = parseInt(durIn.value, 10) || 1000;

        const yIn = card.querySelector('.step-y-input');
        if (yIn) step.y = parseInt(yIn.value, 10) || 500;

        const repIn = card.querySelector('.step-repeat-input');
        if (repIn) step.repeat = parseInt(repIn.value, 10) || 1;

        const intIn = card.querySelector('.step-interval-input');
        if (intIn) step.repeatInterval = parseInt(intIn.value, 10) !== undefined ? parseInt(intIn.value, 10) : 500;
      }

      steps.push(step);
    });

    return steps;
  }

  function moveStep(index, direction) {
    const steps = getEditorStepsFromDOM();
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const temp = steps[index];
    steps[index] = steps[targetIdx];
    steps[targetIdx] = temp;
    renderEditorSteps(steps);
  }

  function duplicateStepIndex(index) {
    const steps = getEditorStepsFromDOM();
    const dup = JSON.parse(JSON.stringify(steps[index]));
    dup.id = `step_${Date.now()}`;
    steps.splice(index + 1, 0, dup);
    renderEditorSteps(steps);
  }

  function deleteStepIndex(index) {
    const steps = getEditorStepsFromDOM();
    steps.splice(index, 1);
    renderEditorSteps(steps);
  }

  addStepBtn.onclick = () => {
    const steps = getEditorStepsFromDOM();
    steps.push({
      id: `step_${steps.length + 1}_${Date.now()}`,
      type: 'click',
      selector: '',
      description: 'Click Action'
    });
    renderEditorSteps(steps);
  };

  // Save Task
  saveTaskBtn.onclick = async () => {
    try {
      const name = taskNameInput.value.trim();
      const url = taskUrlInput.value.trim();
      const steps = getEditorStepsFromDOM();

      if (!name) {
        alert('Please enter a task name.');
        return;
      }

      const task = (editingTask && editingTask.id) ? editingTask : {
        id: 'task_' + Date.now(),
        createdAt: Date.now(),
        enabled: true
      };

      task.name = name;
      task.url = url;
      task.websiteUrl = url;
      task.inputSelector = document.getElementById('taskInputSelector') ? document.getElementById('taskInputSelector').value : '';
      task.inputText = document.getElementById('taskInputText') ? document.getElementById('taskInputText').value : '';
      task.submitSelector = document.getElementById('taskSubmitSelector') ? document.getElementById('taskSubmitSelector').value : '';
      task.successSelector = document.getElementById('taskSuccessSelector') ? document.getElementById('taskSuccessSelector').value : '';
      task.errorSelector = document.getElementById('taskErrorSelector') ? document.getElementById('taskErrorSelector').value : '';
      task.serverErrorDetection = document.getElementById('taskServerErrorDetection') ? document.getElementById('taskServerErrorDetection').value : 'server_connection_error';
      task.successDelay = document.getElementById('taskSuccessDelay') ? parseInt(document.getElementById('taskSuccessDelay').value, 10) || 300000 : 300000;
      task.errorDelay = document.getElementById('taskErrorDelay') ? parseInt(document.getElementById('taskErrorDelay').value, 10) || 120000 : 120000;
      task.resultTimeout = document.getElementById('taskResultTimeout') ? parseInt(document.getElementById('taskResultTimeout').value, 10) || 120000 : 120000;
      task.resultMinimumWait = document.getElementById('taskResultMinWait') ? parseInt(document.getElementById('taskResultMinWait').value, 10) || 120000 : 120000;
      task.steps = steps;
      task.loopTask = taskLoopToggle ? taskLoopToggle.checked : false;
      task.loopInterval = taskLoopIntervalInput ? parseInt(taskLoopIntervalInput.value, 10) || 0 : 0;

      await AuraStorage.saveTask(task);
      closeTaskEditor();
      await loadAllData();
    } catch (err) {
      console.error('Error saving task:', err);
      alert('Failed to save task: ' + err.message);
    }
  };

  closeEditorModalBtn.onclick = closeTaskEditor;
  cancelTaskBtn.onclick = closeTaskEditor;
  newTaskBtn.onclick = () => openTaskEditor();
  sidebarNewTaskBtn.onclick = () => openTaskEditor();

  // Trigger Visual Element Picker
  async function triggerElementPicker(stepIndex) {
    activePickerStepIndex = stepIndex;
    const res = await Messaging.sendToBackground({ type: MessageTypes.START_ELEMENT_PICKER });
    if (res && res.success) {
      alert('🎯 Element Picker activated on active webpage! Click target element on page to capture CSS selector.');
    } else {
      alert('Could not activate element picker. Make sure you have an active webpage tab open.');
    }
  }

  // --- PICKED ELEMENTS LIBRARY TAB ---
  function renderPickedElementsTable() {
    if (!pickedElementsTableBody) return;
    pickedElementsTableBody.innerHTML = '';

    if (currentPickedElements.length === 0) {
      pickedElementsTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">
            No picked elements saved yet. Click <strong>🎯 Launch Element Picker</strong> to capture elements from any webpage.
          </td>
        </tr>
      `;
      return;
    }

    currentPickedElements.forEach(item => {
      const tr = document.createElement('tr');
      const timeStr = new Date(item.timestamp).toLocaleTimeString();
      const hostUrl = item.url ? new URL(item.url).hostname : 'Page element';

      tr.innerHTML = `
        <td><code class="step-number-badge">&lt;${escapeHtml(item.tagName || 'element')}&gt;</code></td>
        <td><span style="font-weight: 500;">${escapeHtml(item.text || '(no text)')}</span></td>
        <td><code style="color: var(--accent-primary); font-size: 12px;">${escapeHtml(item.selector)}</code></td>
        <td><span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(hostUrl)}</span></td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-secondary btn-sm copy-sel-btn" title="Copy CSS Selector">📋 Copy</button>
            <button class="btn btn-primary btn-sm use-sel-btn" title="Create Task Step">➕ Step</button>
            <button class="btn btn-danger btn-sm del-pick-btn" title="Delete">🗑</button>
          </div>
        </td>
      `;

      // Copy Selector to Clipboard
      tr.querySelector('.copy-sel-btn').onclick = async () => {
        try {
          await navigator.clipboard.writeText(item.selector);
          alert(`Selector copied to clipboard: ${item.selector}`);
        } catch (err) {
          prompt('Copy selector:', item.selector);
        }
      };

      // Create Task Step using Picked Selector
      tr.querySelector('.use-sel-btn').onclick = () => {
        openTaskEditor({
          name: `Task for ${item.tagName} (${item.text ? item.text.substring(0, 15) : 'Element'})`,
          url: item.url || '',
          steps: [
            {
              id: 'step_1_' + Date.now(),
              type: item.tagName === 'input' || item.tagName === 'textarea' ? 'type' : 'click',
              selector: item.selector,
              description: `Action on <${item.tagName}> ${item.text || ''}`
            }
          ]
        });
      };

      // Delete Picked Element
      tr.querySelector('.del-pick-btn').onclick = async () => {
        await AuraStorage.deletePickedElement(item.id);
        currentPickedElements = await AuraStorage.getPickedElements();
        renderPickedElementsTable();
      };

      pickedElementsTableBody.appendChild(tr);
    });
  }

  if (triggerDashboardPickerBtn) {
    triggerDashboardPickerBtn.onclick = async () => {
      const res = await Messaging.sendToBackground({ type: MessageTypes.START_ELEMENT_PICKER });
      if (res && res.success) {
        alert('🎯 Element Picker activated on active webpage! Hover and click target element on the webpage to save it to your library.');
      } else {
        alert('Could not activate element picker. Please ensure an active webpage tab is open.');
      }
    };
  }

  if (clearPickedBtn) {
    clearPickedBtn.onclick = async () => {
      if (confirm('Clear all saved picked elements from library?')) {
        await AuraStorage.clearPickedElements();
        currentPickedElements = [];
        renderPickedElementsTable();
      }
    };
  }
  async function checkRecordingState() {
    const res = await Messaging.sendToBackground({ type: MessageTypes.GET_RECORDING_STATE });
    if (res && res.recordingState) {
      const state = res.recordingState;
      if (state.isRecording) {
        startRecorderBtn.textContent = '⏹️ Stop Recording';
        startRecorderBtn.className = 'btn btn-secondary';
        recordedSteps = state.steps || [];
        renderRecordedSteps();
      } else {
        startRecorderBtn.textContent = '🔴 Start Recording';
        startRecorderBtn.className = 'btn btn-danger';
        if (state.steps && state.steps.length > 0) {
          recordedSteps = state.steps;
          renderRecordedSteps();
        }
      }
    }
  }

  startRecorderBtn.onclick = async () => {
    const res = await Messaging.sendToBackground({ type: MessageTypes.GET_RECORDING_STATE });
    const isCurrentlyRecording = res && res.recordingState && res.recordingState.isRecording;

    if (isCurrentlyRecording) {
      await Messaging.sendToBackground({ type: MessageTypes.STOP_RECORDING });
      await checkRecordingState();
    } else {
      const url = recorderUrlInput.value.trim();
      if (!url) {
        alert('Please enter a target URL to record actions.');
        return;
      }

      recordedSteps = [];
      renderRecordedSteps();

      const startRes = await Messaging.sendToBackground({
        type: MessageTypes.START_RECORDING,
        url: url
      });

      if (startRes && startRes.success) {
        await checkRecordingState();
      } else {
        alert(`Failed to start recording: ${startRes ? startRes.error : 'Unknown error'}`);
      }
    }
  };

  convertToTaskBtn.onclick = () => {
    if (recordedSteps.length === 0) return;
    openTaskEditor({
      name: 'Recorded Workflow ' + new Date().toLocaleTimeString(),
      url: recorderUrlInput.value.trim(),
      steps: recordedSteps
    });
  };

  function renderRecordedSteps() {
    recordedStepsList.innerHTML = '';
    if (recordedSteps.length === 0) {
      recordedStepsList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔴</span>
          <p>No steps recorded yet. Enter a URL above and click <strong>Start Recording</strong>.</p>
        </div>
      `;
      convertToTaskBtn.disabled = true;
      return;
    }

    convertToTaskBtn.disabled = false;
    recordedSteps.forEach((step, idx) => {
      const item = document.createElement('div');
      item.className = 'step-card';
      item.innerHTML = `
        <div class="step-card-header">
          <span class="step-number-badge">Step ${idx + 1}</span>
          <span style="font-weight: 600; font-size: 13px;">${escapeHtml(step.type)}</span>
        </div>
        <div style="font-size: 12px; font-family: var(--font-mono); color: var(--text-muted);">
          ${escapeHtml(step.selector || step.url || '')} ${step.text ? `: "${escapeHtml(step.text)}"` : ''}
        </div>
      `;
      recordedStepsList.appendChild(item);
    });
  }

  // --- VARIABLES TAB ---
  function renderVariablesTable() {
    variablesTableBody.innerHTML = '';
    const keys = Object.keys(currentVariables);

    if (keys.length === 0) {
      variablesTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted);">No custom variables defined.</td>
        </tr>
      `;
      return;
    }

    keys.forEach(key => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(key)}</strong></td>
        <td><input type="text" class="var-val-input" data-key="${escapeHtml(key)}" value="${escapeHtml(currentVariables[key])}"></td>
        <td><code>{${escapeHtml(key)}}</code></td>
        <td>
          <button class="btn btn-danger btn-sm del-var-btn" data-key="${escapeHtml(key)}">🗑</button>
        </td>
      `;

      tr.querySelector('.var-val-input').onchange = async (e) => {
        currentVariables[key] = e.target.value;
        await AuraStorage.saveVariables(currentVariables);
      };

      tr.querySelector('.del-var-btn').onclick = async () => {
        delete currentVariables[key];
        await AuraStorage.saveVariables(currentVariables);
        renderVariablesTable();
      };

      variablesTableBody.appendChild(tr);
    });
  }

  addVariableBtn.onclick = async () => {
    const key = prompt('Enter new variable name (e.g. user_id):');
    if (!key) return;
    const sanitizedKey = key.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitizedKey) {
      alert('Invalid variable name.');
      return;
    }
    const val = prompt(`Enter value for {${sanitizedKey}}:`) || '';
    currentVariables[sanitizedKey] = val;
    await AuraStorage.saveVariables(currentVariables);
    renderVariablesTable();
  };

  // --- HISTORY TAB ---
  function renderHistoryTable() {
    historyTableBody.innerHTML = '';

    if (currentHistory.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted);">No execution history recorded yet.</td>
        </tr>
      `;
      return;
    }

    currentHistory.forEach(item => {
      const tr = document.createElement('tr');
      const timeStr = new Date(item.timestamp).toLocaleString();
      const statusClass = item.status === 'completed' ? 'completed' : item.status === 'failed' ? 'failed' : 'running';

      tr.innerHTML = `
        <td><strong>${escapeHtml(item.taskName || 'Unnamed Task')}</strong></td>
        <td>${timeStr}</td>
        <td>${item.duration ? Math.round(item.duration) + ' ms' : '-'}</td>
        <td><span class="status-badge ${statusClass}">${escapeHtml(item.status)}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm view-hist-btn">🔍 View Steps</button>
        </td>
      `;

      tr.querySelector('.view-hist-btn').onclick = () => openHistoryDetail(item);
      historyTableBody.appendChild(tr);
    });
  }

  function openHistoryDetail(entry) {
    historyDetailTitle.textContent = `Execution Trace: ${entry.taskName}`;
    historyDetailBody.innerHTML = `
      <div style="margin-bottom: 16px;">
        <p><strong>Status:</strong> <span class="status-badge ${entry.status}">${entry.status.toUpperCase()}</span></p>
        <p><strong>Executed At:</strong> ${new Date(entry.timestamp).toLocaleString()}</p>
        <p><strong>Total Duration:</strong> ${entry.duration ? `${entry.duration} ms` : 'N/A'}</p>
        ${entry.error ? `<p style="color: var(--accent-danger); margin-top: 6px;"><strong>Error:</strong> ${escapeHtml(entry.error)}</p>` : ''}
      </div>
      <h4 style="margin-bottom: 10px;">Step Execution Trace</h4>
      <div class="steps-builder-list">
        ${(entry.stepLogs || []).map((log, i) => {
          const isIf = log.type === 'if_condition';
          const isCondMet = log.conditionMet;
          const cardClass = isIf ? 'if-card' : (log.type === 'repeat' ? 'loop-card' : '');
          return `
            <div class="step-card ${cardClass}">
              <div class="step-card-header">
                <span class="step-number-badge">${isIf ? '⚡ IF / ELSE' : `Step ${i + 1}`}</span>
                <span class="status-badge ${log.status}">${log.status}</span>
              </div>
              <div style="font-size: 13px; font-weight: 600;">${escapeHtml(log.description || log.type)}</div>
              ${isIf && isCondMet !== undefined ? `
                <div style="margin-top: 6px; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; background: ${isCondMet ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; color: ${isCondMet ? '#34d399' : '#fbbf24'}; border: 1px solid ${isCondMet ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'};">
                  ${isCondMet ? '⚡ Evaluation: TRUE (THEN Branch)' : '🔀 Evaluation: FALSE (ELSE Branch)'}
                  ${log.details ? `<div style="font-weight: 400; font-size: 11px; margin-top: 2px; color: var(--text-main);">${escapeHtml(log.details)}</div>` : ''}
                </div>
              ` : ''}
              ${log.details && !isIf ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(log.details)}</div>` : ''}
              ${log.error ? `<div style="color: var(--accent-danger); font-size: 12px; margin-top: 4px;">${escapeHtml(log.error)}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
    historyDetailModal.classList.remove('hidden');
  }

  closeHistoryModalBtn.onclick = () => historyDetailModal.classList.add('hidden');
  closeHistoryModalFooterBtn.onclick = () => historyDetailModal.classList.add('hidden');

  clearHistoryBtn.onclick = async () => {
    if (confirm('Clear all execution history logs?')) {
      await AuraStorage.clearHistory();
      await loadAllData();
    }
  };

  // --- SETTINGS TAB ---
  function populateSettingsForm() {
    settingStepTimeout.value = currentSettings.stepTimeout || 10000;
    settingRetries.value = currentSettings.retries || 3;
    settingRetryDelay.value = currentSettings.retryDelay || 1000;
  }

  saveSettingsBtn.onclick = async () => {
    currentSettings.stepTimeout = parseInt(settingStepTimeout.value, 10);
    currentSettings.retries = parseInt(settingRetries.value, 10);
    currentSettings.retryDelay = parseInt(settingRetryDelay.value, 10);
    await AuraStorage.saveSettings(currentSettings);
    alert('Settings saved successfully!');
  };

  exportBackupBtn.onclick = async () => {
    const jsonStr = await AuraStorage.exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-automator-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  importBackupBtn.onclick = () => importFileInput.click();

  importFileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const res = await AuraStorage.importData(evt.target.result);
      if (res.success) {
        alert(`Successfully imported backup data! (${res.taskCount} tasks loaded)`);
        await loadAllData();
      } else {
        alert(`Import failed: ${res.error}`);
      }
    };
    reader.readAsText(file);
  };

  // --- SEARCH FILTER ---
  globalSearchInput.oninput = (e) => {
    renderTasksGrid(e.target.value);
  };

  // --- ACTIVE EXECUTION BANNER CONTROLLER ---
  async function checkDashboardExecutionState() {
    try {
      const banner = document.getElementById('dashboardActiveExecutionBanner');
      if (!banner) return;

      const response = await Messaging.sendToBackground({ type: MessageTypes.GET_EXECUTION_STATE });
      if (!response) return; // Do not hide banner on temporary response delay
      const run = response.activeRun;
      const isActive = run && run.state && run.state !== 'IDLE';

      if (isActive) {
        banner.classList.remove('hidden');

        const taskNameEl = document.getElementById('dashRunTaskName');
        const urlEl = document.getElementById('dashRunWebsiteUrl');
        if (taskNameEl) taskNameEl.textContent = run.taskName || 'Automation Running';
        if (urlEl) urlEl.textContent = run.websiteUrl || '';

        const badge = document.getElementById('dashStateBadge');
        if (badge) {
          badge.textContent = run.state;
          if (run.state === 'PAUSED') {
            badge.style.background = 'rgba(245, 158, 11, 0.2)';
            badge.style.color = '#fbbf24';
            badge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
          } else if (run.state === 'STOPPED') {
            badge.style.background = 'rgba(239, 68, 68, 0.2)';
            badge.style.color = '#f87171';
            badge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          } else {
            badge.style.background = 'rgba(139, 92, 246, 0.2)';
            badge.style.color = '#a78bfa';
            badge.style.borderColor = 'rgba(139, 92, 246, 0.4)';
          }
        }

        const loopBadge = document.getElementById('dashLoopCounterBadge');
        if (loopBadge) {
          loopBadge.textContent = `LOOP #${run.loopCounter || run.loopCount || 1}`;
        }

        const currentStateEl = document.getElementById('dashCurrentStateText');
        if (currentStateEl) currentStateEl.textContent = run.state;

        const countdownElem = document.getElementById('dashCountdownText');
        if (countdownElem) {
          if (['WAITING_SUCCESS_RETRY', 'WAITING_ERROR_RETRY'].includes(run.state)) {
            countdownElem.textContent = run.countdownFormatted || '00:00';
          } else if (run.state === 'MONITORING_RESULT') {
            countdownElem.textContent = run.elapsedFormatted || '00:00 / 01:30';
          } else if (run.state === 'PAUSED') {
            countdownElem.textContent = `PAUSED (${run.countdownFormatted || 'Frozen'})`;
          } else {
            countdownElem.textContent = '--:--';
          }
        }

        const nextActionEl = document.getElementById('dashNextActionText');
        if (nextActionEl) nextActionEl.textContent = run.nextAction || run.state;

        const consoleBox = document.getElementById('dashActivityLogConsole');
        if (consoleBox && run.activityLog) {
          consoleBox.innerHTML = run.activityLog.map(l => `<div>${escapeHtml(l)}</div>`).join('');
          consoleBox.scrollTop = consoleBox.scrollHeight;
        }

        const pauseBtn = document.getElementById('dashPauseTaskBtn');
        const resumeBtn = document.getElementById('dashResumeTaskBtn');
        const stopBtn = document.getElementById('dashStopTaskBtn');

        if (pauseBtn && resumeBtn) {
          if (run.state === 'PAUSED') {
            pauseBtn.classList.add('hidden');
            resumeBtn.classList.remove('hidden');
          } else if (run.state === 'STOPPED') {
            pauseBtn.classList.add('hidden');
            resumeBtn.classList.add('hidden');
          } else {
            pauseBtn.classList.remove('hidden');
            resumeBtn.classList.add('hidden');
          }
        }
      } else if (run && (run.state === 'IDLE' || !run.state)) {
        banner.classList.add('hidden');
      }
    } catch (e) {
      console.warn('Dashboard state check warning:', e);
    }
  }

  // --- MESSAGE LISTENERS ---
  function setupMessageListeners() {
    chrome.runtime.onMessage.addListener(async (message) => {
      if (message.type === 'ELEMENT_PICKED') {
        currentPickedElements = await AuraStorage.getPickedElements();
        renderPickedElementsTable();

        if (activePickerStepIndex !== null) {
          const card = editorStepsList.querySelectorAll('.step-card')[activePickerStepIndex];
          if (card) {
            const selInput = card.querySelector('.step-selector-input');
            if (selInput) selInput.value = message.selector;
          }
          activePickerStepIndex = null;
        }
      } else if (message.type === 'ACTION_RECORDED') {
        recordedSteps = message.allSteps || [];
        renderRecordedSteps();
      } else if (message.type === MessageTypes.RECORDING_STATUS_CHANGED) {
        checkRecordingState();
      } else if (message.type === MessageTypes.STEP_STATUS) {
        loadHistory();
        checkDashboardExecutionState();
      }
    });
  }

  function setupEventListeners() {
    // Keyboard shortcuts e.g. Ctrl+K search focus
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        globalSearchInput.focus();
      }
    });

    const dashPauseBtn = document.getElementById('dashPauseTaskBtn');
    if (dashPauseBtn) {
      dashPauseBtn.onclick = async () => {
        await Messaging.sendToBackground({ type: MessageTypes.PAUSE_TASK });
        checkDashboardExecutionState();
      };
    }

    const dashResumeBtn = document.getElementById('dashResumeTaskBtn');
    if (dashResumeBtn) {
      dashResumeBtn.onclick = async () => {
        await Messaging.sendToBackground({ type: MessageTypes.RESUME_TASK });
        checkDashboardExecutionState();
      };
    }

    const dashStopBtn = document.getElementById('dashStopTaskBtn');
    if (dashStopBtn) {
      dashStopBtn.onclick = async () => {
        await Messaging.sendToBackground({ type: MessageTypes.STOP_TASK });
        checkDashboardExecutionState();
      };
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  await init();
  setInterval(checkDashboardExecutionState, 1000);
});
