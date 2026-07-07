/**
 * InstaUnsend — LogViewer Component (ES Module)
 *
 * Appends timestamped, color-coded log entries to a scrollable
 * container. Supports log levels: info, success, warn, error.
 */
export class LogViewer {
  /**
   * @param {HTMLElement} container — The log entries container element
   */
  constructor(container) {
    this._container = container;
    this._maxEntries = 200;
  }

  /** Level → icon mapping */
  static ICONS = {
    info:    'ℹ️',
    success: '✅',
    warn:    '⚠️',
    error:   '❌',
  };

  /**
   * Add a new log entry.
   * @param {'info'|'success'|'warn'|'error'} level
   * @param {string} message
   */
  add(level, message) {
    // Remove the "empty" placeholder if present
    const empty = this._container.querySelector('.iu-log-empty');
    if (empty) empty.remove();

    const entry = document.createElement('div');
    entry.className = 'iu-log-entry';

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    entry.innerHTML = `
      <span class="iu-log-time">${time}</span>
      <span class="iu-log-icon">${LogViewer.ICONS[level] || 'ℹ️'}</span>
      <span class="iu-log-msg">${this._escapeHtml(message)}</span>
    `;

    this._container.appendChild(entry);

    // Trim old entries if exceeding max
    while (this._container.children.length > this._maxEntries) {
      this._container.removeChild(this._container.firstChild);
    }

    // Auto-scroll to bottom
    this._container.scrollTop = this._container.scrollHeight;
  }

  /**
   * Clear all log entries and show empty placeholder.
   */
  clear() {
    this._container.innerHTML = `
      <div class="iu-log-empty">No activity yet. Index a chat to begin.</div>
    `;
  }

  /**
   * Escape HTML entities to prevent XSS in log messages.
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
