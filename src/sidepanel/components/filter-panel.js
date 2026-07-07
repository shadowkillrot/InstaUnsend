/**
 * InstaUnsend — FilterPanel Component (ES Module)
 *
 * Manages media type toggles, date range inputs, keyword search,
 * and the Nuclear Option. Returns a structured filter configuration
 * used to drive the unsend engine.
 */
export class FilterPanel {
  /**
   * @param {HTMLElement} container — The filter section container element
   */
  constructor(container) {
    this._container = container;
    this._mediaButtons = container.querySelectorAll('.iu-media-btn');
    this._nuclearBtn   = container.querySelector('#btnNuclear');
    this._dateStart    = container.querySelector('#dateStart');
    this._dateEnd      = container.querySelector('#dateEnd');
    this._keywordInput = container.querySelector('#keywordInput');
    this._regexToggle  = container.querySelector('#regexToggle');
    this._isNuclear    = false;

    this._bindEvents();
  }

  /**
   * Returns the current filter configuration.
   * @returns {{ mediaTypes: string[], dateRange: { start: string|null, end: string|null }, keyword: string, isRegex: boolean, nuclear: boolean }}
   */
  getFilters() {
    const mediaTypes = [];

    if (this._isNuclear) {
      mediaTypes.push('text', 'photo', 'voice', 'reel', 'shared_post', 'other');
    } else {
      this._mediaButtons.forEach((btn) => {
        if (btn.classList.contains('active')) {
          mediaTypes.push(btn.dataset.type);
        }
      });
    }

    return {
      mediaTypes,
      dateRange: {
        start: this._dateStart.value || null,
        end:   this._dateEnd.value || null,
      },
      keyword:  this._keywordInput.value.trim(),
      isRegex:  this._regexToggle.checked,
      nuclear:  this._isNuclear,
    };
  }

  /**
   * Reset all filters to defaults.
   */
  reset() {
    this._mediaButtons.forEach((btn) => btn.classList.add('active'));
    this._isNuclear = false;
    this._nuclearBtn.classList.remove('active');
    this._dateStart.value    = '';
    this._dateEnd.value      = '';
    this._keywordInput.value = '';
    this._regexToggle.checked = false;
  }

  /**
   * Enable the filter section for interaction.
   */
  enable() {
    this._container.classList.remove('iu-disabled');
  }

  /**
   * Disable the filter section.
   */
  disable() {
    this._container.classList.add('iu-disabled');
  }

  /* ────────────────────── Private ────────────────────────────────── */

  _bindEvents() {
    // Media type toggle buttons — click to toggle active state
    this._mediaButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        // If any individual toggle changed, deactivate nuclear
        this._isNuclear = false;
        this._nuclearBtn.classList.remove('active');
      });
    });

    // Nuclear button — activates all media types
    this._nuclearBtn.addEventListener('click', () => {
      this._isNuclear = !this._isNuclear;
      this._nuclearBtn.classList.toggle('active', this._isNuclear);

      // Activate or deactivate all media buttons
      this._mediaButtons.forEach((btn) => {
        btn.classList.toggle('active', this._isNuclear);
      });
    });

    // Date validation — end must be >= start
    this._dateEnd.addEventListener('change', () => {
      if (this._dateStart.value && this._dateEnd.value) {
        if (new Date(this._dateEnd.value) < new Date(this._dateStart.value)) {
          this._dateEnd.value = this._dateStart.value;
        }
      }
    });

    this._dateStart.addEventListener('change', () => {
      if (this._dateStart.value && this._dateEnd.value) {
        if (new Date(this._dateStart.value) > new Date(this._dateEnd.value)) {
          this._dateEnd.value = this._dateStart.value;
        }
      }
    });
  }
}
