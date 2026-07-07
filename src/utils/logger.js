/**
 * InstaUnsend — Logger
 * 
 * Structured, color-coded console logging for the content script context.
 * Provides clear visual distinction between log levels.
 */
(function () {
  'use strict';

  const IU = (window.__IU = window.__IU || {});

  const PREFIX = '%c[InstaUnsend]';
  const STYLES = {
    info:    'color: #818cf8; font-weight: 600;',
    warn:    'color: #f59e0b; font-weight: 600;',
    error:   'color: #ef4444; font-weight: 600;',
    success: 'color: #22c55e; font-weight: 600;',
    debug:   'color: #6b7280; font-weight: 600;',
  };

  IU.log = Object.freeze({
    info:    (msg, ...args) => console.log(PREFIX, STYLES.info, msg, ...args),
    warn:    (msg, ...args) => console.warn(PREFIX, STYLES.warn, msg, ...args),
    error:   (msg, ...args) => console.error(PREFIX, STYLES.error, msg, ...args),
    success: (msg, ...args) => console.log(PREFIX, STYLES.success, msg, ...args),
    debug:   (msg, ...args) => console.debug(PREFIX, STYLES.debug, msg, ...args),
  });

})();
