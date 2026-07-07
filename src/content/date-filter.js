/**
 * InstaUnsend — Date Filter
 *
 * Feature 3: Date-Range Selection Protocol
 *
 * Filters indexed messages to only include those that fall within
 * a user-specified start and end date window.
 */
(function () {
  'use strict';

  const IU = (window.__IU = window.__IU || {});

  IU.DateFilter = {
    /**
     * Filter messages by date range.
     *
     * @param {Array} messages — Indexed messages from GenesisIndexer
     * @param {string|null} startDate — ISO date string or YYYY-MM-DD (inclusive)
     * @param {string|null} endDate — ISO date string or YYYY-MM-DD (inclusive)
     * @returns {Array} — Filtered messages within the date range
     */
    filter(messages, startDate, endDate) {
      // If no date range specified, return all messages
      if (!startDate && !endDate) return messages;

      const start = startDate ? this._normalizeToStartOfDay(startDate) : null;
      const end   = endDate   ? this._normalizeToEndOfDay(endDate)     : null;

      return messages.filter((msg) => {
        // Messages without timestamps pass through (we can't exclude them)
        if (!msg.timestamp) return true;

        const msgDate = new Date(msg.timestamp).getTime();

        if (start && msgDate < start) return false;
        if (end && msgDate > end) return false;

        return true;
      });
    },

    /**
     * Normalize a date string to the start of that day (00:00:00.000).
     * @param {string} dateStr
     * @returns {number} — Timestamp in milliseconds
     */
    _normalizeToStartOfDay(dateStr) {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    },

    /**
     * Normalize a date string to the end of that day (23:59:59.999).
     * @param {string} dateStr
     * @returns {number} — Timestamp in milliseconds
     */
    _normalizeToEndOfDay(dateStr) {
      const d = new Date(dateStr);
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    },
  };

})();
