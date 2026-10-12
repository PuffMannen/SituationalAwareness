import { I18N, MODULE_ID } from "../constants.mjs";
import { SETTINGS, getMarkerStyle } from "../settings.mjs";
import { getMarkerStyleField } from "../data/marker-style.mjs";
import { MARKER_PRESETS, getPresetStyle } from "../data/marker-presets.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only form for customizing how last known position markers look for every player.
 * Opened from the module settings. Picking a preset fills in the form without saving it.
 * Saving redraws all markers immediately.
 * @extends {ApplicationV2}
 * @mixes HandlebarsApplicationMixin
 */
export class MarkerStyleConfig extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-marker-style`,
    tag: "form",
    classes: [MODULE_ID],
    window: {
      title: `${I18N}.MarkerStyle.Title`,
      icon: "fa-solid fa-location-crosshairs",
      contentClasses: ["standard-form"]
    },
    position: {width: 520},
    form: {
      handler: MarkerStyleConfig.#onSubmit,
      closeOnSubmit: true
    },
    actions: {
      resetDefaults: MarkerStyleConfig.#onResetDefaults
    }
  };

  /** @override */
  static PARTS = {
    form: {template: `modules/${MODULE_ID}/templates/marker-style-config.hbs`, scrollable: [""]},
    footer: {template: "templates/generic/form-footer.hbs"}
  };

  /**
   * The preset chosen in this form, if any.
   * @type {string|null}
   */
  #preset = null;

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      style: this.#preset ? getPresetStyle(this.#preset) : getMarkerStyle(),
      fields: getMarkerStyleField().fields,
      preset: this.#preset ?? "",
      presets: Object.fromEntries(Object.entries(MARKER_PRESETS).map(([key, {label}]) => [key, label])),
      buttons: [
        {type: "button", action: "resetDefaults", icon: "fa-solid fa-arrow-rotate-left", label: `${I18N}.MarkerStyle.Reset`},
        {type: "submit", icon: "fa-solid fa-floppy-disk", label: "SETTINGS.Save"}
      ]
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector("select[data-preset]")?.addEventListener("change", event => {
      this.#preset = event.currentTarget.value || null;
      this.render();
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClose(options) {
    super._onClose(options);
    this.#preset = null;
  }

  /* -------------------------------------------- */

  /**
   * Save the submitted style. Core cleans and validates it against the setting's schema.
   * @this {MarkerStyleConfig}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {foundry.applications.ux.FormDataExtended} formData
   * @returns {Promise<void>}
   */
  static async #onSubmit(event, form, formData) {
    // The schema is the setting's type, so core names each input by its full setting path
    const submitted = foundry.utils.expandObject(formData.object);
    const style = foundry.utils.getProperty(submitted, `${MODULE_ID}.${SETTINGS.LAST_KNOWN_STYLE}`) ?? submitted;
    await game.settings.set(MODULE_ID, SETTINGS.LAST_KNOWN_STYLE, style);
  }

  /* -------------------------------------------- */

  /**
   * Restore the default marker style and re-render the form.
   * @this {MarkerStyleConfig}
   * @returns {Promise<void>}
   */
  static async #onResetDefaults() {
    await game.settings.set(MODULE_ID, SETTINGS.LAST_KNOWN_STYLE, getMarkerStyleField().getInitialValue({}));
    this.#preset = null;
    await this.render();
  }
}
