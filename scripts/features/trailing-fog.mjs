import { MAX_TEXTURE_SIZE } from "../constants.mjs";
import { SETTINGS, getSetting } from "../settings.mjs";
import { getObservers, getRenderedCenter, hasRestrictedVision } from "../helpers/observers.mjs";

/**
 * Size in pixels of the generated radial gradient texture.
 * @type {number}
 */
const GRADIENT_SIZE = 256;

/**
 * Trailing fog: explored areas fade back into fog the further they are from the user's tokens.
 * Areas within the trail distance stay clear and anything in current line of sight is never
 * covered. This is a visual overlay only. Stored fog exploration data is never modified.
 */
export class TrailingFog {

  /**
   * The overlay sprite shown on the canvas.
   * @type {PIXI.Sprite|null}
   */
  static #sprite = null;

  /**
   * The texture the overlay mask is rendered into.
   * @type {PIXI.RenderTexture|null}
   */
  static #renderTexture = null;

  /**
   * Radial gradient used to clear the area around each observer.
   * @type {PIXI.Texture|null}
   */
  static #gradient = null;

  /**
   * Scene graph rendered into the texture each update.
   * @type {{root: PIXI.Container, fill: PIXI.Graphics, holes: PIXI.Container, erase: PIXI.Graphics}|null}
   */
  static #stage = null;

  /**
   * Texture pixels per canvas pixel.
   * @type {number}
   */
  static #resolution = 1;

  /**
   * Whether a render is already queued for the next animation frame.
   * @type {boolean}
   */
  static #queued = false;

  /* -------------------------------------------- */

  /**
   * Register hooks used by this feature.
   */
  static registerHooks() {
    Hooks.on("canvasReady", () => this.#create());
    Hooks.on("canvasTearDown", () => this.#destroy());
    Hooks.on("sightRefresh", () => this.render());
    Hooks.on("controlToken", () => this.render());
  }

  /* -------------------------------------------- */

  /**
   * Queue a redraw of the overlay. Multiple calls in one frame collapse into a single render.
   */
  static render() {
    if ( this.#queued || !this.#sprite ) return;
    this.#queued = true;
    requestAnimationFrame(() => {
      this.#queued = false;
      this.#render();
    });
  }

  /* -------------------------------------------- */

  /**
   * Rebuild textures after a setting changed that affects their shape or size.
   */
  static rebuild() {
    if ( !canvas.ready ) return;
    this.#destroy();
    this.#create();
  }

  /* -------------------------------------------- */

  /**
   * Allocate the overlay for the current scene.
   */
  static #create() {
    const rect = canvas.dimensions.rect;
    const requested = getSetting(SETTINGS.TRAIL_RESOLUTION);
    this.#resolution = Math.min(requested, MAX_TEXTURE_SIZE / rect.width, MAX_TEXTURE_SIZE / rect.height);

    this.#renderTexture = PIXI.RenderTexture.create({
      width: Math.ceil(rect.width * this.#resolution),
      height: Math.ceil(rect.height * this.#resolution)
    });
    this.#gradient = this.#createGradient();

    // Drawn in world coordinates, then scaled and offset into texture space.
    const root = new PIXI.Container();
    const world = root.addChild(new PIXI.Container());
    root.scale.set(this.#resolution);
    world.position.set(-rect.x, -rect.y);
    const fill = world.addChild(new PIXI.Graphics());
    const holes = world.addChild(new PIXI.Container());
    const erase = world.addChild(new PIXI.Graphics());
    erase.blendMode = PIXI.BLEND_MODES.ERASE;
    this.#stage = {root, fill, holes, erase};

    const sprite = new PIXI.Sprite(this.#renderTexture);
    sprite.position.set(rect.x, rect.y);
    sprite.scale.set(1 / this.#resolution);
    sprite.eventMode = "none";
    sprite.visible = false;
    this.#sprite = sprite;

    // Lowest in the interface group: above the fog of war, below token UI and markers.
    canvas.interface.addChildAt(sprite, 0);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Release all resources held by the overlay.
   */
  static #destroy() {
    this.#sprite?.destroy();
    this.#stage?.root.destroy({children: true});
    this.#renderTexture?.destroy(true);
    this.#gradient?.destroy(true);
    this.#sprite = this.#stage = this.#renderTexture = this.#gradient = null;
  }

  /* -------------------------------------------- */

  /**
   * Generate a radial gradient that is opaque out to the trail start and fades to transparent
   * at the end of the trail. Drawn with ERASE blending, it clears the overlay around a token.
   * @returns {PIXI.Texture}
   */
  static #createGradient() {
    const start = getSetting(SETTINGS.TRAIL_START);
    const length = getSetting(SETTINGS.TRAIL_LENGTH);
    const inner = length > 0 ? Math.min(start / (start + length), 1) : 1;

    const element = document.createElement("canvas");
    element.width = element.height = GRADIENT_SIZE;
    const ctx = element.getContext("2d");
    const half = GRADIENT_SIZE / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(inner, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GRADIENT_SIZE, GRADIENT_SIZE);
    return PIXI.Texture.from(element);
  }

  /* -------------------------------------------- */

  /**
   * Render the overlay mask for the current observers and vision.
   */
  static #render() {
    if ( !this.#sprite || !canvas.ready ) return;
    const observers = getObservers();
    const active = getSetting(SETTINGS.TRAIL_ENABLED) && hasRestrictedVision() && (observers.length > 0);
    this.#sprite.visible = active;
    if ( !active ) return;

    const {fill, holes, erase, root} = this.#stage;
    const rect = canvas.dimensions.rect;
    const outerRadius = (getSetting(SETTINGS.TRAIL_START) + getSetting(SETTINGS.TRAIL_LENGTH))
      * canvas.dimensions.size;

    // Start fully covered
    fill.clear().beginFill(0xFFFFFF, 1).drawRect(rect.x, rect.y, rect.width, rect.height).endFill();

    // Fade out around each observer
    while ( holes.children.length < observers.length ) {
      const hole = holes.addChild(new PIXI.Sprite(this.#gradient));
      hole.anchor.set(0.5);
      hole.blendMode = PIXI.BLEND_MODES.ERASE;
    }
    holes.children.forEach((hole, i) => {
      const observer = observers[i];
      hole.visible = !!observer;
      if ( !observer ) return;
      const center = getRenderedCenter(observer);
      hole.position.set(center.x, center.y);
      hole.width = hole.height = outerRadius * 2;
    });

    // Never cover what is in line of sight right now, or tokens the user can see
    erase.clear().beginFill(0xFFFFFF, 1);
    for ( const source of canvas.effects.visionSources ) {
      if ( source.active && source.los ) erase.drawShape(source.los);
    }
    for ( const token of canvas.tokens.placeables ) {
      if ( token.visible ) erase.drawRect(token.x, token.y, token.w, token.h);
    }
    erase.endFill();

    canvas.app.renderer.render(root, {renderTexture: this.#renderTexture, clear: true});

    this.#sprite.tint = this.#fogColor();
    this.#sprite.alpha = getSetting(SETTINGS.TRAIL_STRENGTH);
  }

  /* -------------------------------------------- */

  /**
   * The scene's unexplored fog color, so faded areas blend with genuinely unexplored ones.
   * @returns {number}
   */
  static #fogColor() {
    const color = canvas.colors?.fogUnexplored ?? CONFIG.Canvas.unexploredColor ?? 0x000000;
    return Number(color);
  }
}
