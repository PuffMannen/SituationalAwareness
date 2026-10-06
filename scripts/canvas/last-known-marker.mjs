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
 * @property {string|null} img         Token texture path for the ghost image
 * @property {number} worldTime        game.time.worldTime at the sighting
 * @property {{id: string, round: number}|null} combat   Active combat at the sighting
 * @property {number} seenAt           Real-world timestamp of the sighting
 */

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
   * The elapsed-time label.
   * @type {PIXI.Text|null}
   */
  #label = null;

  /* -------------------------------------------- */

  /**
   * Draw (or redraw) the marker.
   * @param {object} options
   * @param {boolean} options.showGhost   Render a faded copy of the token image
   * @returns {Promise<this>}
   */
  async draw({showGhost}) {
    for ( const child of this.removeChildren() ) child.destroy({children: true});
    this.#label = null;

    const {x, y, width, height, direction} = this.data;
    const gridSize = canvas.dimensions.size;
    const radius = Math.max(width, height) / 2;
    const color = LastKnownMarker.#colorFor(this.data.disposition);
    this.position.set(x, y);

    // Frame and heading
    const frame = this.addChild(new PIXI.Graphics());
    const lineWidth = Math.max(2, Math.round(gridSize * 0.04));
    LastKnownMarker.#drawDashedCircle(frame, radius, lineWidth, color);
    if ( Number.isFinite(direction) ) LastKnownMarker.#drawHeading(frame, radius, direction, color);

    // Elapsed time label
    const TextClass = foundry.canvas.containers?.PreciseText ?? PIXI.Text;
    const style = TextClass.getTextStyle?.({fontSize: Math.max(12, Math.round(gridSize * 0.2))})
      ?? {fontSize: Math.max(12, Math.round(gridSize * 0.2)), fill: 0xFFFFFF};
    this.#label = this.addChild(new TextClass("", style));
    this.#label.anchor.set(0.5, 0);
    this.#label.position.set(0, radius + lineWidth + 2);

    // Ghost image, loaded last so a slow texture never delays the frame
    if ( showGhost && this.data.img && !VIDEO_EXTENSIONS.test(this.data.img) ) {
      const loader = foundry.canvas.loadTexture ?? globalThis.loadTexture;
      try {
        const texture = await loader(this.data.img);
        if ( this.destroyed || !texture ) return this;
        const ghost = new PIXI.Sprite(texture);
        ghost.anchor.set(0.5);
        ghost.width = width;
        ghost.height = height;
        ghost.alpha = 0.35;
        const ColorMatrix = PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;
        if ( ColorMatrix ) {
          const filter = new ColorMatrix();
          filter.desaturate();
          ghost.filters = [filter];
        }
        this.addChildAt(ghost, 0);
      }
      catch(err) {
        console.debug("Situational Awareness | Ghost image unavailable", err);
      }
    }
    return this;
  }

  /* -------------------------------------------- */

  /**
   * Update the elapsed-time label.
   * @param {string} text
   */
  setLabel(text) {
    if ( this.#label && !this.#label.destroyed ) this.#label.text = text;
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
    g.lineStyle();
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
    g.lineStyle();
  }
}
