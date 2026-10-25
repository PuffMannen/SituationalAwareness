import { I18N, MODULE_ID, SHARE_FLAG } from "../constants.mjs";
import { SETTINGS, getSetting } from "../settings.mjs";
import { sharesSightings } from "../helpers/observers.mjs";

/**
 * The form field and update key of the share flag.
 * @type {string}
 */
const FLAG_PATH = `flags.${MODULE_ID}.${SHARE_FLAG}`;

/**
 * Add the GM's controls for letting tokens share their sightings: a checkbox in the token and
 * prototype token sheets, and a Token HUD button which sets every selected token at once.
 */
export function registerShareControls() {
  // Fired for both TokenConfig and PrototypeTokenConfig, which share this parent class
  Hooks.on("renderTokenApplication", (app, element) => addConfigField(app, element));
  Hooks.on("renderTokenHUD", (hud, element) => addHUDButton(hud, element));
}

/* -------------------------------------------- */

/**
 * Add the share checkbox to the Vision tab of a token sheet.
 * @param {foundry.applications.api.ApplicationV2} app    The token or prototype token sheet
 * @param {HTMLElement} element
 */
function addConfigField(app, element) {
  if ( !game.user.isGM ) return;
  const tab = element.querySelector('.tab[data-tab="vision"]');
  if ( !tab || tab.querySelector(`[name="${FLAG_PATH}"]`) ) return;
  const fields = foundry.applications.fields;
  const input = fields.createCheckboxInput({
    name: FLAG_PATH,
    value: !!foundry.utils.getProperty(app.token, FLAG_PATH)
  });
  const group = fields.createFormGroup({
    input,
    label: `${I18N}.ShareSightings.Name`,
    hint: `${I18N}.ShareSightings.Hint`,
    rootId: app.id,
    localize: true
  });
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.innerText = game.i18n.localize(`${I18N}.ShareSightings.Legend`);
  fieldset.append(legend, group);
  tab.append(fieldset);
}

/* -------------------------------------------- */

/**
 * Add the share button to the Token HUD. Like core's visibility button, it sets every selected
 * token to the opposite of the token the HUD belongs to.
 * @param {foundry.applications.hud.TokenHUD} hud
 * @param {HTMLElement} element
 */
function addHUDButton(hud, element) {
  if ( !game.user.isGM || !getSetting(SETTINGS.LAST_KNOWN_ENABLED) || !getSetting(SETTINGS.LAST_KNOWN_SHARE) ) return;
  const column = element.querySelector(".col.left");
  if ( !column ) return;
  const active = sharesSightings(hud.object);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "control-icon";
  button.classList.toggle("active", active);
  button.dataset.tooltip = "";
  button.ariaLabel = game.i18n.localize(`${I18N}.ShareSightings.${active ? "Stop" : "Start"}`);
  button.innerHTML = '<i class="fa-solid fa-tower-broadcast" inert></i>';
  button.addEventListener("click", () => {
    const tokens = new Set([hud.object, ...canvas.tokens.controlled]);
    const updates = Array.from(tokens, t => ({_id: t.id, [FLAG_PATH]: !active}));
    canvas.scene.updateEmbeddedDocuments("Token", updates)
      .catch(err => console.error("Situational Awareness | Failed to update sharing", err));
  });
  column.append(button);
}
