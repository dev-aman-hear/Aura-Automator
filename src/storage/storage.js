/**
 * Storage Manager for Aura Automator
 * Uses chrome.storage.local with async/await wrappers
 */

(function() {
  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);

  const AuraStorageImpl = {
    KEYS: {
      TASKS: 'aura_tasks',
      VARIABLES: 'aura_variables',
      SETTINGS: 'aura_settings',
      HISTORY: 'aura_history',
      PICKED_ELEMENTS: 'aura_picked_elements',
      ACTIVE_RUN: 'aura_active_run'
    },

    DEFAULT_SETTINGS: {
      retries: 3,
      retryDelay: 1000,
      theme: 'dark',
      autoScroll: true,
      passwordWarning: true,
      stepTimeout: 10000
    },

    DEFAULT_VARIABLES: {
      name: 'Aman',
      email: 'user@example.com',
      phone: '9876543210',
      subject: 'General Inquiry',
      Link01: 'https://www.instagram.com/reel/YOUR_REEL_ID/'
    },

    DEFAULT_TASKS: [
      {
        id: 'task_zefame_ig_views',
        name: 'Zefame Free Instagram Views Automation',
        url: 'https://zefame.com/en/free-instagram-views',
        websiteUrl: 'https://zefame.com/en/free-instagram-views',
        inputSelector: '#instagram-link',
        inputText: '{Link01}',
        submitSelector: '#submit-btn',
        successSelector: 'p.thanks-page-body, div.thanks-page-success',
        errorSelector: 'div.thanks-page-error, #error-message',
        serverErrorDetection: 'server_connection_error',
        successDelay: 300000,
        errorDelay: 120000,
        resultTimeout: 120000,
        resultMinimumWait: 120000,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        loopTask: true,
        loopInterval: 300000,
        variables: {
          Link01: 'https://www.instagram.com/reel/YOUR_REEL_ID/'
        },
        steps: [
          {
            id: 'step_1_nav',
            type: 'navigate',
            url: 'https://zefame.com/en/free-instagram-views',
            description: '🌐 Step 1: Open https://zefame.com/en/free-instagram-views'
          },
          {
            id: 'step_2_type_link',
            type: 'type',
            selector: '#instagram-link',
            text: '{Link01}',
            description: '✍️ Step 2: Paste link {Link01} into #instagram-link'
          },
          {
            id: 'step_3_click_submit',
            type: 'click',
            selector: '#submit-btn',
            description: '🖱️ Step 3: Click get now button #submit-btn'
          },
          {
            id: 'step_4_wait_120s',
            type: 'wait_time',
            duration: 120000,
            description: '⏱️ Step 4: Wait for 2 minutes (120 seconds)'
          },
          {
            id: 'step_5_server_error_check',
            type: 'if_condition',
            conditionType: 'server_connection_error',
            thenAction: 'jump_to_step',
            thenJumpStep: 1,
            elseAction: 'continue',
            description: '⚡ IF Server Error appears -> Retry from Step 1 immediately'
          },
          {
            id: 'step_6_error_box_check',
            type: 'if_condition',
            conditionType: 'element_exists',
            selector: 'div.thanks-page-error',
            thenAction: 'jump_to_step',
            thenJumpStep: 1,
            elseAction: 'continue',
            description: '⚡ ELSE IF div.thanks-page-error appears -> Grab time + 10s & retry from Step 1'
          },
          {
            id: 'step_7_success_box_check',
            type: 'if_condition',
            conditionType: 'element_exists',
            selector: 'div.thanks-page-success',
            thenAction: 'continue',
            elseAction: 'continue',
            description: '⚡ IF div.thanks-page-success appears -> Rerun loop from Step 1 after 5 minutes'
          },
          {
            id: 'step_8_success_wait_5m',
            type: 'wait_time',
            duration: 300000,
            description: '⏱️ Rerun loop from Step 1 after exactly 5 minutes (300000 ms)'
          }
        ]
      },
      {
        id: 'task_sample_1',
        name: 'Sample Contact Form Test',
        url: 'http://localhost/test-page.html',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        variables: {},
        steps: [
          {
            id: 'step_1',
            type: 'navigate',
            url: 'http://localhost/test-page.html',
            description: 'Open Test Page'
          },
          {
            id: 'step_2',
            type: 'wait_element',
            selector: '#fullname',
            duration: 5000,
            description: 'Wait for Name field'
          },
          {
            id: 'step_3',
            type: 'type',
            selector: '#fullname',
            text: '{name}',
            description: 'Enter Name variable'
          },
          {
            id: 'step_4',
            type: 'type',
            selector: '#email',
            text: '{email}',
            description: 'Enter Email variable'
          },
          {
            id: 'step_5',
            type: 'type',
            selector: '#message',
            text: 'Hello, this is an automated message regarding {subject}.\nSent on {date}.',
            description: 'Enter Message'
          },
          {
            id: 'step_6',
            type: 'select',
            selector: '#category',
            value: 'support',
            description: 'Select Support option'
          },
          {
            id: 'step_7',
            type: 'check',
            selector: '#terms',
            description: 'Check Terms box'
          },
          {
            id: 'step_8',
            type: 'click',
            selector: '#submitBtn',
            description: 'Click Submit Button'
          },
          {
            id: 'step_9',
            type: 'wait_time',
            duration: 2000,
            description: 'Wait 2 seconds'
          }
        ]
      }
    ],

    async get(key, defaultValue = null) {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([key], (result) => {
            resolve(result[key] !== undefined ? result[key] : defaultValue);
          });
        } else {
          const val = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
          resolve(val ? JSON.parse(val) : defaultValue);
        }
      });
    },

    async set(key, value) {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [key]: value }, () => {
            resolve(true);
          });
        } else {
          if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
          resolve(true);
        }
      });
    },

    async init() {
      const tasks = await this.getTasks();
      if (!tasks || tasks.length === 0) {
        await this.saveTasks(this.DEFAULT_TASKS);
      }
      const variables = await this.getVariables();
      if (!variables || Object.keys(variables).length === 0) {
        await this.saveVariables(this.DEFAULT_VARIABLES);
      }
      const settings = await this.getSettings();
      if (!settings) {
        await this.saveSettings(this.DEFAULT_SETTINGS);
      }
    },

    async getTasks() {
      return (await this.get(this.KEYS.TASKS, [])) || [];
    },

    async saveTasks(tasks) {
      return await this.set(this.KEYS.TASKS, tasks);
    },

    async getTask(id) {
      const tasks = await this.getTasks();
      return tasks.find(t => t.id === id) || null;
    },

    async saveTask(task) {
      if (!task || typeof task !== 'object') return null;
      if (!task.id) {
        task.id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      }
      const tasks = await this.getTasks();
      const index = tasks.findIndex(t => t.id === task.id);
      task.updatedAt = Date.now();
      if (!task.createdAt) task.createdAt = Date.now();

      if (index >= 0) {
        tasks[index] = task;
      } else {
        tasks.push(task);
      }
      await this.saveTasks(tasks);
      return task;
    },

    async deleteTask(id) {
      const tasks = await this.getTasks();
      const filtered = tasks.filter(t => t.id !== id);
      await this.saveTasks(filtered);
      return true;
    },

    async duplicateTask(id) {
      const task = await this.getTask(id);
      if (!task) return null;
      const newTask = JSON.parse(JSON.stringify(task));
      newTask.id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      newTask.name = `${task.name} (Copy)`;
      newTask.createdAt = Date.now();
      newTask.updatedAt = Date.now();
      await this.saveTask(newTask);
      return newTask;
    },

    async getVariables() {
      return (await this.get(this.KEYS.VARIABLES, this.DEFAULT_VARIABLES)) || {};
    },

    async saveVariables(variables) {
      return await this.set(this.KEYS.VARIABLES, variables);
    },

    async getSettings() {
      const settings = await this.get(this.KEYS.SETTINGS, null);
      return { ...this.DEFAULT_SETTINGS, ...settings };
    },

    async saveSettings(settings) {
      return await this.set(this.KEYS.SETTINGS, settings);
    },

    async getHistory() {
      return (await this.get(this.KEYS.HISTORY, [])) || [];
    },

    async addHistoryEntry(entry) {
      const history = await this.getHistory();
      history.unshift({
        id: 'hist_' + Date.now(),
        timestamp: Date.now(),
        ...entry
      });
      if (history.length > 100) history.pop();
      await this.set(this.KEYS.HISTORY, history);
    },

    async clearHistory() {
      return await this.set(this.KEYS.HISTORY, []);
    },

    // Picked Elements Library API
    async getPickedElements() {
      return (await this.get(this.KEYS.PICKED_ELEMENTS, [])) || [];
    },

    async savePickedElement(item) {
      const elements = await this.getPickedElements();
      elements.unshift(item);
      // Keep last 50 picked elements
      if (elements.length > 50) elements.pop();
      await this.set(this.KEYS.PICKED_ELEMENTS, elements);
      return item;
    },

    async deletePickedElement(id) {
      const elements = await this.getPickedElements();
      const filtered = elements.filter(el => el.id !== id);
      await this.set(this.KEYS.PICKED_ELEMENTS, filtered);
      return true;
    },

    async clearPickedElements() {
      return await this.set(this.KEYS.PICKED_ELEMENTS, []);
    },

    async getActiveRun() {
      return await this.get(this.KEYS.ACTIVE_RUN, null);
    },

    async saveActiveRun(activeRun) {
      return await this.set(this.KEYS.ACTIVE_RUN, activeRun);
    },

    async clearActiveRun() {
      return await this.set(this.KEYS.ACTIVE_RUN, null);
    },

    async exportData() {
      const tasks = await this.getTasks();
      const variables = await this.getVariables();
      const settings = await this.getSettings();
      const pickedElements = await this.getPickedElements();
      return JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        tasks,
        variables,
        settings,
        pickedElements
      }, null, 2);
    },

    async importData(jsonString) {
      try {
        const data = JSON.parse(jsonString);
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid JSON data format');
        }
        if (data.tasks && Array.isArray(data.tasks)) {
          await this.saveTasks(data.tasks);
        }
        if (data.variables && typeof data.variables === 'object') {
          await this.saveVariables(data.variables);
        }
        if (data.settings && typeof data.settings === 'object') {
          await this.saveSettings(data.settings);
        }
        if (data.pickedElements && Array.isArray(data.pickedElements)) {
          await this.set(this.KEYS.PICKED_ELEMENTS, data.pickedElements);
        }
        return { success: true, taskCount: (data.tasks || []).length };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  };

  root.AuraStorage = Object.assign(root.AuraStorage || {}, AuraStorageImpl);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.AuraStorage;
  }
})();
