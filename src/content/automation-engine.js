/**
 * DOM Automation Engine for Aura Automator
 * Executes task steps directly in target website DOM with React/Vue synthetic event compatibility and step repeat loops.
 */

(function() {
  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);
  if (root.WebTaskAutomationEngine) return;

  class AutomationEngine {
    /**
     * Executes a step object with optional repeat loop support
     * @param {Object} step - Step configuration
     * @param {Object} variables - Combined variable values
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async executeStep(step, variables = {}) {
      if (!step || !step.type) {
        return { success: false, error: 'Invalid step definition' };
      }

      const repeatCount = Math.max(1, parseInt(step.repeat || step.count || 1, 10));
      const repeatInterval = Math.max(0, parseInt(step.repeatInterval || step.interval || 500, 10));

      console.log(`⚡ [AutomationEngine] Executing step "${step.type}" (Repeat: ${repeatCount}x, Interval: ${repeatInterval}ms)`, step);

      let lastResult = { success: true };

      for (let i = 1; i <= repeatCount; i++) {
        if (repeatCount > 1) {
          console.log(`🔁 [AutomationEngine] Repeat iteration ${i}/${repeatCount} for step "${step.type}"`);
        }

        lastResult = await this.executeSingleStep(step, variables);

        if (!lastResult.success) {
          return lastResult; // Stop loop if step fails
        }

        if (i < repeatCount && repeatInterval > 0) {
          await this.doWaitTime(repeatInterval);
        }
      }

      return lastResult;
    }

    async executeSingleStep(step, variables = {}) {
      try {
        switch (step.type) {
          case 'click':
            return await this.doClick(step);

          case 'double_click':
            return await this.doDoubleClick(step);

          case 'focus':
            return await this.doFocus(step);

          case 'type':
            return await this.doType(step, variables);

          case 'paste':
            return await this.doPaste(step, variables);

          case 'clear':
            return await this.doClear(step);

          case 'select':
            return await this.doSelect(step, variables);

          case 'check':
            return await this.doCheck(step, true);

          case 'uncheck':
            return await this.doCheck(step, false);

          case 'press_key':
            return await this.doPressKey(step);

          case 'wait_time':
            return await this.doWaitTime(step.duration || 1000);

          case 'wait_element':
            return await this.doWaitElement(step.selector, step.timeout || 10000);

          case 'wait_text':
            return await this.doWaitText(step.text, step.selector, step.timeout || 10000, variables);

          case 'wait_page_load':
            return await this.doWaitPageLoad(step.timeout || 10000);

          case 'hover':
            return await this.doHover(step);

          case 'scroll_element':
            return await this.doScrollElement(step);

          case 'scroll_page':
            return await this.doScrollPage(step);

          case 'repeat':
            return await this.doRepeatAction(step, variables);

          default:
            return { success: false, error: `Unsupported action type: ${step.type}` };
        }
      } catch (err) {
        console.error('❌ [AutomationEngine] Step Execution Error:', err);
        return { success: false, error: err.message || String(err) };
      }
    }

    async getElement(selector, timeout = 10000) {
      if (!selector) throw new Error('No selector specified');
      const element = await this.waitForElement(selector, timeout);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      return element;
    }

    async waitForElement(selector, timeout = 10000) {
      const query = () => {
        if (root.SelectorEngine) {
          return root.SelectorEngine.querySelector(selector);
        }
        if (selector.startsWith('/') || selector.startsWith('//')) {
          const res = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          return res.singleNodeValue;
        }
        return document.querySelector(selector);
      };

      const existing = query();
      if (existing) return existing;

      return new Promise((resolve) => {
        let timer = null;
        let observer = null;

        const cleanup = () => {
          if (timer) clearTimeout(timer);
          if (observer) observer.disconnect();
        };

        timer = setTimeout(() => {
          cleanup();
          resolve(null);
        }, timeout);

        observer = new MutationObserver(() => {
          const el = query();
          if (el) {
            cleanup();
            resolve(el);
          }
        });

        observer.observe(document.documentElement || document.body, {
          childList: true,
          subtree: true,
          attributes: true
        });
      });
    }

    async doClick(step) {
      const el = await this.getElement(step.selector, step.timeout);
      this.scrollIntoView(el);

      el.focus();
      this.dispatchEvent(el, 'pointerdown');
      this.dispatchEvent(el, 'mousedown');
      this.dispatchEvent(el, 'pointerup');
      this.dispatchEvent(el, 'mouseup');
      el.click();

      return { success: true };
    }

    async doDoubleClick(step) {
      const el = await this.getElement(step.selector, step.timeout);
      this.scrollIntoView(el);

      el.focus();
      this.dispatchEvent(el, 'click');
      this.dispatchEvent(el, 'click');
      this.dispatchEvent(el, 'dblclick');

      return { success: true };
    }

    async doFocus(step) {
      const el = await this.getElement(step.selector, step.timeout);
      this.scrollIntoView(el);
      el.focus();
      this.dispatchEvent(el, 'focus');
      return { success: true };
    }

    async doType(step, variables) {
      const el = await this.getElement(step.selector, step.timeout);
      this.scrollIntoView(el);

      let textToEnter = step.text || '';
      if (root.VariableEngine) {
        textToEnter = root.VariableEngine.interpolate(textToEnter, variables);
      }

      el.focus();

      if (el.isContentEditable) {
        el.textContent = textToEnter;
        this.dispatchEvent(el, 'input', { bubbles: true });
        this.dispatchEvent(el, 'change', { bubbles: true });
        return { success: true };
      }

      const isInput = el instanceof HTMLInputElement;
      const isTextArea = el instanceof HTMLTextAreaElement;

      if (isInput || isTextArea) {
        const prototype = isInput ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

        if (step.append) {
          textToEnter = (el.value || '') + textToEnter;
        }

        if (nativeSetter) {
          nativeSetter.call(el, textToEnter);
        } else {
          el.value = textToEnter;
        }

        this.dispatchEvent(el, 'keydown', { key: 'Unidentified' });
        this.dispatchEvent(el, 'keypress', { key: 'Unidentified' });
        this.dispatchEvent(el, 'input', { bubbles: true, composed: true });
        this.dispatchEvent(el, 'keyup', { key: 'Unidentified' });
        this.dispatchEvent(el, 'change', { bubbles: true });
        this.dispatchEvent(el, 'blur', { bubbles: true });

        return { success: true };
      }

      el.innerText = textToEnter;
      this.dispatchEvent(el, 'input', { bubbles: true });
      return { success: true };
    }

    async doPaste(step, variables) {
      const el = await this.getElement(step.selector, step.timeout);
      this.scrollIntoView(el);

      let textToPaste = step.text || '';
      if (root.VariableEngine) {
        textToPaste = root.VariableEngine.interpolate(textToPaste, variables);
      }

      el.focus();
      this.dispatchEvent(el, 'paste', { bubbles: true });
      return await this.doType({ ...step, text: textToPaste }, variables);
    }

    async doClear(step) {
      const el = await this.getElement(step.selector, step.timeout);
      this.scrollIntoView(el);
      return await this.doType({ ...step, text: '' });
    }

    async doSelect(step, variables) {
      const el = await this.getElement(step.selector, step.timeout);
      if (!(el instanceof HTMLSelectElement)) {
        throw new Error(`Target element is not a <select>: ${step.selector}`);
      }

      let val = step.value || '';
      if (root.VariableEngine) {
        val = root.VariableEngine.interpolate(val, variables);
      }

      this.scrollIntoView(el);
      el.focus();

      let matchedOption = Array.from(el.options).find(opt => opt.value === val || opt.text.trim() === val.trim());
      if (matchedOption) {
        el.value = matchedOption.value;
      } else {
        el.value = val;
      }

      const prototype = window.HTMLSelectElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(el, el.value);
      }

      this.dispatchEvent(el, 'input', { bubbles: true });
      this.dispatchEvent(el, 'change', { bubbles: true });
      this.dispatchEvent(el, 'blur', { bubbles: true });

      return { success: true };
    }

    async doCheck(step, shouldCheck) {
      const el = await this.getElement(step.selector, step.timeout);
      this.scrollIntoView(el);

      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        if (el.checked !== shouldCheck) {
          el.click();
          if (el.checked !== shouldCheck) {
            el.checked = shouldCheck;
            this.dispatchEvent(el, 'change', { bubbles: true });
          }
        }
      } else {
        el.click();
      }

      return { success: true };
    }

    async doPressKey(step) {
      const key = step.key || 'Enter';
      const activeEl = document.activeElement || document.body;

      const keyOptions = {
        key: key,
        code: key === 'Enter' ? 'Enter' : key === 'Tab' ? 'Tab' : key === 'Escape' ? 'Escape' : key,
        keyCode: key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : 0,
        which: key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : 0,
        bubbles: true,
        cancelable: true,
        ctrlKey: !!step.ctrl,
        shiftKey: !!step.shift,
        altKey: !!step.alt
      };

      this.dispatchEvent(activeEl, 'keydown', keyOptions);
      this.dispatchEvent(activeEl, 'keypress', keyOptions);
      this.dispatchEvent(activeEl, 'keyup', keyOptions);

      return { success: true };
    }

    async doWaitTime(durationMs) {
      await new Promise(r => setTimeout(r, durationMs));
      return { success: true };
    }

    async doWaitElement(selector, timeout = 10000) {
      const el = await this.waitForElement(selector, timeout);
      if (!el) {
        return { success: false, error: `Timeout (${timeout}ms) waiting for element: ${selector}` };
      }
      return { success: true };
    }

    async doWaitText(text, selector, timeout = 10000, variables = {}) {
      let targetText = text || '';
      if (root.VariableEngine) {
        targetText = root.VariableEngine.interpolate(targetText, variables);
      }

      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        const container = selector ? (root.SelectorEngine ? root.SelectorEngine.querySelector(selector) : document.querySelector(selector)) : document.body;
        if (container && container.innerText && container.innerText.includes(targetText)) {
          return { success: true };
        }
        await new Promise(r => setTimeout(r, 200));
      }
      return { success: false, error: `Timeout waiting for text "${targetText}"` };
    }

    async doWaitPageLoad(timeout = 10000) {
      if (document.readyState === 'complete') return { success: true };
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (document.readyState === 'complete') return { success: true };
        await new Promise(r => setTimeout(r, 200));
      }
      return { success: true };
    }

    async doHover(step) {
      const el = await this.getElement(step.selector, step.timeout);
      this.scrollIntoView(el);

      this.dispatchEvent(el, 'pointerover');
      this.dispatchEvent(el, 'mouseover');
      this.dispatchEvent(el, 'pointermove');
      this.dispatchEvent(el, 'mousemove');

      return { success: true };
    }

    async doScrollElement(step) {
      const el = await this.getElement(step.selector, step.timeout);
      this.scrollIntoView(el);
      return { success: true };
    }

    async doScrollPage(step) {
      const y = step.y !== undefined ? step.y : 500;
      const x = step.x !== undefined ? step.x : 0;
      window.scrollTo({ top: y, left: x, behavior: 'smooth' });
      return { success: true };
    }

    async doRepeatAction(step, variables) {
      const subType = step.actionType || 'click';
      const subStep = { ...step, type: subType, repeat: 1 };
      return await this.executeSingleStep(subStep, variables);
    }

    scrollIntoView(element) {
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }
    }

    dispatchEvent(element, eventType, options = { bubbles: true, cancelable: true }) {
      if (!element) return;
      let evt;
      if (eventType.startsWith('key')) {
        evt = new KeyboardEvent(eventType, options);
      } else if (eventType.startsWith('mouse') || eventType === 'click' || eventType === 'dblclick') {
        evt = new MouseEvent(eventType, options);
      } else if (eventType.startsWith('pointer')) {
        evt = new PointerEvent(eventType, options);
      } else {
        evt = new Event(eventType, options);
      }
      element.dispatchEvent(evt);
    }
  }

  root.WebTaskAutomationEngine = new AutomationEngine();
})();
