import { I18N, MODULE_ID } from "../constants.mjs";
import { STYLE_SETTINGS, getMarkerStyle } from "../settings.mjs";
import { getMarkerStyleField } from "../data/marker-style.mjs";
import { MARKER_PRESETS, getPresetStyle } from "../data/marker-presets.mjs";
import { getFontAwesomeIcons, resolveFontAwesome } from "../helpers/font-awesome.mjs";

/** @import { MarkerKind, MarkerStyle } from "../data/marker-style.mjs" */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM-only form for customizing how last known position markers look for every player.
 * Enemies and allies each have a tab with their own style. Picking a preset or resetting fills
 * in the open tab without saving. Saving stores both styles and redraws all markers.
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
    tabs: {template: "templates/generic/tab-navigation.hbs"},
    form: {template: `modules/${MODULE_ID}/templates/marker-style-config.hbs`, scrollable: [""]},
    footer: {template: "templates/generic/form-footer.hbs"}
  };

  /** @override */
  static TABS = {
    kind: {
      tabs: [
        {id: "enemy", icon: "fa-solid fa-skull"},
        {id: "ally", icon: "fa-solid fa-handshake"}
      ],
      initial: "enemy",
      labelPrefix: `${I18N}.MarkerStyle.Tabs`
    }
  };

  /**
   * Unsaved styles shown in the form, by marker kind. Empty until a preset or reset changes the form.
   * @type {Partial<Record<MarkerKind, MarkerStyle>>}
   */
  #drafts = {};

  /**
   * The preset last chosen on each tab.
   * @type {Partial<Record<MarkerKind, string>>}
   */
  #presets = {};

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const presets = Object.fromEntries(Object.entries(MARKER_PRESETS).map(([key, {label}]) => [key, label]));
    const kinds = Object.values(context.tabs).map(tab => ({
      ...tab,
      fields: getMarkerStyleField(tab.id).fields,
      style: this.#drafts[tab.id] ?? getMarkerStyle(tab.id),
      preset: this.#presets[tab.id] ?? "",
      hint: `${I18N}.MarkerStyle.TabHints.${tab.id}`
    }));
    return Object.assign(context, {
      kinds,
      presets,
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
    for ( const select of this.element.querySelectorAll("select[data-preset]") ) {
      select.addEventListener("change", event => {
        const kind = event.currentTarget.dataset.preset;
        const key = event.currentTarget.value;
        if ( !key ) return;
        this.#replaceDraft(kind, getPresetStyle(key, kind), key);
      });
    }
    this.#activateIconInputs();
  }

  /* -------------------------------------------- */

  /**
   * Suggest every Font Awesome icon in the icon fields, and preview the entered icon as it is typed.
   */
  #activateIconInputs() {
    const datalist = this.element.querySelector(`#${MODULE_ID}-icons`);
    if ( datalist && !datalist.childElementCount ) {
      datalist.replaceChildren(...getFontAwesomeIcons().map(value => {
        const option = document.createElement("option");
        option.value = value;
        return option;
      }));
    }
    for ( const input of this.element.querySelectorAll("input[data-icon-input]") ) {
      const preview = input.closest(".form-fields").querySelector("[data-icon-preview]");
      const update = () => {
        const known = !!resolveFontAwesome(input.value);
        preview.className = `${known ? input.value : "fa-solid fa-circle-exclamation"} fa-fw`;
        if ( known ) delete preview.dataset.tooltip;
        else preview.dataset.tooltip = `${I18N}.MarkerStyle.icon.Unknown`;
      };
      input.addEventListener("input", update);
      update();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClose(options) {
    super._onClose(options);
    this.#drafts = {};
    this.#presets = {};
  }

  /* -------------------------------------------- */

  /**
   * The styles currently entered in the form, by marker kind.
   * Core names each input by its full setting path, because each schema is a setting's type.
   * @returns {Partial<Record<MarkerKind, object>>}
   */
  #readForm() {
    const FormDataExtended = foundry.applications.ux.FormDataExtended;
    const submitted = foundry.utils.expandObject(new FormDataExtended(this.element).object);
    return MarkerStyleConfig.#stylesFrom(submitted);
  }

  /* -------------------------------------------- */

  /**
   * Pick each kind's style out of expanded form data.
   * @param {object} submitted
   * @returns {Partial<Record<MarkerKind, object>>}
   */
  static #stylesFrom(submitted) {
    const styles = {};
    for ( const [kind, key] of Object.entries(STYLE_SETTINGS) ) {
      const style = foundry.utils.getProperty(submitted, `${MODULE_ID}.${key}`);
      if ( style ) styles[kind] = style;
    }
    return styles;
  }

  /* -------------------------------------------- */

  /**
   * Replace one tab's style in the form, keeping unsaved edits on the other tab.
   * @param {MarkerKind} kind
   * @param {MarkerStyle} style
   * @param {string|null} preset    The preset the style came from, if any
   */
  #replaceDraft(kind, style, preset) {
    this.#drafts = {...this.#readForm(), [kind]: style};
    if ( preset ) this.#presets[kind] = preset;
    else delete this.#presets[kind];
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Save both submitted styles. Core cleans and validates each against its setting's schema.
   * @this {MarkerStyleConfig}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {foundry.applications.ux.FormDataExtended} formData
   * @returns {Promise<void>}
   */
  static async #onSubmit(event, form, formData) {
    const styles = MarkerStyleConfig.#stylesFrom(foundry.utils.expandObject(formData.object));
    for ( const [kind, style] of Object.entries(styles) ) {
      await game.settings.set(MODULE_ID, STYLE_SETTINGS[kind], style);
    }
  }

  /* -------------------------------------------- */

  /**
   * Fill in the default style for the open tab. Nothing is saved until the form is submitted.
   * @this {MarkerStyleConfig}
   */
  static #onResetDefaults() {
    const kind = this.tabGroups.kind;
    this.#replaceDraft(kind, getMarkerStyleField(kind).getInitialValue({}), null);
  }
}
