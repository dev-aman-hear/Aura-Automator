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
            ⚙️ ${task.steps ? task.steps.length : 0} Automation Steps
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

    const steps = task && task.steps ? JSON.parse(JSON.stringify(task.steps)) : [
      { id: 'step_1', type: 'navigate', url: 'https://example.com', description: 'Open Website URL' }
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
      card.dataset.index = index;

      card.innerHTML = `
        <div class="step-card-header">
          <span class="step-number-badge">Step ${index + 1}</span>
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

    if (type === 'navigate') {
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
          <textarea class="step-text-input" rows="3" placeholder="Hello {name}, this is my message.">${escapeHtml(step.text || '')}</textarea>
          <div class="variable-pills-container">
            <span class="variable-pill" data-var="{name}">{name}</span>
            <span class="variable-pill" data-var="{email}">{email}</span>
            <span class="variable-pill" data-var="{phone}">{phone}</span>
            <span class="variable-pill" data-var="{date}">{date}</span>
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
        </div>
      `;
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
      container.innerHTML = `
        <div class="form-group">
          <label>Target Action Type to Repeat</label>
          <select class="step-subaction-select">
            <option value="click" ${step.actionType === 'click' ? 'selected' : ''}>🖱️ Click Element</option>
            <option value="type" ${step.actionType === 'type' ? 'selected' : ''}>✍️ Type Text</option>
            <option value="press_key" ${step.actionType === 'press_key' ? 'selected' : ''}>⌨️ Press Key</option>
            <option value="scroll_page" ${step.actionType === 'scroll_page' ? 'selected' : ''}>📜 Scroll Page</option>
          </select>
        </div>
        <div class="form-group">
          <label>Target CSS Selector</label>
          <div class="input-with-button">
            <input type="text" class="step-selector-input" value="${escapeHtml(step.selector || '')}" placeholder="e.g. #button">
            <button type="button" class="picker-trigger-btn" data-index="${index}">🎯 Select Element</button>
          </div>
        </div>
      `;
    }

    // Append universal Repeat Loop Controls for all action steps
    const repeatRow = document.createElement('div');
    repeatRow.className = 'form-row';
    repeatRow.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-color);';
    repeatRow.innerHTML = `
      <div class="form-group flex-1">
        <label>🔁 Repeat Count (x)</label>
        <input type="number" class="step-repeat-input" value="${step.repeat || 1}" min="1" max="500" placeholder="1">
      </div>
      <div class="form-group flex-1">
        <label>⏱️ Interval Between Repeats (ms)</label>
        <input type="number" class="step-interval-input" value="${step.repeatInterval !== undefined ? step.repeatInterval : 500}" min="0" step="100" placeholder="500">
      </div>
    `;
    container.appendChild(repeatRow);

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
      task.steps = steps;

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
        <p><strong>Status:</strong> ${entry.status}</p>
        <p><strong>Time:</strong> ${new Date(entry.timestamp).toLocaleString()}</p>
        ${entry.error ? `<p style="color: var(--accent-danger);"><strong>Error:</strong> ${escapeHtml(entry.error)}</p>` : ''}
      </div>
      <h4>Step Executions</h4>
      <div class="steps-builder-list" style="margin-top: 10px;">
        ${(entry.stepLogs || []).map((log, i) => `
          <div class="step-card">
            <div class="step-card-header">
              <span class="step-number-badge">Step ${i + 1}</span>
              <span class="status-badge ${log.status}">${log.status}</span>
            </div>
            <div style="font-size: 13px;">${escapeHtml(log.description || log.type)}</div>
            ${log.error ? `<div style="color: var(--accent-danger); font-size: 12px;">${escapeHtml(log.error)}</div>` : ''}
          </div>
        `).join('')}
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
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  await init();
});
