/**
 * Visual Element Picker for WebTask Automator
 * Enables interactive selection of DOM elements with highlight overlay and badge preview.
 */

(function() {
  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);
  if (root.WebTaskElementPicker) return;

  class ElementPicker {
    constructor() {
      this.active = false;
      this.hoveredElement = null;
      this.shadowHost = null;
      this.shadowRoot = null;
      this.overlayBox = null;
      this.badgeEl = null;
      this.headerBanner = null;
      this.onMouseMoveBound = this.onMouseMove.bind(this);
      this.onClickBound = this.onClick.bind(this);
      this.onKeyDownBound = this.onKeyDown.bind(this);
    }

    start() {
      if (this.active) return;
      this.active = true;
      this.createShadowUI();
      
      document.addEventListener('mousemove', this.onMouseMoveBound, true);
      document.addEventListener('click', this.onClickBound, true);
      document.addEventListener('keydown', this.onKeyDownBound, true);
    }

    stop() {
      if (!this.active) return;
      this.active = false;

      document.removeEventListener('mousemove', this.onMouseMoveBound, true);
      document.removeEventListener('click', this.onClickBound, true);
      document.removeEventListener('keydown', this.onKeyDownBound, true);

      if (this.shadowHost && this.shadowHost.parentNode) {
        this.shadowHost.parentNode.removeChild(this.shadowHost);
      }
      this.shadowHost = null;
      this.shadowRoot = null;
      this.hoveredElement = null;
    }

    createShadowUI() {
      this.shadowHost = document.createElement('webtask-picker-host');
      this.shadowHost.style.cssText = 'position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;';
      
      this.shadowRoot = this.shadowHost.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = `
        .picker-overlay {
          position: fixed;
          pointer-events: none;
          border: 2px solid #3b82f6;
          background-color: rgba(59, 130, 246, 0.15);
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          transition: all 0.05s ease-out;
          z-index: 2147483645;
          display: none;
          border-radius: 3px;
        }

        .picker-badge {
          position: fixed;
          pointer-events: none;
          background-color: #0f172a;
          color: #f8fafc;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          font-weight: 600;
          z-index: 2147483646;
          display: none;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          border: 1px solid #334155;
          white-space: nowrap;
          max-width: 400px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .picker-badge span.tag { color: #60a5fa; }
        .picker-badge span.sel { color: #f43f5e; }

        .picker-banner {
          position: fixed;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: auto;
          background-color: #0f172a;
          color: #ffffff;
          padding: 10px 20px;
          border-radius: 9999px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          font-weight: 500;
          z-index: 2147483647;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
          border: 1px solid #3b82f6;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .picker-banner button {
          background: #ef4444;
          color: #ffffff;
          border: none;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .picker-banner button:hover {
          background: #dc2626;
        }
      `;

      this.overlayBox = document.createElement('div');
      this.overlayBox.className = 'picker-overlay';

      this.badgeEl = document.createElement('div');
      this.badgeEl.className = 'picker-badge';

      this.headerBanner = document.createElement('div');
      this.headerBanner.className = 'picker-banner';
      this.headerBanner.innerHTML = `
        <span>🎯 <strong>Aura Automator Element Picker Active</strong> — Hover & click target element (ESC to cancel)</span>
        <button id="cancelPickerBtn">Cancel</button>
      `;

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(this.overlayBox);
      this.shadowRoot.appendChild(this.badgeEl);
      this.shadowRoot.appendChild(this.headerBanner);

      document.body.appendChild(this.shadowHost);

      const cancelBtn = this.shadowRoot.getElementById('cancelPickerBtn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.stop();
        });
      }
    }

    onMouseMove(e) {
      if (!this.active) return;

      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target === this.shadowHost || this.shadowHost.contains(target)) return;

      this.hoveredElement = target;
      const rect = target.getBoundingClientRect();

      this.overlayBox.style.display = 'block';
      this.overlayBox.style.top = `${rect.top}px`;
      this.overlayBox.style.left = `${rect.left}px`;
      this.overlayBox.style.width = `${rect.width}px`;
      this.overlayBox.style.height = `${rect.height}px`;

      const selector = root.SelectorEngine ? root.SelectorEngine.generateSelector(target) : target.tagName.toLowerCase();
      const tagName = target.tagName.toLowerCase();
      const dim = `${Math.round(rect.width)}×${Math.round(rect.height)}`;

      this.badgeEl.style.display = 'block';
      this.badgeEl.innerHTML = `<span class="tag">&lt;${tagName}&gt;</span> ${dim} | <span class="sel">${this.escapeHtml(selector)}</span>`;

      let badgeTop = rect.top - 30;
      if (badgeTop < 40) badgeTop = rect.bottom + 5;
      let badgeLeft = Math.max(10, rect.left);

      this.badgeEl.style.top = `${badgeTop}px`;
      this.badgeEl.style.left = `${badgeLeft}px`;
    }

    onClick(e) {
      if (!this.active) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const target = this.hoveredElement || document.elementFromPoint(e.clientX, e.clientY);
      if (target && target !== this.shadowHost && !this.shadowHost.contains(target)) {
        const selector = root.SelectorEngine ? root.SelectorEngine.generateSelector(target) : target.tagName.toLowerCase();
        
        const previewInfo = {
          tagName: target.tagName.toLowerCase(),
          id: target.id || '',
          name: target.getAttribute('name') || '',
          text: (target.innerText || target.value || '').trim().substring(0, 50),
          selector: selector
        };

        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({
            type: 'ELEMENT_PICKED',
            selector: selector,
            preview: previewInfo
          });
        }

        console.log('🎯 Element Picked:', selector, previewInfo);
      }

      this.stop();
    }

    onKeyDown(e) {
      if (!this.active) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.stop();
      }
    }

    escapeHtml(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  }

  root.WebTaskElementPicker = new ElementPicker();
})();
