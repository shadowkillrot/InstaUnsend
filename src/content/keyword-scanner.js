/**
 * InstaUnsend — Keyword Scanner
 *
 * Feature 4: Keyword Targeting
 *
 * Scans the textContent of indexed messages against user-provided
 * keywords or regular expressions, returning only matching messages
 * for the unsend queue.
 */
(function () {
  'use strict';

  const IU = (window.__IU = window.__IU || {});

  IU.KeywordScanner = {
    /**
     * Filter messages by keyword or regex match.
     *
     * @param {Array} messages — Indexed messages from GenesisIndexer
     * @param {string} keyword — Search term or regex pattern
     * @param {boolean} [isRegex=false] — If true, treat keyword as a regex
     * @returns {Array} — Messages whose text content matches
     */
    filter(messages, keyword, isRegex = false) {
      // If no keyword, return all messages
      if (!keyword || keyword.trim() === '') return messages;

      const pattern = this._buildPattern(keyword.trim(), isRegex);
      if (!pattern) return messages;

      return messages.filter((msg) => {
        // Only scan text-bearing messages
        if (!msg.text) return false;
        return pattern.test(msg.text);
      });
    },

    /**
     * Count matches across all messages (for preview/confirmation).
     *
     * @param {Array} messages
     * @param {string} keyword
     * @param {boolean} [isRegex=false]
     * @returns {number}
     */
    countMatches(messages, keyword, isRegex = false) {
      return this.filter(messages, keyword, isRegex).length;
    },

    /**
     * Build a RegExp from the user's input.
     * @param {string} input — Raw user input
     * @param {boolean} isRegex — Whether to treat as raw regex
     * @returns {RegExp|null}
     */
    _buildPattern(input, isRegex) {
      try {
        if (isRegex) {
          return new RegExp(input, 'i');
        }
        // Escape special regex characters for literal search
        const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, 'i');
      } catch (err) {
        IU.log.error(`Invalid regex pattern: "${input}" — ${err.message}`);
        return null;
      }
    },
  };

})();
