/**
 * Selector Engine for WebTask Automator
 */

(function() {
  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);

  const SelectorEngineImpl = {
    querySelector(selector, context = document) {
      if (!selector || typeof selector !== 'string') return null;
      selector = selector.trim();

      try {
        if (selector.startsWith('/') || selector.startsWith('//') || selector.startsWith('(')) {
          const doc = context.nodeType === Node.DOCUMENT_NODE ? context : context.ownerDocument;
          const result = doc.evaluate(
            selector,
            context,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          return result.singleNodeValue;
        }
        return context.querySelector(selector);
      } catch (e) {
        return null;
      }
    },

    querySelectorAll(selector, context = document) {
      if (!selector || typeof selector !== 'string') return [];
      selector = selector.trim();

      try {
        if (selector.startsWith('/') || selector.startsWith('//') || selector.startsWith('(')) {
          const doc = context.nodeType === Node.DOCUMENT_NODE ? context : context.ownerDocument;
          const nodes = [];
          const result = doc.evaluate(
            selector,
            context,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          for (let i = 0; i < result.snapshotLength; i++) {
            nodes.push(result.snapshotItem(i));
          }
          return nodes;
        }
        return Array.from(context.querySelectorAll(selector));
      } catch (e) {
        return [];
      }
    },

    generateSelector(element) {
      if (!element || !(element instanceof Element)) return '';

      const tagName = element.tagName.toLowerCase();

      if (element.id && !this.isDynamicId(element.id)) {
        const idSelector = `#${CSS.escape(element.id)}`;
        if (this.isUnique(idSelector)) return idSelector;
      }

      const name = element.getAttribute('name');
      if (name) {
        const nameSelector = `${tagName}[name="${CSS.escape(name)}"]`;
        if (this.isUnique(nameSelector)) return nameSelector;
      }

      const dataAttrs = ['data-testid', 'data-id', 'data-qa', 'data-cy', 'data-automation-id', 'data-name'];
      for (const attr of dataAttrs) {
        const val = element.getAttribute(attr);
        if (val) {
          const dataSelector = `[${attr}="${CSS.escape(val)}"]`;
          if (this.isUnique(dataSelector)) return dataSelector;
        }
      }

      const textAttrs = ['aria-label', 'placeholder', 'title', 'alt'];
      for (const attr of textAttrs) {
        const val = element.getAttribute(attr);
        if (val) {
          const textSelector = `${tagName}[${attr}="${CSS.escape(val)}"]`;
          if (this.isUnique(textSelector)) return textSelector;
        }
      }

      const innerText = element.innerText ? element.innerText.trim() : '';
      if ((tagName === 'button' || tagName === 'a' || tagName === 'span') && innerText && innerText.length < 40) {
        const xpath = `//${tagName}[normalize-space(text())="${innerText}"]`;
        if (this.isUnique(xpath)) return xpath;
      }

      if (element.classList && element.classList.length > 0) {
        const validClasses = Array.from(element.classList).filter(cls => !this.isDynamicClass(cls));
        if (validClasses.length > 0) {
          const classSelector = `${tagName}.${validClasses.map(c => CSS.escape(c)).join('.')}`;
          if (this.isUnique(classSelector)) return classSelector;
        }
      }

      let current = element;
      const pathParts = [];

      while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName.toLowerCase() !== 'body') {
        const tag = current.tagName.toLowerCase();

        if (current.id && !this.isDynamicId(current.id)) {
          pathParts.unshift(`#${CSS.escape(current.id)}`);
          break;
        }

        let nth = 1;
        let sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.tagName.toLowerCase() === tag) nth++;
          sibling = sibling.previousElementSibling;
        }

        const part = nth > 1 ? `${tag}:nth-of-type(${nth})` : tag;
        pathParts.unshift(part);

        current = current.parentElement;
      }

      const fullPath = pathParts.join(' > ');
      if (fullPath && this.isUnique(fullPath)) return fullPath;

      return this.generateXPath(element);
    },

    generateXPath(element) {
      if (element.id && !this.isDynamicId(element.id)) {
        return `//*[@id="${element.id}"]`;
      }
      const parts = [];
      while (element && element.nodeType === Node.ELEMENT_NODE) {
        let index = 0;
        let sibling = element.previousSibling;
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === element.tagName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }
        const tagName = element.tagName.toLowerCase();
        const part = index > 0 ? `${tagName}[${index + 1}]` : tagName;
        parts.unshift(part);
        element = element.parentNode;
      }
      return '/' + parts.join('/');
    },

    isUnique(selector) {
      const matches = this.querySelectorAll(selector);
      return matches.length === 1;
    },

    isDynamicId(id) {
      if (!id) return true;
      return /^(ember|react-aria|j_id|css-|sc-|:r|guid-|[0-9a-f]{8}-[0-9a-f]{4})/i.test(id) || /^\d+$/.test(id);
    },

    isDynamicClass(cls) {
      if (!cls) return true;
      return /^(css-[a-zA-Z0-9]+|sc-[a-zA-Z0-9]+|jsx-[0-9]+|style_[a-zA-Z0-9]+|__\w+)/i.test(cls);
    }
  };

  root.SelectorEngine = Object.assign(root.SelectorEngine || {}, SelectorEngineImpl);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.SelectorEngine;
  }
})();
