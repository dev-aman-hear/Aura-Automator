/**
 * DOM Automation Engine for Aura Automator
 * Executes task steps directly in target website DOM with React/Vue synthetic event compatibility and step repeat loops.
 */

(function() {
  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);
  if (root.WebTaskAutomationEngine) return;

  class AutomationEngine {
    /**
     * Executes a step object with advanced repeat loop & condition support
     * @param {Object} step - Step configuration
     * @param {Object} variables - Combined variable values
     * @returns {Promise<{success: boolean, conditionMet?: boolean, details?: string, error?: string}>}
     */
    async executeStep(step, variables = {}) {
      if (!step || !step.type) {
        return { success: false, error: 'Invalid step definition' };
      }

      // 1. IF / ELSE Condition Logic Block
      if (step.type === 'if_condition') {
        return await this.doIfCondition(step, variables);
      }

      // 2. Enhanced Looping Execution
      const loopMode = step.loopMode || 'fixed';
      const repeatCount = (loopMode === 'fixed') ? Math.max(1, parseInt(step.repeat || step.count || 1, 10)) : 1;
      const repeatInterval = Math.max(0, parseInt(step.repeatInterval || step.interval || 500, 10));

      console.log(`⚡ [AutomationEngine] Executing step "${step.type}" (Mode: ${loopMode}, Repeat: ${repeatCount}x, Interval: ${repeatInterval}ms)`, step);

      let lastResult = { success: true };

      // Mode: While Element Exists
      if (loopMode === 'while_element') {
        const maxLoops = parseInt(step.maxLoops || 50, 10);
        let iter = 0;
        while (iter < maxLoops) {
          iter++;
          const el = step.selector ? await this.waitForElement(step.selector, 1000) : null;
          if (!el) {
            console.log(`🔁 [AutomationEngine] While Element loop finished after ${iter - 1} iterations (Element absent)`);
            break;
          }
          this.showToast({
            type: 'loop',
            title: `🔁 While Element Loop (#${iter})`,
            message: `Selector "${step.selector}" found. Executing step...`
          });
          const iterVars = { ...variables, loop_index: iter, loop_count: iter };
          lastResult = await this.executeSingleStep(step, iterVars);
          if (!lastResult.success) return lastResult;
          if (repeatInterval > 0) await this.doWaitTime(repeatInterval);
        }
        return lastResult;
      }

      // Mode: While Text Present
      if (loopMode === 'while_text') {
        const maxLoops = parseInt(step.maxLoops || 50, 10);
        let iter = 0;
        while (iter < maxLoops) {
          iter++;
          let targetText = step.text || '';
          if (root.VariableEngine) targetText = root.VariableEngine.interpolate(targetText, variables);
          const container = step.selector ? (root.SelectorEngine ? root.SelectorEngine.querySelector(step.selector) : document.querySelector(step.selector)) : document.body;
          const bodyText = container ? (container.innerText || container.textContent || '') : '';
          if (!bodyText.includes(targetText)) {
            console.log(`🔁 [AutomationEngine] While Text loop finished after ${iter - 1} iterations (Text absent)`);
            break;
          }
          this.showToast({
            type: 'loop',
            title: `🔁 While Text Loop (#${iter})`,
            message: `Text "${targetText}" found. Executing step...`
          });
          const iterVars = { ...variables, loop_index: iter, loop_count: iter };
          lastResult = await this.executeSingleStep(step, iterVars);
          if (!lastResult.success) return lastResult;
          if (repeatInterval > 0) await this.doWaitTime(repeatInterval);
        }
        return lastResult;
      }

      // Mode: For Each Element Matching Selector
      if (loopMode === 'for_each' && step.selector) {
        const query = () => {
          if (selector.startsWith('/') || selector.startsWith('//')) {
            const res = document.evaluate(step.selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            const arr = [];
            for (let i = 0; i < res.snapshotLength; i++) arr.push(res.snapshotItem(i));
            return arr;
          }
          return Array.from(document.querySelectorAll(step.selector));
        };
        const elements = query();
        if (elements.length === 0) {
          return { success: true, details: 'For-Each loop matched 0 elements' };
        }
        for (let i = 0; i < elements.length; i++) {
          this.showToast({
            type: 'loop',
            title: `🔁 For-Each Element (${i + 1}/${elements.length})`,
            message: `Processing item #${i + 1} matching "${step.selector}"`
          });
          const iterVars = { ...variables, loop_index: i + 1, loop_count: elements.length };
          const subStep = { ...step, loopMode: 'fixed', repeat: 1 };
          lastResult = await this.executeSingleStep(subStep, iterVars);
          if (!lastResult.success) return lastResult;
          if (i < elements.length - 1 && repeatInterval > 0) await this.doWaitTime(repeatInterval);
        }
        return lastResult;
      }

      // Mode: Fixed Count Repeat Loop
      for (let i = 1; i <= repeatCount; i++) {
        if (repeatCount > 1) {
          console.log(`🔁 [AutomationEngine] Repeat iteration ${i}/${repeatCount} for step "${step.type}"`);
          this.showToast({
            type: 'loop',
            title: `🔁 Loop Iteration (${i}/${repeatCount})`,
            message: `Action: ${step.type} ${step.selector ? step.selector : ''}`
          });
        }

        const iterVars = { ...variables, loop_index: i, loop_count: repeatCount };
        lastResult = await this.executeSingleStep(step, iterVars);

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
          case 'if_condition':
            return await this.doIfCondition(step, variables);

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
            return await this.doWaitTime(step.duration || step.delay || step.time || step.value || 1000);

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

      // Check if entering link into #instagram-link field
      if (step.selector === '#instagram-link' || textToEnter.includes('instagram.com') || step.text === '{Link01}') {
        const trimmed = (textToEnter || '').trim();
        const isPlaceholder = trimmed.includes('YOUR_POST_HERE') || trimmed.includes('CxXXXXXXXXX');
        const isValidIgUrl = /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[\w-]+\/?(\?.*)?$/i.test(trimmed);

        if (isPlaceholder) {
          const errDetail = `Placeholder Link Detected: "${trimmed}". Please update the {Link01} variable under Dashboard -> Variables tab with your real Instagram Reel URL.`;
          this.showToast({
            type: 'error',
            title: '⚠️ Placeholder Link Detected',
            message: 'Please update {Link01} in Dashboard -> Variables with your real Instagram Reel URL.'
          });
          throw new Error(errDetail);
        } else if (!isValidIgUrl) {
          const errDetail = `Invalid Instagram Link Format: "${trimmed}". Link must be a valid Instagram Reel/Post URL (e.g. https://www.instagram.com/reel/Cxxxxxx/).`;
          this.showToast({
            type: 'error',
            title: '❌ Invalid Link Format',
            message: `The entered link (${trimmed}) is not a valid Instagram Reel URL.`
          });
          throw new Error(errDetail);
        }
      }

      el.focus();
      this.dispatchEvent(el, 'click', { bubbles: true });

      if (el.isContentEditable) {
        el.textContent = textToEnter;
        this.dispatchEvent(el, 'input', { bubbles: true });
        this.dispatchEvent(el, 'change', { bubbles: true });
        return { success: true };
      }

      const isInput = el instanceof HTMLInputElement;
      const isTextArea = el instanceof HTMLTextAreaElement;

      if (isInput || isTextArea) {
        if (!step.append) {
          el.value = '';
        }

        // 1. Try execCommand insertText first (native user typing simulation)
        let typedViaExec = false;
        try {
          if (el.select) el.select();
          typedViaExec = document.execCommand('insertText', false, textToEnter);
        } catch (e) {
          typedViaExec = false;
        }

        // 2. Fallback to prototype value setter for React/Vue synthetic events
        if (!typedViaExec || el.value !== textToEnter) {
          const prototype = isInput ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
          const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (step.append) textToEnter = (el.value || '') + textToEnter;

          if (nativeSetter) {
            nativeSetter.call(el, textToEnter);
          } else {
            el.value = textToEnter;
          }
        }

        // 3. Dispatch full event chain for frontend framework state synchronization
        this.dispatchEvent(el, 'keydown', { key: 'Unidentified' });
        this.dispatchEvent(el, 'keypress', { key: 'Unidentified' });

        try {
          const inputEvt = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: 'insertText',
            data: textToEnter
          });
          el.dispatchEvent(inputEvt);
        } catch (e) {
          this.dispatchEvent(el, 'input', { bubbles: true, composed: true });
        }

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

    async doIfCondition(step, variables = {}) {
      let conditionMet = false;
      let details = '';

      const conditionType = step.conditionType || 'element_exists';
      let targetText = step.text || '';
      if (root.VariableEngine && targetText) {
        targetText = root.VariableEngine.interpolate(targetText, variables);
      }

      switch (conditionType) {
        case 'element_exists': {
          const el = step.selector ? await this.waitForElement(step.selector, step.timeout || 1500) : null;
          conditionMet = !!el;
          let extractedWaitMs = null;

          if (conditionMet && el) {
            const elText = (el.innerText || el.textContent || '').trim();
            const secFound = this.parseCooldownSeconds(elText);

            if (secFound > 0) {
              const waitSec = secFound + 10;
              extractedWaitMs = waitSec * 1000;
              details = `Element "${step.selector}" found. Cooldown: ${secFound}s -> Dynamic wait set to ${waitSec}s (${secFound}s + 10s)`;
            } else {
              details = `Element found: "${step.selector}"`;
            }
          } else {
            details = `Element missing: "${step.selector}"`;
          }

          this.showToast({
            type: 'condition',
            conditionMet: conditionMet,
            title: `⚡ IF Condition: ${conditionMet ? 'TRUE (THEN Branch)' : 'FALSE (ELSE Branch)'}`,
            message: details
          });

          return { success: true, conditionMet: conditionMet, extractedWaitMs: extractedWaitMs, details: details };
        }
        case 'element_not_exists': {
          const el = step.selector ? await this.waitForElement(step.selector, step.timeout || 1500) : null;
          conditionMet = !el;
          details = conditionMet ? `Element absent: "${step.selector}"` : `Element present: "${step.selector}"`;
          break;
        }
        case 'text_contains': {
          const container = step.selector ? (root.SelectorEngine ? root.SelectorEngine.querySelector(step.selector) : document.querySelector(step.selector)) : document.body;
          const bodyText = container ? (container.innerText || container.textContent || '') : '';
          const lowerBody = bodyText.toLowerCase();
          const lowerTarget = targetText.toLowerCase();
          conditionMet = lowerBody.includes(lowerTarget);

          let extractedWaitMs = null;
          if (conditionMet) {
            const secFound = this.parseCooldownSeconds(bodyText);

            if (secFound > 0) {
              const waitSec = secFound + 10;
              extractedWaitMs = waitSec * 1000;
              details = `Text "${targetText}" found. Cooldown: ${secFound}s -> Dynamic wait set to ${waitSec}s (${secFound}s + 10s)`;
            } else {
              details = `Text "${targetText}" found on page`;
            }
          } else {
            details = `Text "${targetText}" missing`;
          }
          break;
        }
        case 'text_not_contains': {
          const container = step.selector ? (root.SelectorEngine ? root.SelectorEngine.querySelector(step.selector) : document.querySelector(step.selector)) : document.body;
          const bodyText = container ? (container.innerText || container.textContent || '') : '';
          const lowerBody = bodyText.toLowerCase();
          const lowerTarget = targetText.toLowerCase();
          conditionMet = !lowerBody.includes(lowerTarget);
          details = conditionMet ? `Text "${targetText}" missing` : `Text "${targetText}" present`;
          break;
        }
        case 'variable_equals': {
          let varVal = step.variableValue || '';
          let expected = step.expectedValue || '';
          if (root.VariableEngine) {
            varVal = root.VariableEngine.interpolate(varVal, variables);
            expected = root.VariableEngine.interpolate(expected, variables);
          }
          conditionMet = (varVal.trim() === expected.trim());
          details = `Var "${varVal}" ${conditionMet ? '===' : '!=='} "${expected}"`;
          break;
        }
        case 'variable_not_equals': {
          let varVal = step.variableValue || '';
          let expected = step.expectedValue || '';
          if (root.VariableEngine) {
            varVal = root.VariableEngine.interpolate(varVal, variables);
            expected = root.VariableEngine.interpolate(expected, variables);
          }
          conditionMet = (varVal.trim() !== expected.trim());
          details = `Var "${varVal}" ${conditionMet ? '!==' : '==='} "${expected}"`;
          break;
        }
        case 'variable_contains': {
          let varVal = step.variableValue || '';
          let expected = step.expectedValue || '';
          if (root.VariableEngine) {
            varVal = root.VariableEngine.interpolate(varVal, variables);
            expected = root.VariableEngine.interpolate(expected, variables);
          }
          conditionMet = varVal.includes(expected);
          details = `Var "${varVal}" ${conditionMet ? 'contains' : 'lacks'} "${expected}"`;
          break;
        }
        case 'checkbox_checked': {
          const el = step.selector ? await this.waitForElement(step.selector, step.timeout || 1500) : null;
          conditionMet = !!(el && el.checked);
          details = conditionMet ? `Checkbox checked: "${step.selector}"` : `Checkbox unchecked/missing: "${step.selector}"`;
          break;
        }
        case 'url_contains': {
          conditionMet = window.location.href.includes(targetText);
          details = conditionMet ? `URL contains "${targetText}"` : `URL does not contain "${targetText}"`;
          break;
        }
        case 'server_connection_error': {
          const pageTitle = (document.title || '').toLowerCase();
          const bodyText = (document.body ? (document.body.innerText || document.body.textContent || '') : '').toLowerCase();
          const serverErrorKeywords = [
            '500 internal server error', '502 bad gateway', '503 service unavailable', '504 gateway timeout',
            'server error', 'connection error', 'network error', 'failed to connect', 'err_connection_refused',
            'err_name_not_resolved', 'connection timed out', 'service unavailable', 'can’t reach this page',
            'cannot reach this page', 'no internet'
          ];
          conditionMet = serverErrorKeywords.some(kw => pageTitle.includes(kw) || bodyText.includes(kw));
          details = conditionMet ? `Server connection error detected on page (500/502/503/Network Drop)` : `No server connection error detected`;
          break;
        }
        default:
          conditionMet = false;
          details = `Unknown condition type: ${conditionType}`;
      }

      this.showToast({
        type: 'condition',
        conditionMet: conditionMet,
        title: `⚡ IF/ELSE Condition: ${conditionMet ? 'TRUE (THEN Branch)' : 'FALSE (ELSE Branch)'}`,
        message: details
      });

      return { success: true, conditionMet: conditionMet, extractedWaitMs: typeof extractedWaitMs !== 'undefined' ? extractedWaitMs : null, details: details };
    }

    parseCooldownSeconds(text) {
      if (!text) return 0;
      const str = String(text);

      // 1. Format: "0min 01 sec", "5 min 00 sec", "0m 34s", "1m 20s", "0 min 5 sec"
      const mSecMatch = str.match(/(\d+)\s*(?:min(?:utes)?|m)\s*(\d+)\s*(?:sec(?:onds)?|s)?/i);
      if (mSecMatch) {
        const m = parseInt(mSecMatch[1], 10);
        const s = parseInt(mSecMatch[2], 10);
        return (m * 60) + s;
      }

      // 2. Format: "04:30" or "0:45" or "5:00"
      const mmssMatch = str.match(/(\d{1,2}):(\d{2})/);
      if (mmssMatch) {
        return parseInt(mmssMatch[1], 10) * 60 + parseInt(mmssMatch[2], 10);
      }

      // 3. Format: "34 seconds", "34 sec", "34s", "1 sec"
      const secMatch = str.match(/(\d+)\s*(?:seconds|sec|s)\b/i);
      if (secMatch) {
        return parseInt(secMatch[1], 10);
      }

      // 4. Format: "5 minutes", "5 min", "5m"
      const minMatch = str.match(/(\d+)\s*(?:minutes|min|m)\b/i);
      if (minMatch) {
        return parseInt(minMatch[1], 10) * 60;
      }

      return 0;
    }

    showToast(data) {
      try {
        let container = document.getElementById('aura-automation-toast-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'aura-automation-toast-container';
          container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          `;
          (document.body || document.documentElement).appendChild(container);
        }

        const toast = document.createElement('div');
        const isCondition = data.type === 'condition';
        const isTrue = isCondition && data.conditionMet;
        const accentColor = isCondition ? (isTrue ? '#10b981' : '#f59e0b') : '#8b5cf6';
        const icon = isCondition ? (isTrue ? '⚡ TRUE' : '🔀 FALSE') : '🔁 LOOP';

        toast.style.cssText = `
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(12px);
          border: 1px solid ${accentColor};
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px ${accentColor}44;
          border-radius: 10px;
          padding: 12px 16px;
          color: #f8fafc;
          min-width: 260px;
          max-width: 360px;
          animation: auraToastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          transition: all 0.3s ease;
        `;

        toast.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: ${accentColor}; display: flex; align-items: center; gap: 6px;">
              ${icon}
            </span>
            <span style="font-size: 10px; color: #94a3b8;">Aura Automator</span>
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${data.title}</div>
          <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">${data.message}</div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(10px)';
          setTimeout(() => toast.remove(), 300);
        }, 2500);
      } catch (e) {
        console.error('Toast notification error:', e);
      }
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

    async checkPageResult(config = {}) {
      const { successSelector, errorSelector, serverErrorDetection } = config;

      let successFound = false;
      let errorFound = false;
      let serverErrorFound = false;
      let extractedDelayMs = null;
      const details = [];

      const isElementVisible = (el) => {
        if (!el) return false;
        try {
          if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.getBoundingClientRect().width === 0 && el.getBoundingClientRect().height === 0) {
            return false;
          }
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
          }
          return true;
        } catch (e) {
          return true;
        }
      };

      const queryEl = (sel) => {
        if (!sel) return null;
        if (root.SelectorEngine) return root.SelectorEngine.querySelector(sel);
        if (sel.startsWith('/') || sel.startsWith('//')) {
          const res = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          return res.singleNodeValue;
        }
        try { return document.querySelector(sel); } catch (e) { return null; }
      };

      const bodyText = (document.body ? (document.body.innerText || document.body.textContent || '') : '').toLowerCase();

      // 1. Success Condition Checks (Element visible OR text match)
      const successSelList = ['p.thanks-page-body', 'div.thanks-page-success', successSelector].filter(Boolean);
      for (const sel of successSelList) {
        const el = queryEl(sel);
        if (el && isElementVisible(el)) {
          successFound = true;
          details.push(`Success element matched: "${sel}"`);
          const elText = el.innerText || el.textContent || '';
          const parsedSec = this.parseCooldownSeconds(elText);
          if (parsedSec > 0) extractedDelayMs = parsedSec * 1000;
          break;
        }
      }

      if (!successFound && bodyText.includes('you will get the service on your link in a few minutes')) {
        successFound = true;
        details.push('Success text matched: "You will get the service on your link in a few minutes."');
      }

      // 2. Error Condition Checks (Element visible OR text match)
      const errorSelList = ['div.thanks-page-error', '#error-message', errorSelector].filter(Boolean);
      for (const sel of errorSelList) {
        const el = queryEl(sel);
        if (el && isElementVisible(el)) {
          errorFound = true;
          details.push(`Error element matched: "${sel}"`);
          const elText = el.innerText || el.textContent || '';
          const parsedSec = this.parseCooldownSeconds(elText);
          if (parsedSec > 0) extractedDelayMs = (parsedSec + 15) * 1000;
          break;
        }
      }

      if (!errorFound) {
        if (bodyText.includes('order error') || 
            bodyText.includes('server connection error') || 
            bodyText.includes('please wait')) {
          errorFound = true;
          details.push('Error message matched in page text');
          const parsedSec = this.parseCooldownSeconds(bodyText);
          if (parsedSec > 0) extractedDelayMs = (parsedSec + 15) * 1000;
        }
      }

      // 3. Server Error Check
      if (serverErrorDetection) {
        if (typeof serverErrorDetection === 'string' && serverErrorDetection.trim()) {
          const el = queryEl(serverErrorDetection);
          if (el && isElementVisible(el)) serverErrorFound = true;
        }
      }

      // 4. PRECEDENCE: Success overrides error if success condition met
      if (successFound) {
        errorFound = false;
        serverErrorFound = false;
      }

      return {
        success: true,
        result: {
          successFound,
          errorFound,
          serverErrorFound,
          extractedDelayMs,
          details: details.join('; ')
        }
      };
    }
  }

  root.WebTaskAutomationEngine = new AutomationEngine();
})();
