/**
 * Task Recording Engine for WebTask Automator
 * Observes user interactions (clicks, text input, dropdowns, checkboxes) and converts them into automation steps.
 */

(function() {
  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);
  if (root.WebTaskRecorder) return;

  class TaskRecorder {
    constructor() {
      this.isRecording = false;
      this.recordedSteps = [];
      this.shadowHost = null;
      this.shadowRoot = null;
      this.passwordPromptOpen = false;

      this.onClickBound = this.onClick.bind(this);
      this.onInputBound = this.onInput.bind(this);
      this.onChangeBound = this.onChange.bind(this);
      this.onKeyDownBound = this.onKeyDown.bind(this);
    }

    start(initialSteps = []) {
      if (this.isRecording) {
        this.recordedSteps = initialSteps || this.recordedSteps;
        this.updateCount();
        return;
      }

      this.isRecording = true;
      this.recordedSteps = Array.isArray(initialSteps) ? [...initialSteps] : [];

      this.createUI();

      document.addEventListener('click', this.onClickBound, true);
      document.addEventListener('input', this.onInputBound, true);
      document.addEventListener('change', this.onChangeBound, true);
      document.addEventListener('keydown', this.onKeyDownBound, true);

      console.log('🔴 [TaskRecorder] Recording active. Initial steps count:', this.recordedSteps.length);
    }

    stop() {
      if (!this.isRecording) return this.recordedSteps;
      this.isRecording = false;

      document.removeEventListener('click', this.onClickBound, true);
      document.removeEventListener('input', this.onInputBound, true);
      document.removeEventListener('change', this.onChangeBound, true);
      document.removeEventListener('keydown', this.onKeyDownBound, true);

      if (this.shadowHost && this.shadowHost.parentNode) {
        this.shadowHost.parentNode.removeChild(this.shadowHost);
      }
      this.shadowHost = null;
      this.shadowRoot = null;

      console.log('⏹️ [TaskRecorder] Recording stopped. Final steps:', this.recordedSteps);
      return this.recordedSteps;
    }

    createUI() {
      if (this.shadowHost) return;

      this.shadowHost = document.createElement('webtask-recorder-host');
      this.shadowHost.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; pointer-events: auto;';
      this.shadowRoot = this.shadowHost.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = `
        .recorder-banner {
          background-color: #0f172a;
          color: #ffffff;
          padding: 10px 16px;
          border-radius: 9999px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
          border: 1px solid #ef4444;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .recorder-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #ef4444;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
        }

        .stop-btn {
          background: #ef4444;
          color: white;
          border: none;
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .stop-btn:hover { background: #dc2626; }
      `;

      const banner = document.createElement('div');
      banner.className = 'recorder-banner';
      banner.innerHTML = `
        <div class="recorder-dot"></div>
        <span><strong>Recording Task</strong> (<span id="recCount">${this.recordedSteps.length}</span> steps)</span>
        <button class="stop-btn" id="stopRecBtn">Stop Recording</button>
      `;

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(banner);
      document.body.appendChild(this.shadowHost);

      this.shadowRoot.getElementById('stopRecBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
        }
        this.stop();
      });
    }

    updateCount() {
      if (this.shadowRoot) {
        const countEl = this.shadowRoot.getElementById('recCount');
        if (countEl) countEl.textContent = String(this.recordedSteps.length);
      }
    }

    onClick(e) {
      if (!this.isRecording) return;
      const originalTarget = e.target;

      if (originalTarget === this.shadowHost || (this.shadowHost && this.shadowHost.contains(originalTarget))) return;

      const target = originalTarget.closest('button, a, [role="button"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"]') || originalTarget;
      const tag = target.tagName.toLowerCase();

      if (tag === 'textarea' || tag === 'select') return;
      if (tag === 'input') {
        const type = (target.type || 'text').toLowerCase();
        if (['text', 'email', 'password', 'number', 'search', 'tel', 'url', 'date', 'datetime-local'].includes(type)) {
          return;
        }
      }

      const selector = root.SelectorEngine ? root.SelectorEngine.generateSelector(target) : tag;
      const btnText = (target.innerText || target.value || target.getAttribute('aria-label') || tag).trim().substring(0, 30);

      const step = {
        id: 'step_' + Date.now(),
        type: 'click',
        selector: selector,
        description: `Click ${btnText ? '"' + btnText + '"' : tag}`
      };

      this.addStep(step);
    }

    async onInput(e) {
      if (!this.isRecording) return;
      const target = e.target;
      if (target === this.shadowHost || (this.shadowHost && this.shadowHost.contains(target))) return;

      const tag = target.tagName.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && !target.isContentEditable) return;

      if (target instanceof HTMLInputElement) {
        const type = (target.type || 'text').toLowerCase();
        if (type === 'checkbox' || type === 'radio' || type === 'button' || type === 'submit') return;
      }

      const selector = root.SelectorEngine ? root.SelectorEngine.generateSelector(target) : tag;
      let textValue = target.isContentEditable ? target.textContent : target.value;

      if (target.type === 'password' && textValue && !this.passwordPromptOpen) {
        this.passwordPromptOpen = true;
        const allowPlain = await this.promptPasswordWarning();
        this.passwordPromptOpen = false;
        if (!allowPlain) {
          textValue = '{password}';
        }
      }

      const lastStep = this.recordedSteps[this.recordedSteps.length - 1];
      if (lastStep && lastStep.type === 'type' && lastStep.selector === selector) {
        lastStep.text = textValue;
        this.notifyStepsChanged();
      } else {
        const step = {
          id: 'step_' + Date.now(),
          type: 'type',
          selector: selector,
          text: textValue,
          description: `Type into ${target.id ? '#' + target.id : tag}`
        };
        this.addStep(step);
      }
    }

    onChange(e) {
      if (!this.isRecording) return;
      const target = e.target;
      if (target === this.shadowHost || (this.shadowHost && this.shadowHost.contains(target))) return;

      const tag = target.tagName.toLowerCase();
      const selector = root.SelectorEngine ? root.SelectorEngine.generateSelector(target) : tag;

      if (tag === 'select') {
        const selectedOpt = target.options[target.selectedIndex];
        const valText = selectedOpt ? selectedOpt.text.trim() : target.value;

        const step = {
          id: 'step_' + Date.now(),
          type: 'select',
          selector: selector,
          value: target.value,
          description: `Select option "${valText}"`
        };
        this.addStep(step);
        return;
      }

      if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) {
        const step = {
          id: 'step_' + Date.now(),
          type: target.checked ? 'check' : 'uncheck',
          selector: selector,
          description: `${target.checked ? 'Check' : 'Uncheck'} ${target.id || selector}`
        };
        this.addStep(step);
      }
    }

    onKeyDown(e) {
      if (!this.isRecording) return;
      if (e.key === 'Enter') {
        const target = e.target;
        if (target === this.shadowHost || (this.shadowHost && this.shadowHost.contains(target))) return;
        const selector = root.SelectorEngine ? root.SelectorEngine.generateSelector(target) : target.tagName.toLowerCase();

        const step = {
          id: 'step_' + Date.now(),
          type: 'press_key',
          key: 'Enter',
          selector: selector,
          description: 'Press Enter key'
        };
        this.addStep(step);
      }
    }

    addStep(step) {
      this.recordedSteps.push(step);
      this.updateCount();
      this.notifyStepsChanged();
    }

    notifyStepsChanged() {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'ACTION_RECORDED',
          allSteps: this.recordedSteps
        }).catch(() => {});
      }
    }

    promptPasswordWarning() {
      return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); z-index: 2147483647; display: flex; align-items: center; justify-content: center; font-family: sans-serif;';
        modal.innerHTML = `
          <div style="background: #0f172a; color: white; border: 1px solid #334155; padding: 24px; border-radius: 12px; max-width: 400px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
            <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
            <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #f8fafc;">Password Field Detected</h3>
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 20px;">
              You entered text into a password input field. Would you like to save this plain text password value or substitute it with a safe {password} variable?
            </p>
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button id="noSavePass" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">Don't Save Plaintext</button>
              <button id="savePass" style="background: #334155; color: #94a3b8; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer;">Save Plaintext</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#noSavePass').onclick = () => {
          document.body.removeChild(modal);
          resolve(false);
        };
        modal.querySelector('#savePass').onclick = () => {
          document.body.removeChild(modal);
          resolve(true);
        };
      });
    }
  }

  root.WebTaskRecorder = new TaskRecorder();
})();
