/**
 * Content Script Selector Wrapper for WebTask Automator
 */
(function() {
  if (typeof window.WebTaskSelectorEngine === 'undefined') {
    window.WebTaskSelectorEngine = window.SelectorEngine || {
      getSelector: (el) => window.SelectorEngine ? window.SelectorEngine.generateSelector(el) : el.tagName.toLowerCase(),
      querySelector: (sel, ctx) => window.SelectorEngine ? window.SelectorEngine.querySelector(sel, ctx) : document.querySelector(sel)
    };
  }
})();
