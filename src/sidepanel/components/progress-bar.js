/**
 * InstaUnsend — ProgressBar Component (ES Module)
 *
 * Manages the animated progress bar, percentage display,
 * message counter, ETA, and status text.
 */
export class ProgressBar {
  /**
   * @param {Object} els — DOM element references
   * @param {HTMLElement} els.fill    — The inner progress fill bar
   * @param {HTMLElement} els.pct     — Percentage text display
   * @param {HTMLElement} els.current — Current count display
   * @param {HTMLElement} els.total   — Total count display
   * @param {HTMLElement} els.eta     — ETA text display
   * @param {HTMLElement} els.status  — Status message display
   */
  constructor(els) {
    this._fill    = els.fill;
    this._pct     = els.pct;
    this._current = els.current;
    this._total   = els.total;
    this._eta     = els.eta;
    this._status  = els.status;
  }

  /**
   * Update the progress bar with current values.
   * @param {number} current — Current progress value
   * @param {number} total   — Total progress value
   * @param {string} [statusText] — Optional status message
   */
  update(current, total, statusText) {
    const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

    this._fill.style.width      = `${pct}%`;
    this._pct.textContent       = `${pct}%`;
    this._current.textContent   = current;
    this._total.textContent     = total;

    if (statusText) {
      this._status.textContent = statusText;
    }
  }

  /**
   * Reset the progress bar to zero.
   */
  reset() {
    this._fill.style.width    = '0%';
    this._pct.textContent     = '0%';
    this._current.textContent = '0';
    this._total.textContent   = '0';
    this._eta.textContent     = 'ETA: calculating…';
    this._status.textContent  = 'Waiting to start…';
  }

  /**
   * Set indeterminate state (pulsing bar, no percentage).
   * @param {string} [statusText]
   */
  setIndeterminate(statusText) {
    this._fill.style.width    = '100%';
    this._fill.style.opacity  = '0.4';
    this._pct.textContent     = '…';
    this._status.textContent  = statusText || 'Working…';
  }
}
