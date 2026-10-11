/**
 * Fragment shader reproducing how core tints explored areas of the fog of war.
 *
 * Core draws explored fog as a half-transparent layer whose color is the scene's explored fog
 * color, scaled by the perceived brightness of what lies beneath it. This shader applies that same
 * blend directly to a texture, so a token drawn above the fog looks as if it sits in explored fog.
 * @type {string}
 */
const FRAGMENT_SHADER = `
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;
  uniform vec3 exploredColor;
  const vec3 BT709 = vec3(0.2126, 0.7152, 0.0722);

  void main() {
    vec4 color = texture2D(uSampler, vTextureCoord);
    if ( color.a <= 0.0 ) {
      gl_FragColor = color;
      return;
    }
    vec3 rgb = color.rgb / color.a;
    float reflec = sqrt(dot(BT709, rgb * rgb));
    vec3 explored = min((exploredColor * reflec) + (rgb * exploredColor), vec3(1.0));
    gl_FragColor = vec4(mix(rgb, explored, 0.5) * color.a, color.a);
  }
`;

/**
 * Tints a texture the way explored fog of war tints the scene beneath it.
 * @extends {PIXI.Filter}
 */
export class ExploredFogFilter extends PIXI.Filter {
  constructor() {
    super(undefined, FRAGMENT_SHADER, {exploredColor: new Float32Array([0, 0, 0])});
  }

  /* -------------------------------------------- */

  /**
   * Match the explored fog color of the scene currently viewed.
   * @returns {this}
   */
  refreshColor() {
    const color = canvas.colors?.fogExplored;
    if ( color ) color.applyRGB(this.uniforms.exploredColor);
    return this;
  }
}
