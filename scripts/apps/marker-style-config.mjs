import { I18N, MODULE_ID } from "../constants.mjs";
import { SETTINGS, getMarkerStyle } from "../settings.mjs";
import { getMarkerStyleField } from "../data/marker-style.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only form for customizing how last known position markers look for every player.
 * Opened from the module settings. Saving redraws all markers immediately.
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

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      style: getMarkerStyle(),
      fields: getMarkerStyleField().fields,
      buttons: [
        {type: "button", action: "resetDefaults", icon: "fa-solid fa-arrow-rotate-left", label: `${I18N}.MarkerStyle.Reset`},
        {type: "submit", icon: "fa-solid fa-floppy-disk", label: "SETTINGS.Save"}
      ]
    });
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
    await game.settings.set(MODULE_ID, SETTINGS.LAST_KNOWN_STYLE, formData.object);
  }

  /* -------------------------------------------- */

  /**
   * Restore the default marker style and re-render the form.
   * @this {MarkerStyleConfig}
   * @returns {Promise<void>}
   */
  static async #onResetDefaults() {
    await game.settings.set(MODULE_ID, SETTINGS.LAST_KNOWN_STYLE, getMarkerStyleField().getInitialValue({}));
    await this.render();
  }
}
