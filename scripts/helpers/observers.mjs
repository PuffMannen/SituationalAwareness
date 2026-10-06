/**
 * Shared helpers for reasoning about which tokens the current user "is" on the canvas.
 * @module
 */

/**
 * The tokens whose perspective the current user is viewing the scene from.
 * Mirrors core behaviour: controlled tokens take priority. Players with nothing controlled
 * observe through every token they own. A GM with nothing controlled has no observers.
 * @returns {foundry.canvas.placeables.Token[]}
 */
export function getObservers() {
  if ( !canvas.ready ) return [];
  const controlled = canvas.tokens.controlled.filter(t => t.isOwner);
  if ( controlled.length || game.user.isGM ) return controlled;
  return canvas.tokens.placeables.filter(t => t.isOwner && !t.document.hidden);
}

/**
 * Whether the user currently sees the scene through restricted token vision.
 * @returns {boolean}
 */
export function hasRestrictedVision() {
  if ( !canvas.ready || !canvas.visibility?.tokenVision ) return false;
  return !game.user.isGM || (canvas.tokens.controlled.length > 0);
}

/**
 * The center of a token at its current *rendered* position, which follows movement animation.
 * The document position jumps straight to the destination, so it is not used here.
 * @param {foundry.canvas.placeables.Token} token
 * @returns {{x: number, y: number}}
 */
export function getRenderedCenter(token) {
  return {x: token.x + (token.w / 2), y: token.y + (token.h / 2)};
}

/**
 * Distance between two points measured in grid spaces.
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {number}
 */
export function gridDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y) / canvas.dimensions.size;
}

/**
 * Test whether a sight-blocking wall lies between two points.
 * @param {{x: number, y: number}} origin
 * @param {{x: number, y: number}} destination
 * @returns {boolean}
 */
export function isSightBlocked(origin, destination) {
  const backend = CONFIG.Canvas.polygonBackends?.sight;
  if ( !backend ) return false;
  return backend.testCollision(origin, destination, {type: "sight", mode: "any"});
}
