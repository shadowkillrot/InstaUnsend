/**
 * InstaUnsend — State Manager (Service Worker Module)
 *
 * Wraps chrome.storage.local for persisting operation state
 * across service worker restarts. The MV3 service worker is
 * event-driven and terminates when idle — all state must be
 * externalized to survive this lifecycle.
 */

const STORAGE_PREFIX = 'iu_';

export class StateManager {
  /**
   * Save a value to persistent storage.
   * @param {string} key
   * @param {any} value
   */
  static async set(key, value) {
    await chrome.storage.local.set({ [`${STORAGE_PREFIX}${key}`]: value });
  }

  /**
   * Retrieve a value from persistent storage.
   * @param {string} key
   * @param {any} [defaultValue=null]
   * @returns {Promise<any>}
   */
  static async get(key, defaultValue = null) {
    const result = await chrome.storage.local.get(`${STORAGE_PREFIX}${key}`);
    return result[`${STORAGE_PREFIX}${key}`] ?? defaultValue;
  }

  /**
   * Remove a key from storage.
   * @param {string} key
   */
  static async remove(key) {
    await chrome.storage.local.remove(`${STORAGE_PREFIX}${key}`);
  }

  /* ────────────────────── Operation State ────────────────────────── */

  /**
   * Save the current operation state.
   * @param {{ state: string, progress?: object, timestamp?: number }} opState
   */
  static async saveOperationState(opState) {
    await StateManager.set('operationState', {
      ...opState,
      timestamp: Date.now(),
    });
  }

  /**
   * Load the last saved operation state.
   * @returns {Promise<Object|null>}
   */
  static async loadOperationState() {
    return StateManager.get('operationState', null);
  }

  /**
   * Clear the saved operation state.
   */
  static async clearOperationState() {
    await StateManager.remove('operationState');
  }

  /* ────────────────────── User Preferences ───────────────────────── */

  /**
   * Load user preferences (delay settings, etc.).
   * @returns {Promise<Object>}
   */
  static async loadPreferences() {
    return StateManager.get('preferences', {
      delayMin: 2500,
      delayMax: 6000,
      hoverMin: 300,
      hoverMax: 800,
      maxConsecutiveFails: 5,
    });
  }

  /**
   * Save user preferences.
   * @param {Object} prefs
   */
  static async savePreferences(prefs) {
    await StateManager.set('preferences', prefs);
  }

  /* ────────────────────── Operation Log ──────────────────────────── */

  /**
   * Append an entry to the persistent operation log.
   * @param {{ level: string, message: string }} entry
   */
  static async appendLog(entry) {
    const log = await StateManager.get('operationLog', []);

    log.push({
      ...entry,
      timestamp: Date.now(),
    });

    // Keep last 500 entries
    if (log.length > 500) {
      log.splice(0, log.length - 500);
    }

    await StateManager.set('operationLog', log);
  }

  /**
   * Retrieve the full operation log.
   * @returns {Promise<Array>}
   */
  static async getLog() {
    return StateManager.get('operationLog', []);
  }

  /**
   * Clear the operation log.
   */
  static async clearLog() {
    await StateManager.set('operationLog', []);
  }
}
