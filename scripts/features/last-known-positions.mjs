import { I18N, MODULE_ID, SOCKET_NAME } from "../constants.mjs";
import { SETTINGS, getMarkerStyle, getSetting } from "../settings.mjs";
import { getRenderedCenter, hasRestrictedVision, isAlly } from "../helpers/observers.mjs";
import { LastKnownMarker } from "../canvas/last-known-marker.mjs";

/** @import { LastKnownData } from "../canvas/last-known-marker.mjs" */
/** @import { MarkerKind } from "../data/marker-style.mjs" */

/**
 * The user flag holding persisted sightings, keyed by scene id.
 * @type {string}
 */
const FLAG_KEY = "lastKnown";

/**
 * Minimum movement in pixels before a change of position updates the recorded heading.
 * @type {number}
 */
const HEADING_THRESHOLD = 2;

/**
 * Delay after the canvas is ready before visibility changes are treated as real sightings.
 * Prevents a flood of markers while vision initializes.
 * @type {number}
 */
const ARM_DELAY_MS = 500;

/**
 * How long a cleared marker takes to fade out, in milliseconds.
 * @type {number}
 */
const FADE_MS = 1000;

/**
 * Per-marker state used to clear markers whose spot is seen empty.
 * @typedef SpotState
 * @property {boolean} away          Whether the spot has been out of sight since the marker appeared
 * @property {number|null} timer     Pending timeout which starts the fade
 * @property {boolean} fading        Whether the marker is fading out
 */

/**
 * Last known position tracking. When a tracked token leaves the user's sight, a marker is
 * left where it was last seen, showing the direction it was heading. Markers clear as soon as
 * the token is seen again. Sightings persist per user and can be shared with the party.
 */
export class LastKnownPositions {

  /**
   * Sightings for the current scene, keyed by token id.
   * @type {Map<string, LastKnownData>}
   */
  static #sightings = new Map();

  /**
   * Rendered markers for the current scene, keyed by token id.
   * @type {Map<string, LastKnownMarker>}
   */
  static #markers = new Map();

  /**
   * Per-token visibility state used to detect transitions.
   * @type {Map<string, {visible: boolean, center: {x: number, y: number}|null, direction: number|null}>}
   */
  static #states = new Map();

  /**
   * Clearing state for each marker, keyed by token id.
   * @type {Map<string, SpotState>}
   */
  static #spots = new Map();

  /**
   * Parent container for markers.
   * @type {PIXI.Container|null}
   */
  static #container = null;

  /**
   * Whether visibility transitions are currently recorded as sightings.
   * @type {boolean}
   */
  static #armed = false;

  /**
   * Whether the current scene's sightings have unsaved changes.
   * @type {boolean}
   */
  static #dirty = false;

  /**
   * Debounced persistence of the current scene's sightings.
   * @type {Function}
   */
  static #persistSoon = foundry.utils.debounce(() => this.#persist(), 1000);

  /* -------------------------------------------- */
  /*  Registration                                */
  /* -------------------------------------------- */

  /**
   * Register hooks used by this feature.
   */
  static registerHooks() {
    Hooks.on("canvasReady", () => this.#onCanvasReady());
    Hooks.on("canvasTearDown", () => this.#onCanvasTearDown());
    Hooks.on("refreshToken", token => this.#onRefreshToken(token));
    Hooks.on("deleteToken", document => this.#onDeleteToken(document));
    Hooks.on("sightRefresh", () => {
      this.#refreshContainerVisibility();
      this.#checkSpots();
    });
    Hooks.on("controlToken", () => this.#refreshContainerVisibility());
    Hooks.on("updateCombat", () => this.refresh());
    Hooks.on("deleteCombat", () => this.refresh());
    Hooks.on("updateWorldTime", () => this.refresh());
  }

  /* -------------------------------------------- */

  /**
   * Listen for sightings shared by other users. Called once the game is ready.
   */
  static activateSocket() {
    game.socket.on(SOCKET_NAME, message => {
      if ( message?.action === "sighting" ) this.#receiveSighting(message.data);
    });
  }

  /* -------------------------------------------- */
  /*  Public API                                  */
  /* -------------------------------------------- */

  /**
   * The sightings currently held for the active scene.
   * @returns {LastKnownData[]}
   */
  static getSightings() {
    return Array.from(this.#sightings.values(), s => foundry.utils.deepClone(s));
  }

  /* -------------------------------------------- */

  /**
   * Remove every marker on the current scene for this user.
   */
  static clear() {
    if ( !canvas.ready ) return;
    for ( const tokenId of Array.from(this.#sightings.keys()) ) this.#remove(tokenId);
    ui.notifications.info(game.i18n.localize(`${I18N}.Notifications.MarkersCleared`));
  }

  /* -------------------------------------------- */

  /**
   * Describe the rendered markers, for troubleshooting from the browser console.
   * @returns {object}
   */
  static debug() {
    const container = this.#container;
    return {
      armed: this.#armed,
      container: container ? {
        visible: container.visible,
        zIndex: container.zIndex,
        index: canvas.interface.children.indexOf(container),
        tokensLayerZIndex: canvas.tokens?.zIndex
      } : null,
      markers: Array.from(this.#markers.values(), marker => ({
        tokenId: marker.data.tokenId,
        direction: marker.data.direction,
        img: marker.data.img,
        alpha: marker.alpha,
        children: marker.children.map(c => `${c.constructor.name}${c.visible ? "" : " (hidden)"}`)
      }))
    };
  }

  /* -------------------------------------------- */

  /**
   * Prune expired sightings, then redraw markers and labels. Used when settings or time change.
   */
  static refresh() {
    if ( !canvas.ready || !this.#container ) return;
    const tracksAllies = getSetting(SETTINGS.LAST_KNOWN_ALLIES);
    for ( const sighting of Array.from(this.#sightings.values()) ) {
      if ( this.#isExpired(sighting) || (sighting.ally && !tracksAllies) ) this.#remove(sighting.tokenId);
    }
    for ( const marker of this.#markers.values() ) marker.destroy({children: true});
    this.#markers.clear();
    this.#cancelClearing();
    for ( const sighting of this.#sightings.values() ) this.#drawMarker(sighting);
    this.#refreshContainerVisibility();
    this.#checkSpots();
  }

  /* -------------------------------------------- */
  /*  Canvas Lifecycle                            */
  /* -------------------------------------------- */

  /**
   * Build the marker container and restore persisted sightings for the new scene.
   */
  static #onCanvasReady() {
    // Draw above the token layer. Each visible token erases its own footprint from everything
    // beneath the token layer in the interface group, which would cut holes in markers.
    this.#container = new PIXI.Container();
    this.#container.eventMode = "none";
    this.#container.zIndex = (canvas.tokens?.zIndex ?? 200) + 1;
    canvas.interface.addChild(this.#container);

    const stored = game.user.getFlag(MODULE_ID, FLAG_KEY)?.[canvas.scene.id] ?? [];
    for ( const sighting of stored ) {
      if ( !canvas.scene.tokens.has(sighting.tokenId) || this.#isExpired(sighting) ) continue;
      this.#sightings.set(sighting.tokenId, sighting);
    }
    this.refresh();

    // Seed visibility state once vision has settled, then start recording transitions.
    setTimeout(() => {
      if ( !canvas.ready ) return;
      for ( const token of canvas.tokens.placeables ) {
        this.#states.set(token.id, {visible: token.visible, center: getRenderedCenter(token), direction: null});
        if ( token.visible && this.#trackingKind(token) ) this.#remove(token.id);
      }
      this.#armed = true;
    }, ARM_DELAY_MS);
  }

  /* -------------------------------------------- */

  /**
   * Save pending changes and release canvas resources before the scene changes.
   */
  static #onCanvasTearDown() {
    this.#armed = false;
    if ( this.#dirty ) this.#persist();
    this.#container?.destroy({children: true});
    this.#container = null;
    this.#markers.clear();
    this.#sightings.clear();
    this.#states.clear();
    this.#cancelClearing();
    this.#spots.clear();
  }

  /* -------------------------------------------- */

  /**
   * Hide markers when the user is not looking through restricted token vision.
   */
  static #refreshContainerVisibility() {
    if ( !this.#container ) return;
    const showForGM = getSetting(SETTINGS.LAST_KNOWN_GM);
    this.#container.visible = getSetting(SETTINGS.LAST_KNOWN_ENABLED) && hasRestrictedVision()
      && (!game.user.isGM || showForGM);
  }

  /* -------------------------------------------- */
  /*  Tracking                                    */
  /* -------------------------------------------- */

  /**
   * Detect visibility transitions each time a token refreshes.
   * @param {foundry.canvas.placeables.Token} token
   */
  static #onRefreshToken(token) {
    if ( !this.#armed || token.isPreview ) return;
    const kind = this.#trackingKind(token);
    if ( !kind ) return;
    const state = this.#states.get(token.id) ?? {visible: false, center: null, direction: null};
    this.#states.set(token.id, state);

    if ( token.visible ) {
      const center = getRenderedCenter(token);
      if ( state.visible && state.center ) {
        const dx = center.x - state.center.x;
        const dy = center.y - state.center.y;
        if ( Math.hypot(dx, dy) >= HEADING_THRESHOLD ) state.direction = Math.atan2(dy, dx);
      }
      state.center = center;
      state.visible = true;
      if ( this.#sightings.has(token.id) ) this.#remove(token.id);
      return;
    }

    if ( !state.visible ) return;
    state.visible = false;

    // A token hidden by the GM was removed from play, not lost from sight.
    if ( token.document.hidden || !state.center ) return;
    const sighting = this.#createSighting(token, state, kind);
    this.#upsert(sighting);
    if ( getSetting(SETTINGS.LAST_KNOWN_SHARE) ) {
      game.socket.emit(SOCKET_NAME, {action: "sighting", data: sighting});
    }
  }

  /* -------------------------------------------- */

  /**
   * Remove all knowledge of a deleted token.
   * @param {foundry.documents.TokenDocument} document
   */
  static #onDeleteToken(document) {
    if ( document.parent?.id !== canvas.scene?.id ) return;
    this.#states.delete(document.id);
    if ( this.#sightings.has(document.id) ) this.#remove(document.id);
  }

  /* -------------------------------------------- */

  /**
   * Which kind of marker this token leaves when it disappears from view, if any.
   * Allies are player-owned or friendly tokens. Every other token is tracked by disposition.
   * @param {foundry.canvas.placeables.Token} token
   * @returns {MarkerKind|null}
   */
  static #trackingKind(token) {
    if ( !getSetting(SETTINGS.LAST_KNOWN_ENABLED) ) return null;
    if ( game.user.isGM ) {
      if ( !getSetting(SETTINGS.LAST_KNOWN_GM) || token.actor?.hasPlayerOwner ) return null;
    }
    else if ( token.isOwner ) return null;

    if ( isAlly(token) ) return getSetting(SETTINGS.LAST_KNOWN_ALLIES) ? "ally" : null;
    const D = CONST.TOKEN_DISPOSITIONS;
    const disposition = token.document.disposition;
    let tracked;
    switch ( getSetting(SETTINGS.LAST_KNOWN_DISPOSITIONS) ) {
      case "hostile": tracked = disposition === D.HOSTILE; break;
      case "hostileNeutral": tracked = (disposition === D.HOSTILE) || (disposition === D.NEUTRAL); break;
      case "all": tracked = true; break;
      default: tracked = false;
    }
    return tracked ? "enemy" : null;
  }

  /* -------------------------------------------- */

  /**
   * Build sighting data from a token's last visible state.
   * @param {foundry.canvas.placeables.Token} token
   * @param {{center: {x: number, y: number}, direction: number|null}} state
   * @param {MarkerKind} kind
   * @returns {LastKnownData}
   */
  static #createSighting(token, state, kind) {
    const combat = game.combat?.started ? {id: game.combat.id, round: game.combat.round} : null;
    return {
      tokenId: token.id,
      sceneId: canvas.scene.id,
      x: state.center.x,
      y: state.center.y,
      width: token.w,
      height: token.h,
      direction: state.direction,
      disposition: token.document.disposition,
      ally: kind === "ally",
      img: token.document.texture?.src ?? null,
      worldTime: game.time.worldTime,
      combat,
      seenAt: Date.now()
    };
  }

  /* -------------------------------------------- */
  /*  Sighting Storage                            */
  /* -------------------------------------------- */

  /**
   * Add or replace a sighting on the current scene.
   * @param {LastKnownData} sighting
   */
  static #upsert(sighting) {
    this.#sightings.set(sighting.tokenId, sighting);
    this.#markers.get(sighting.tokenId)?.destroy({children: true});
    this.#markers.delete(sighting.tokenId);
    this.#forgetSpot(sighting.tokenId);
    this.#drawMarker(sighting);
    this.#dirty = true;
    this.#persistSoon();
  }

  /* -------------------------------------------- */

  /**
   * Remove a sighting and its marker from the current scene.
   * @param {string} tokenId
   */
  static #remove(tokenId) {
    this.#sightings.delete(tokenId);
    this.#markers.get(tokenId)?.destroy({children: true});
    this.#markers.delete(tokenId);
    this.#forgetSpot(tokenId);
    this.#dirty = true;
    this.#persistSoon();
  }

  /* -------------------------------------------- */

  /**
   * Write the current scene's sightings to the user's flags.
   * Arrays replace wholesale on update, so removed sightings do not linger.
   * @returns {Promise<void>}
   */
  static async #persist() {
    // A debounced call can fire after the scene changed. Only save a live, modified scene.
    const sceneId = canvas.scene?.id;
    if ( !sceneId || !this.#dirty || !this.#container ) return;
    this.#dirty = false;
    await this.#writeScene(sceneId, Array.from(this.#sightings.values()));
  }

  /* -------------------------------------------- */

  /**
   * Store a list of sightings for one scene in the user's flags.
   * @param {string} sceneId
   * @param {LastKnownData[]} sightings
   * @returns {Promise<void>}
   */
  static async #writeScene(sceneId, sightings) {
    try {
      await game.user.update({[`flags.${MODULE_ID}.${FLAG_KEY}.${sceneId}`]: sightings});
    }
    catch(err) {
      console.error("Situational Awareness | Failed to save sightings", err);
    }
  }

  /* -------------------------------------------- */

  /**
   * Accept a sighting shared by another user.
   * Ignored if the token is visible here, or a newer sighting already exists.
   * @param {LastKnownData} sighting
   */
  static async #receiveSighting(sighting) {
    if ( !getSetting(SETTINGS.LAST_KNOWN_SHARE) || !sighting?.tokenId ) return;
    const isNewer = existing => !existing || (sighting.worldTime > existing.worldTime)
      || ((sighting.worldTime === existing.worldTime) && (sighting.seenAt >= existing.seenAt));

    // Sighting on the scene this user is viewing
    if ( canvas.ready && (sighting.sceneId === canvas.scene.id) ) {
      const token = canvas.tokens.get(sighting.tokenId);
      const kind = token && !token.visible ? this.#trackingKind(token) : null;
      if ( !kind ) return;
      if ( isNewer(this.#sightings.get(sighting.tokenId)) ) this.#upsert({...sighting, ally: kind === "ally"});
      return;
    }

    // Sighting on another scene: store it for later
    const stored = game.user.getFlag(MODULE_ID, FLAG_KEY)?.[sighting.sceneId] ?? [];
    const existing = stored.find(s => s.tokenId === sighting.tokenId);
    if ( !isNewer(existing) ) return;
    const updated = stored.filter(s => s.tokenId !== sighting.tokenId).concat([sighting]);
    await this.#writeScene(sighting.sceneId, updated);
  }

  /* -------------------------------------------- */
  /*  Clearing Empty Spots                        */
  /* -------------------------------------------- */

  /**
   * Fade out markers whose spot the user can see again while the token is not there.
   * A spot only counts as seen again after it has been out of sight since the marker appeared,
   * because a token usually vanishes from a spot which is still in view.
   */
  static #checkSpots() {
    if ( !this.#container || !this.#armed ) return;
    if ( !getSetting(SETTINGS.LAST_KNOWN_CLEAR) || !this.#container.visible ) {
      this.#cancelClearing();
      return;
    }
    const delay = getSetting(SETTINGS.LAST_KNOWN_CLEAR_DELAY) * 1000;
    for ( const [tokenId, marker] of this.#markers ) {
      let spot = this.#spots.get(tokenId);
      if ( !spot ) this.#spots.set(tokenId, spot = {away: false, timer: null, fading: false});
      if ( spot.fading ) continue;
      const {x, y, width, height} = marker.data;
      const visible = canvas.visibility.testVisibility({x, y}, {tolerance: Math.min(width, height) / 4});
      if ( !visible ) {
        spot.away = true;
        if ( spot.timer !== null ) clearTimeout(spot.timer);
        spot.timer = null;
      }
      else if ( spot.away && (spot.timer === null) ) {
        spot.timer = setTimeout(() => this.#fadeAndRemove(tokenId, marker), delay);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Fade a marker out, then remove its sighting unless something replaced it meanwhile.
   * @param {string} tokenId
   * @param {LastKnownMarker} marker
   * @returns {Promise<void>}
   */
  static async #fadeAndRemove(tokenId, marker) {
    const spot = this.#spots.get(tokenId);
    if ( !spot || (this.#markers.get(tokenId) !== marker) ) return;
    spot.timer = null;
    spot.fading = true;
    try {
      const completed = await marker.fadeOut(FADE_MS);
      if ( completed && (this.#markers.get(tokenId) === marker) ) this.#remove(tokenId);
    }
    catch(err) {
      console.error("Situational Awareness | Failed to fade marker", err);
    }
  }

  /* -------------------------------------------- */

  /**
   * Stop pending fades, keeping what is known about which spots were out of sight.
   * A fade already running finishes, unless its marker was destroyed to be redrawn.
   */
  static #cancelClearing() {
    for ( const [tokenId, spot] of this.#spots ) {
      if ( spot.timer !== null ) clearTimeout(spot.timer);
      spot.timer = null;
      const marker = this.#markers.get(tokenId);
      if ( spot.fading && (!marker || marker.destroyed) ) spot.fading = false;
    }
  }

  /* -------------------------------------------- */

  /**
   * Drop the clearing state of one marker.
   * @param {string} tokenId
   */
  static #forgetSpot(tokenId) {
    const spot = this.#spots.get(tokenId);
    if ( spot?.timer != null ) clearTimeout(spot.timer);
    this.#spots.delete(tokenId);
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Create and draw the marker for a sighting.
   * @param {LastKnownData} sighting
   */
  static #drawMarker(sighting) {
    if ( !this.#container ) return;
    const marker = this.#container.addChild(new LastKnownMarker(sighting));
    this.#markers.set(sighting.tokenId, marker);
    marker.draw(getMarkerStyle(sighting.ally ? "ally" : "enemy"))
      .catch(err => console.error("Situational Awareness | Failed to draw marker", err));
    marker.setAge(this.#ageInRounds(sighting));
  }

  /* -------------------------------------------- */

  /**
   * How many rounds ago a sighting happened. Uses the combat round counter when the same
   * combat is still running, otherwise converts elapsed world time into rounds.
   * @param {LastKnownData} sighting
   * @returns {number}
   */
  static #ageInRounds(sighting) {
    const combat = game.combat;
    if ( sighting.combat && combat?.started && (combat.id === sighting.combat.id) ) {
      return Math.max(0, combat.round - sighting.combat.round);
    }
    const roundTime = CONFIG.time?.roundTime || 6;
    return Math.max(0, Math.floor((game.time.worldTime - sighting.worldTime) / roundTime));
  }

  /* -------------------------------------------- */

  /**
   * Has this sighting outlived the configured lifetime?
   * @param {LastKnownData} sighting
   * @returns {boolean}
   */
  static #isExpired(sighting) {
    const lifetime = getSetting(SETTINGS.LAST_KNOWN_LIFETIME);
    return (lifetime > 0) && (this.#ageInRounds(sighting) >= lifetime);
  }
}
