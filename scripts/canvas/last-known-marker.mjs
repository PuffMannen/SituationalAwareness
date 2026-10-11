/**
 * @typedef LastKnownData
 * @property {string} tokenId          The id of the token that was sighted
 * @property {string} sceneId          The scene the sighting happened in
 * @property {number} x                Rendered center x-coordinate when last seen
 * @property {number} y                Rendered center y-coordinate when last seen
 * @property {number} width            Token width in pixels
 * @property {number} height           Token height in pixels
 * @property {number|null} direction   Heading of travel in radians, or null if never seen moving
 * @property {number} disposition      The token disposition, used for the marker color
 * @property {string|null} img         Token texture path, used when the style shows the token image
 * @property {number} worldTime        game.time.worldTime at the sighting
 * @property {{id: string, round: number}|null} combat   Active combat at the sighting
 * @property {number} seenAt           Real-world timestamp of the sighting
 */

import { I18N } from "../constants.mjs";

/** File extensions which load as video textures and are skipped for ghost images. */
const VIDEO_EXTENSIONS = /\.(webm|mp4|m4v|ogv|ogg)(\?.*)?$/i;

/**
 * A canvas marker showing where a token was last seen and which way it was heading.
 */
export class LastKnownMarker extends PIXI.Container {
  /**
   * @param {LastKnownData} data
   */
  constructor(data) {
    super();
    this.data = data;
    this.eventMode = "none";
  }

  /**
   * The sighting this marker represents.
   * @type {LastKnownData}
   */
  data;

  /**
   * The text label, if the style shows one.
   * @type {PIXI.Text|null}
   */
  #label = null;

  /**
   * The style the marker was last drawn with.
   * @type {import("../data/marker-style.mjs").MarkerStyle|null}
   */
  #style = null;

  /* -------------------------------------------- */

  /**
   * Draw (or redraw) the marker.
   * @param {import("../data/marker-style.mjs").MarkerStyle} style   The GM-configured marker style
   * @returns {Promise<this>}
   */
  async draw(style) {
    for ( const child of this.removeChildren() ) child.destroy({children: true});
    this.#label = null;
    this.#style = style;

    const {x, y, width, height, direction} = this.data;
    const gridSize = canvas.dimensions.size;
    const scale = style.scale;
    const radius = (Math.max(width, height) / 2) * scale;
    const color = style.colorMode === "custom"
      ? Number(foundry.utils.Color.from(style.color))
      : LastKnownMarker.#colorFor(this.data.disposition);
    this.position.set(x, y);
    this.alpha = style.opacity;

    // Outline and heading
    const frame = this.addChild(new PIXI.Graphics());
    const lineWidth = Math.max(1, Math.round(gridSize * style.ringWidth));
    if ( style.ring === "dashed" ) LastKnownMarker.#drawDashedCircle(frame, radius, lineWidth, color);
    else if ( style.ring === "solid" ) frame.lineStyle({width: lineWidth, color, alpha: 0.9}).drawCircle(0, 0, radius);
    frame.lineStyle({width: 0});
    if ( style.showHeading && Number.isFinite(direction) ) {
      LastKnownMarker.#drawHeading(frame, radius, direction, color);
    }

    // Label
    if ( style.label !== "none" ) {
      const fontSize = Math.max(12, Math.round(gridSize * 0.2 * scale));
      const TextClass = foundry.canvas.containers?.PreciseText ?? PIXI.Text;
      const textStyle = TextClass.getTextStyle?.({fontSize}) ?? {fontSize, fill: 0xFFFFFF};
      this.#label = this.addChild(new TextClass("", textStyle));
      this.#label.anchor.set(0.5, 0);
      this.#label.position.set(0, radius + lineWidth + 2);
    }

    // Image, loaded last so a slow texture never delays the outline
    const src = {ghost: this.data.img, custom: style.imagePath}[style.image];
    if ( src && !VIDEO_EXTENSIONS.test(src) ) await this.#drawImage(src, width * scale, height * scale, style);
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Load and add the marker image beneath the outline.
   * @param {string} src
   * @param {number} width
   * @param {number} height
   * @param {import("../data/marker-style.mjs").MarkerStyle} style
   * @returns {Promise<void>}
   */
  async #drawImage(src, width, height, style) {
    const loader = foundry.canvas.loadTexture ?? globalThis.loadTexture;
    try {
      const texture = await loader(src);
      if ( this.destroyed || !texture || (this.#style !== style) ) return;
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);

      // Fit inside the token footprint while keeping the image's aspect ratio
      const fit = Math.min(width / texture.width, height / texture.height);
      sprite.scale.set(fit);
      sprite.alpha = style.imageOpacity;
      const ColorMatrix = PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;
      if ( style.desaturate && ColorMatrix ) {
        const filter = new ColorMatrix();
        filter.desaturate();
        sprite.filters = [filter];
      }
      this.addChildAt(sprite, 0);
    }
    catch(err) {
      console.debug("Situational Awareness | Marker image unavailable", err);
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the label for the sighting's age.
   * @param {number} rounds   How many rounds ago the token was seen
   */
  setAge(rounds) {
    if ( !this.#label || this.#label.destroyed ) return;
    if ( this.#style.label === "custom" ) {
      this.#label.text = this.#style.labelText.replaceAll("{rounds}", String(rounds));
      return;
    }
    if ( rounds < 1 ) this.#label.text = game.i18n.localize(`${I18N}.Marker.JustNow`);
    else this.#label.text = game.i18n.format(`${I18N}.Marker.${rounds === 1 ? "RoundAgo" : "RoundsAgo"}`, {rounds});
  }

  /* -------------------------------------------- */

  /**
   * Choose a marker color from the core disposition palette.
   * @param {number} disposition
   * @returns {number}
   */
  static #colorFor(disposition) {
    const D = CONST.TOKEN_DISPOSITIONS;
    const colors = CONFIG.Canvas.dispositionColors ?? {};
    const pick = {
      [D.HOSTILE]: colors.HOSTILE ?? 0xE72124,
      [D.NEUTRAL]: colors.NEUTRAL ?? 0xF1D836,
      [D.FRIENDLY]: colors.FRIENDLY ?? 0x43DFDF,
      [D.SECRET]: colors.SECRET ?? 0xA612D4
    }[disposition] ?? 0xFFFFFF;
    return Number(pick);
  }

  /* -------------------------------------------- */

  /**
   * Draw a dashed circle around the origin.
   * @param {PIXI.Graphics} g
   * @param {number} radius
   * @param {number} width
   * @param {number} color
   */
  static #drawDashedCircle(g, radius, width, color) {
    const dashes = 16;
    const step = (Math.PI * 2) / dashes;
    g.lineStyle({width, color, alpha: 0.9});
    for ( let i = 0; i < dashes; i++ ) {
      const start = i * step;
      g.moveTo(Math.cos(start) * radius, Math.sin(start) * radius);
      g.arc(0, 0, radius, start, start + (step * 0.55));
    }
    g.lineStyle({width: 0});
  }

  /* -------------------------------------------- */

  /**
   * Draw an arrowhead on the circle edge pointing along the heading.
   * @param {PIXI.Graphics} g
   * @param {number} radius
   * @param {number} direction   Angle in radians
   * @param {number} color
   */
  static #drawHeading(g, radius, direction, color) {
    const size = Math.max(8, radius * 0.35);
    const base = radius + 2;
    const tip = base + size;
    const spread = 0.35;
    const point = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
    g.beginFill(color, 0.9);
    g.lineStyle({width: 1, color: 0x000000, alpha: 0.6});
    g.drawPolygon([
      ...point(tip, direction),
      ...point(base, direction - spread),
      ...point(base, direction + spread)
    ]);
    g.endFill();
    g.lineStyle({width: 0});
  }
}
