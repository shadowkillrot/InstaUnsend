/**
 * InstaUnsend — Shared Constants
 * 
 * Self-registering module for the content-script execution context.
 * All content script files share the window.__IU namespace.
 * Service worker and side panel define their own copies of these
 * constants (they're simple strings, not complex logic).
 */
(function () {
  'use strict';

  const IU = (window.__IU = window.__IU || {});

  /* ───────────────────────── Message Types ───────────────────────── */
  IU.MSG = Object.freeze({
    // Side Panel → Content Script (routed through Service Worker)
    START_INDEX:     'IU_START_INDEX',
    START_UNSEND:    'IU_START_UNSEND',
    PAUSE:           'IU_PAUSE',
    RESUME:          'IU_RESUME',
    ABORT:           'IU_ABORT',
    STATUS_REQUEST:  'IU_STATUS_REQUEST',

    // Content Script → Side Panel (routed through Service Worker)
    CONTENT_READY:   'IU_CONTENT_READY',
    INDEX_PROGRESS:  'IU_INDEX_PROGRESS',
    INDEX_COMPLETE:  'IU_INDEX_COMPLETE',
    UNSEND_PROGRESS: 'IU_UNSEND_PROGRESS',
    UNSEND_COMPLETE: 'IU_UNSEND_COMPLETE',
    STATUS_RESPONSE: 'IU_STATUS_RESPONSE',
    ERROR:           'IU_ERROR',
  });

  /* ──────────────────────── Media / Message Types ───────────────── */
  IU.MediaType = Object.freeze({
    TEXT:        'text',
    PHOTO:      'photo',
    VOICE:      'voice',
    REEL:       'reel',
    SHARED_POST:'shared_post',
    OTHER:      'other',
  });

  /* ──────────────────────── Operation States ────────────────────── */
  IU.OpState = Object.freeze({
    IDLE:      'idle',
    INDEXING:  'indexing',
    INDEXED:   'indexed',
    UNSENDING: 'unsending',
    PAUSED:    'paused',
    COMPLETE:  'complete',
    ERROR:     'error',
  });

  /* ──────────────────────── Timing (milliseconds) ───────────────── */
  IU.Delays = Object.freeze({
    // Hover-to-click delay range (mimics human reading/aim)
    HOVER_MIN:             300,
    HOVER_MAX:             800,

    // Master delay between consecutive unsend actions
    MASTER_MIN:            2500,
    MASTER_MAX:            6000,

    // Exponential backoff on rate-limit / failure
    BACKOFF_BASE:          15000,
    BACKOFF_MAX:           120000,

    // Scroll indexing cadence
    SCROLL_STEP_INTERVAL:  500,
    SCROLL_SETTLE:         1500,   // wait for React hydration after scroll

    // Safety limits
    INDEX_TIMEOUT:         600000, // 10 minutes max indexing time
    MUTATION_TIMEOUT:      5000,   // wait for DOM mutation confirmation
    MAX_CONSECUTIVE_FAILS: 5,      // circuit breaker threshold
  });

  /* ──────────────────────── Storage Keys ────────────────────────── */
  IU.StorageKeys = Object.freeze({
    OPERATION_STATE: 'iu_operationState',
    INDEX_CACHE:     'iu_indexCache',
    PREFERENCES:     'iu_preferences',
    OPERATION_LOG:   'iu_operationLog',
  });

})();
