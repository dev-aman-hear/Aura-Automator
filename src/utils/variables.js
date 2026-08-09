/**
 * Variable Interpolation Engine for WebTask Automator
 */

(function() {
  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);

  const VariableEngineImpl = {
    interpolate(text, customVars = {}) {
      if (!text || typeof text !== 'string') return text;

      const now = new Date();
      const systemVars = {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        datetime: now.toLocaleString(),
        timestamp: String(Date.now()),
        random_number: String(Math.floor(1000 + Math.random() * 9000)),
        uuid: Math.random().toString(36).substring(2, 10)
      };

      const combinedVars = { ...systemVars, ...customVars };

      return text.replace(/\{([a-zA-Z0-9_-]+)\}/g, (match, varName) => {
        if (Object.prototype.hasOwnProperty.call(combinedVars, varName)) {
          return combinedVars[varName] !== undefined ? String(combinedVars[varName]) : '';
        }
        return match;
      });
    },

    extractVariables(text) {
      if (!text || typeof text !== 'string') return [];
      const matches = text.match(/\{([a-zA-Z0-9_-]+)\}/g) || [];
      const vars = matches.map(m => m.replace(/[\{\}]/g, ''));
      return Array.from(new Set(vars));
    }
  };

  root.VariableEngine = Object.assign(root.VariableEngine || {}, VariableEngineImpl);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.VariableEngine;
  }
})();
