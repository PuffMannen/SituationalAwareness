import { SETTINGS, getSetting } from "../settings.mjs";
import { getObservers, getRenderedCenter, gridDistance, isAlly, isSightBlocked } from "../helpers/observers.mjs";
import { ExploredFogFilter } from "../canvas/explored-fog-filter.mjs";

/**
 * Proximity awareness: allied tokens close to one of the user's own tokens remain visible,
 * even when they are outside line of sight or in darkness. You always know where the people
 * standing next to you are.
 */
export class ProximityAwareness {

  /**
   * Filter used as the detection filter of proximity-revealed tokens.
   * @type {ExploredFogFilter|null}
   */
  static #detectionFilter = null;

  /* -------------------------------------------- */

  /**
   * The detection filter assigned to tokens revealed by proximity.
   *
   * Core draws token images beneath the fog of war. When a token has a detection filter, core
   * also draws a filtered copy of its image in the token layer, above the fog. This is how special
   * detection modes such as tremorsense reveal tokens. The filter tints that copy with the scene's
   * explored fog color, so a sensed ally looks as if it stands in explored fog, not in plain sight.
   * @type {ExploredFogFilter}
   */
  static get detectionFilter() {
    this.#detectionFilter ??= new ExploredFogFilter();
    return this.#detectionFilter.refreshColor();
  }

  /* -------------------------------------------- */

  /**
   * Extend whichever Token class is configured once systems have finished their own setup.
   * This preserves system-specific Token subclasses instead of replacing them.
   */
  static extendTokenClass() {
    const Base = CONFIG.Token.objectClass;

    /**
     * Token subclass that treats proximity as a source of awareness.
     * @extends {foundry.canvas.placeables.Token}
     */
    class SituationalAwarenessToken extends Base {
      /** @inheritDoc */
      get isVisible() {
        if ( super.isVisible ) return true;
        if ( !ProximityAwareness.isAware(this) ) return false;
        this.detectionFilter = ProximityAwareness.detectionFilter;
        return true;
      }
    }

    CONFIG.Token.objectClass = SituationalAwarenessToken;
  }

  /* -------------------------------------------- */

  /**
   * Ask every token to re-evaluate its visibility on the next render tick.
   */
  static refresh() {
    if ( !canvas.ready ) return;
    for ( const token of canvas.tokens.placeables ) token.renderFlags.set({refreshVisibility: true});
  }

  /* -------------------------------------------- */

  /**
   * Is the current user aware of this token because one of their tokens is close to it?
   * @param {foundry.canvas.placeables.Token} token
   * @returns {boolean}
   */
  static isAware(token) {
    if ( !getSetting(SETTINGS.PROXIMITY_ENABLED) ) return false;
    if ( !canvas.visibility?.tokenVision ) return false;
    if ( token.document.hidden ) return false;
    if ( !this.#isEligible(token) ) return false;

    const range = getSetting(SETTINGS.PROXIMITY_RANGE);
    const wallsBlock = getSetting(SETTINGS.PROXIMITY_WALLS);
    const target = getRenderedCenter(token);
    for ( const observer of getObservers() ) {
      if ( observer === token ) continue;
      const origin = getRenderedCenter(observer);
      if ( gridDistance(origin, target) > range ) continue;
      if ( wallsBlock && isSightBlocked(origin, target) ) continue;
      return true;
    }
    return false;
  }

  /* -------------------------------------------- */

  /**
   * Does this token qualify for proximity awareness under the configured target rule?
   * Secret dispositions never qualify, so proximity cannot leak a secret token.
   * @param {foundry.canvas.placeables.Token} token
   * @returns {boolean}
   */
  static #isEligible(token) {
    const D = CONST.TOKEN_DISPOSITIONS;
    const disposition = token.document.disposition;
    if ( disposition === D.SECRET ) return false;
    const isParty = !!token.actor?.hasPlayerOwner;
    switch ( getSetting(SETTINGS.PROXIMITY_TARGETS) ) {
      case "party": return isParty;
      case "friendly": return isAlly(token);
      case "all": return true;
      default: return false;
    }
  }
}
