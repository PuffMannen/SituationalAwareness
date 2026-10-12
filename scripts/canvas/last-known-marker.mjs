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
 * @property {boolean} [ally]          Whether the token was an ally, which selects the ally marker style
 * @property {string|null} img         Token texture path, used when the style shows the token image
 * @property {number} worldTime        game.time.worldTime at the sighting
 * @property {{id: string, round: number}|null} combat   Active combat at the sighting
 * @property {number} seenAt           Real-world timestamp of the sighting
 */

import { I18N, MODULE_ID } from "../constants.mjs";

/** File extensions which load as video textures and are skipped for ghost images. */
const VIDEO_EXTENSIONS = /\.(webm|mp4|m4v|ogv|ogg)(\?.*)?$/i;

/**
 * One stroke of a marker shape: a circle, or a polyline which may be closed.
 * @typedef {{radius: number}|{points: number[], closed: boolean}} ShapeStroke
 */

/**
 * The geometry of a marker shape, centered on the origin.
 * @typedef ShapeGeometry
 * @property {ShapeStroke} fill        The area filled when the style has a fill
 * @property {ShapeStroke[]} strokes   Lines drawn with the outline style. The first is the outer outline
 * @property {number[]} dots           Radii of solid dots at the center
 */

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
   * The image, shape and glow. Scaled by the pulsing size animation.
   * @type {PIXI.Container|null}
   */
  #body = null;

  /**
   * The shape graphic. Turned by the rotation animation.
   * @type {PIXI.Graphics|null}
   */
  #shape = null;

  /**
   * A blurred copy of the shape outline, used by the pulsing glow animation.
   * @type {PIXI.Graphics|null}
   */
  #glow = null;

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

  /**
   * Whether the animation is attached to the canvas ticker.
   * @type {boolean}
   */
  #animating = false;

  /* -------------------------------------------- */

  /**
   * Draw (or redraw) the marker.
   * @param {import("../data/marker-style.mjs").MarkerStyle} style   The GM-configured marker style
   * @returns {Promise<this>}
   */
  async draw(style) {
    this.#stopAnimation();
    for ( const child of this.removeChildren() ) child.destroy({children: true});
    this.#label = this.#glow = null;
    this.#style = style;

    const {x, y, width, height, direction} = this.data;
    const gridSize = canvas.dimensions.size;
    const scale = style.scale;
    const radius = (Math.max(width, height) / 2) * scale;
    const color = style.colorMode === "custom"
      ? Number(foundry.utils.Color.from(style.color))
      : LastKnownMarker.#colorFor(this.data.disposition);
    const lineWidth = Math.max(1, Math.round(gridSize * style.ringWidth));
    const geometry = LastKnownMarker.#geometry(style.shape, radius);
    this.position.set(x, y);
    this.alpha = style.opacity;

    // Body: image, glow and shape
    this.#body = this.addChild(new PIXI.Container());
    if ( style.animation === "pulseGlow" ) {
      this.#glow = this.#body.addChild(LastKnownMarker.#drawGlow(geometry, lineWidth, color, gridSize));
    }
    this.#shape = this.#body.addChild(new PIXI.Graphics());
    LastKnownMarker.#drawShape(this.#shape, geometry, style, lineWidth, color);

    // Heading
    if ( style.showHeading && Number.isFinite(direction) ) {
      const heading = this.addChild(new PIXI.Graphics());
      if ( style.headingStyle === "large" ) LastKnownMarker.#drawLargeArrow(heading, radius, direction, color);
      else LastKnownMarker.#drawHeading(heading, radius, direction, color);
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

    if ( style.animation !== "none" ) this.#startAnimation();

    // Image, loaded last so a slow texture never delays the outline
    const src = {ghost: this.data.img, custom: style.imagePath}[style.image];
    if ( src && !VIDEO_EXTENSIONS.test(src) ) await this.#drawImage(src, width * scale, height * scale, style);
    return this;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  destroy(options) {
    this.#stopAnimation();
    foundry.canvas.animation.CanvasAnimation.terminateAnimation(this.#fadeName);
    super.destroy(options);
  }

  /* -------------------------------------------- */

  /**
   * The name of this marker's fade animation.
   * @type {string}
   */
  get #fadeName() {
    return `${MODULE_ID}.fade.${this.data.tokenId}`;
  }

  /* -------------------------------------------- */

  /**
   * Fade the marker out. Any looping animation stops first.
   * @param {number} duration    Length of the fade in milliseconds
   * @returns {Promise<boolean>} True once the fade completes, false if it was cut short
   */
  async fadeOut(duration) {
    this.#stopAnimation();
    return foundry.canvas.animation.CanvasAnimation.animate([{parent: this, attribute: "alpha", to: 0}], {
      context: this, duration, name: this.#fadeName
    });
  }

  /* -------------------------------------------- */

  /**
   * Load and add the marker image beneath the shape.
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
      if ( this.destroyed || !this.#body || !texture || (this.#style !== style) ) return;
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
      this.#body.addChildAt(sprite, 0);
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
  /*  Animation                                   */
  /* -------------------------------------------- */

  /**
   * Attach the animation to the canvas ticker.
   */
  #startAnimation() {
    const ticker = canvas.app?.ticker;
    if ( !ticker || this.#animating ) return;
    ticker.add(this.#animate, this);
    this.#animating = true;
    this.#animate();
  }

  /* -------------------------------------------- */

  /**
   * Detach the animation from the canvas ticker.
   */
  #stopAnimation() {
    if ( !this.#animating ) return;
    canvas.app?.ticker?.remove(this.#animate, this);
    this.#animating = false;
  }

  /* -------------------------------------------- */

  /**
   * Advance the animation. All markers share the clock, so they pulse in step.
   */
  #animate() {
    const style = this.#style;
    if ( !style || this.destroyed || !this.#body ) return;
    const cycle = (performance.now() / 1000 / style.animationSpeed) % 1;
    const wave = (1 - Math.cos(cycle * Math.PI * 2)) / 2;
    switch ( style.animation ) {
      case "pulseFade":
        this.alpha = style.opacity * (1 - (0.65 * wave));
        break;
      case "pulseSize":
        this.#body.scale.set(1 + (0.15 * wave));
        break;
      case "pulseGlow":
        if ( this.#glow ) this.#glow.alpha = 0.2 + (0.8 * wave);
        break;
      case "rotate":
        this.#shape.rotation = cycle * Math.PI * 2;
        break;
    }
  }

  /* -------------------------------------------- */
  /*  Drawing                                     */
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
   * The geometry of a marker shape.
   * @param {import("../data/marker-style.mjs").MarkerShape} shape
   * @param {number} r     Radius of the marker
   * @returns {ShapeGeometry}
   */
  static #geometry(shape, r) {
    const polygon = (sides, radius, start) => {
      const points = [];
      for ( let i = 0; i < sides; i++ ) {
        const a = start + ((i / sides) * Math.PI * 2);
        points.push(Math.cos(a) * radius, Math.sin(a) * radius);
      }
      return {points, closed: true};
    };
    const up = -Math.PI / 2;
    const circle = {radius: r};
    switch ( shape ) {
      case "square": {
        const s = r * 0.85;
        const square = {points: [-s, -s, s, -s, s, s, -s, s], closed: true};
        return {fill: square, strokes: [square], dots: []};
      }
      case "diamond": {
        const diamond = polygon(4, r, up);
        return {fill: diamond, strokes: [diamond], dots: []};
      }
      case "triangle": {
        const triangle = polygon(3, r, up);
        return {fill: triangle, strokes: [triangle], dots: []};
      }
      case "hexagon": {
        const hexagon = polygon(6, r, 0);
        return {fill: hexagon, strokes: [hexagon], dots: []};
      }
      case "star": {
        const points = [];
        for ( let i = 0; i < 10; i++ ) {
          const a = up + ((i / 10) * Math.PI * 2);
          const radius = (i % 2) ? r * 0.45 : r;
          points.push(Math.cos(a) * radius, Math.sin(a) * radius);
        }
        const star = {points, closed: true};
        return {fill: star, strokes: [star], dots: []};
      }
      case "pentagram": {
        const {points: p} = polygon(5, r * 0.95, up);
        const order = [0, 2, 4, 1, 3].flatMap(i => [p[i * 2], p[(i * 2) + 1]]);
        return {fill: circle, strokes: [circle, {points: order, closed: true}], dots: []};
      }
      case "crosshair": {
        const ring = {radius: r * 0.65};
        const inner = r * 0.3;
        const ticks = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => ({
          points: [dx * inner, dy * inner, dx * r, dy * r], closed: false
        }));
        return {fill: ring, strokes: [ring, ...ticks], dots: []};
      }
      case "bullseye":
        return {fill: circle, strokes: [circle, {radius: r * 0.55}], dots: [r * 0.15]};
      default:
        return {fill: circle, strokes: [circle], dots: []};
    }
  }

  /* -------------------------------------------- */

  /**
   * Draw a shape's fill, outline and dots.
   * @param {PIXI.Graphics} g
   * @param {ShapeGeometry} geometry
   * @param {import("../data/marker-style.mjs").MarkerStyle} style
   * @param {number} lineWidth
   * @param {number} color
   */
  static #drawShape(g, geometry, style, lineWidth, color) {
    if ( style.fillOpacity > 0 ) {
      g.lineStyle({width: 0});
      g.beginFill(color, style.fillOpacity);
      LastKnownMarker.#traceStroke(g, geometry.fill);
      g.endFill();
    }
    if ( style.ring !== "none" ) {
      g.lineStyle({width: lineWidth, color, alpha: 0.9});
      // A dashed style dashes the outer outline only. Inner details stay solid to remain legible.
      for ( const [i, stroke] of geometry.strokes.entries() ) {
        if ( (style.ring === "dashed") && (i === 0) ) LastKnownMarker.#traceDashed(g, stroke);
        else LastKnownMarker.#traceStroke(g, stroke);
      }
      g.lineStyle({width: 0});
    }
    for ( const radius of geometry.dots ) {
      g.beginFill(color, 0.9);
      g.drawCircle(0, 0, radius);
      g.endFill();
    }
  }

  /* -------------------------------------------- */

  /**
   * Draw a soft, blurred copy of a shape's outline.
   * @param {ShapeGeometry} geometry
   * @param {number} lineWidth
   * @param {number} color
   * @param {number} gridSize
   * @returns {PIXI.Graphics}
   */
  static #drawGlow(geometry, lineWidth, color, gridSize) {
    const g = new PIXI.Graphics();
    g.lineStyle({width: lineWidth * 3, color, alpha: 1});
    for ( const stroke of geometry.strokes ) LastKnownMarker.#traceStroke(g, stroke);
    g.lineStyle({width: 0});
    const Blur = PIXI.BlurFilter ?? PIXI.filters?.BlurFilter;
    if ( Blur ) g.filters = [new Blur(Math.max(4, gridSize * 0.08))];
    return g;
  }

  /* -------------------------------------------- */

  /**
   * Trace a stroke with the current line and fill style.
   * @param {PIXI.Graphics} g
   * @param {ShapeStroke} stroke
   */
  static #traceStroke(g, stroke) {
    if ( "radius" in stroke ) {
      g.drawCircle(0, 0, stroke.radius);
      return;
    }
    if ( stroke.closed ) {
      g.drawPolygon(stroke.points);
      return;
    }
    const p = stroke.points;
    g.moveTo(p[0], p[1]);
    for ( let i = 2; i < p.length; i += 2 ) g.lineTo(p[i], p[i + 1]);
  }

  /* -------------------------------------------- */

  /**
   * Trace a stroke as a dashed line with the current line style.
   * Circles get sixteen dashes. Polylines get dashes of the same length.
   * @param {PIXI.Graphics} g
   * @param {ShapeStroke} stroke
   */
  static #traceDashed(g, stroke) {
    const dashes = 16;
    const duty = 0.55;
    if ( "radius" in stroke ) {
      const step = (Math.PI * 2) / dashes;
      for ( let i = 0; i < dashes; i++ ) {
        const start = i * step;
        g.moveTo(Math.cos(start) * stroke.radius, Math.sin(start) * stroke.radius);
        g.arc(0, 0, stroke.radius, start, start + (step * duty));
      }
      return;
    }

    // Cumulative length at each vertex of the polyline
    const p = stroke.points.slice();
    if ( stroke.closed ) p.push(p[0], p[1]);
    const lengths = [0];
    for ( let i = 2; i < p.length; i += 2 ) {
      lengths.push(lengths.at(-1) + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
    }
    const total = lengths.at(-1);
    if ( !(total > 0) ) return;
    const pointAt = distance => {
      let i = 1;
      while ( (i < lengths.length - 1) && (lengths[i] < distance) ) i++;
      const span = lengths[i] - lengths[i - 1];
      const t = span > 0 ? (distance - lengths[i - 1]) / span : 0;
      const j = (i - 1) * 2;
      return [p[j] + ((p[j + 2] - p[j]) * t), p[j + 1] + ((p[j + 3] - p[j + 1]) * t)];
    };

    // A fixed number of dashes, each following the polyline around its corners
    const count = stroke.closed ? dashes : Math.max(1, Math.round(total / 12));
    const period = total / count;
    for ( let k = 0; k < count; k++ ) {
      const start = k * period;
      const end = start + (period * duty);
      g.moveTo(...pointAt(start));
      for ( let i = 1; i < lengths.length - 1; i++ ) {
        if ( (lengths[i] > start) && (lengths[i] < end) ) g.lineTo(p[i * 2], p[(i * 2) + 1]);
      }
      g.lineTo(...pointAt(end));
    }
  }

  /* -------------------------------------------- */

  /**
   * Draw an arrowhead on the marker edge pointing along the heading.
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

  /* -------------------------------------------- */

  /**
   * Draw a large arrow through the marker center pointing along the heading.
   * @param {PIXI.Graphics} g
   * @param {number} radius
   * @param {number} direction   Angle in radians
   * @param {number} color
   */
  static #drawLargeArrow(g, radius, direction, color) {
    const shaft = radius * 0.14;
    const head = radius * 0.4;
    const tail = -radius * 0.6;
    const neck = radius * 0.4;
    const tip = radius * 1.15;
    g.beginFill(color, 0.85);
    g.lineStyle({width: Math.max(1, radius * 0.03), color: 0x000000, alpha: 0.6});
    g.drawPolygon([
      tail, -shaft, neck, -shaft, neck, -head, tip, 0, neck, head, neck, shaft, tail, shaft
    ]);
    g.endFill();
    g.lineStyle({width: 0});
    g.rotation = direction;
  }
}
