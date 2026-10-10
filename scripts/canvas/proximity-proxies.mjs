import { ProximityAwareness } from "../features/proximity-awareness.mjs";

/**
 * Draws tokens that are visible only through proximity awareness above the fog of war.
 *
 * Core renders token images in the primary canvas group, which the fog of war covers. A token
 * revealed by proximity in an unexplored area is therefore marked visible, so its border and
 * controls work, yet its image stays hidden under the fog. Each such token gets a sprite in the
 * interface group that mirrors its image, kept in sync on every token refresh.
 */
export class ProximityProxies {

  /**
   * Parent container for proxy sprites.
   * @type {PIXI.Container|null}
   */
  static #container = null;

  /**
   * Proxy sprites keyed by the token they mirror.
   * @type {Map<foundry.canvas.placeables.Token, PIXI.Sprite>}
   */
  static #proxies = new Map();

  /* -------------------------------------------- */

  /**
   * Register hooks used by this feature.
   * Register before the trailing fog so its overlay ends up beneath the proxies.
   */
  static registerHooks() {
    Hooks.on("canvasReady", () => this.#onCanvasReady());
    Hooks.on("canvasTearDown", () => this.#onCanvasTearDown());
    Hooks.on("refreshToken", token => this.sync(token));
    Hooks.on("destroyToken", token => this.#remove(token));
  }

  /* -------------------------------------------- */

  /**
   * Create, update or remove the proxy for one token.
   * @param {foundry.canvas.placeables.Token} token
   */
  static sync(token) {
    if ( !this.#container ) return;
    const mesh = token.mesh;
    const show = token.visible && !token.isPreview && ProximityAwareness.isProximityOnly(token)
      && mesh && !mesh.destroyed && mesh.texture;
    if ( !show ) {
      this.#remove(token);
      return;
    }

    let sprite = this.#proxies.get(token);
    if ( !sprite ) {
      sprite = this.#container.addChild(new PIXI.Sprite());
      sprite.eventMode = "none";
      this.#proxies.set(token, sprite);
    }

    // Mirror the image and transform of the token mesh, including animation and mirroring
    sprite.texture = mesh.texture;
    sprite.anchor.copyFrom(mesh.anchor);
    sprite.position.copyFrom(mesh.position);
    sprite.scale.copyFrom(mesh.scale);
    sprite.rotation = mesh.rotation;
    sprite.alpha = mesh.alpha;
    sprite.tint = mesh.tint;
  }

  /* -------------------------------------------- */

  /**
   * Create the proxy container for the new scene.
   * Placed lowest in the interface group: above the fog, below token borders, bars and names.
   */
  static #onCanvasReady() {
    this.#container = new PIXI.Container();
    this.#container.eventMode = "none";
    canvas.interface.addChildAt(this.#container, 0);
    for ( const token of canvas.tokens.placeables ) this.sync(token);
  }

  /* -------------------------------------------- */

  /**
   * Release all proxies when the scene is torn down.
   */
  static #onCanvasTearDown() {
    this.#container?.destroy({children: true});
    this.#container = null;
    this.#proxies.clear();
  }

  /* -------------------------------------------- */

  /**
   * Remove the proxy for a token, if it has one. The shared texture is not destroyed.
   * @param {foundry.canvas.placeables.Token} token
   */
  static #remove(token) {
    const sprite = this.#proxies.get(token);
    if ( !sprite ) return;
    this.#proxies.delete(token);
    sprite.destroy();
  }
}
