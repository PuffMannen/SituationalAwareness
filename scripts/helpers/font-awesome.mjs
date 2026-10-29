/**
 * A Font Awesome icon resolved to something a canvas text object can draw.
 * @typedef FontAwesomeGlyph
 * @property {string} glyph        The icon's character
 * @property {string} fontFamily   The font family the icon style uses
 * @property {string} fontWeight   The font weight the icon style uses
 */

/**
 * Resolved icons by class list. Null marks classes which name no icon.
 * @type {Map<string, FontAwesomeGlyph|null>}
 */
const glyphs = new Map();

/**
 * Icon class names offered as suggestions, read once from the loaded stylesheets.
 * @type {string[]|null}
 */
let iconNames = null;

/**
 * Resolve Font Awesome classes to the character, font family and weight which draw the icon.
 * Reads the computed style of a hidden element, so any icon and style Foundry's bundled
 * Font Awesome knows works, without a list of icons in the module.
 * @param {string} classes    Icon classes, such as "fa-solid fa-skull"
 * @returns {FontAwesomeGlyph|null}  Null if the classes name no icon
 */
export function resolveFontAwesome(classes) {
  classes = classes?.trim() ?? "";
  if ( glyphs.has(classes) ) return glyphs.get(classes);
  let resolved = null;
  if ( classes ) {
    const element = document.createElement("i");
    element.className = classes;
    element.style.position = "absolute";
    element.style.visibility = "hidden";
    document.body.append(element);
    const style = getComputedStyle(element);
    const glyph = parseContent(getComputedStyle(element, "::before").content);
    if ( glyph && style.fontFamily.includes("Font Awesome") ) {
      resolved = {glyph, fontFamily: style.fontFamily, fontWeight: style.fontWeight};
    }
    element.remove();
  }
  glyphs.set(classes, resolved);
  return resolved;
}

/* -------------------------------------------- */

/**
 * Suggested icon classes for every icon in the loaded Font Awesome stylesheet, in the solid style.
 * Icons from another style, such as brands, need that style's class instead.
 * @returns {string[]}
 */
export function getFontAwesomeIcons() {
  if ( iconNames ) return iconNames;
  const names = new Set();
  for ( const sheet of document.styleSheets ) collectIconNames(sheet, names);
  iconNames = Array.from(names).sort().map(name => `fa-solid fa-${name}`);
  return iconNames;
}

/* -------------------------------------------- */

/**
 * Add the name of every icon a stylesheet defines, including in imported sheets and in
 * grouping rules such as cascade layers.
 * @param {CSSStyleSheet|CSSGroupingRule} source
 * @param {Set<string>} names
 */
function collectIconNames(source, names) {
  let rules;
  try {
    rules = source.cssRules;
  } catch {
    return; // Stylesheets from another origin cannot be read
  }
  for ( const rule of rules ) {
    if ( rule instanceof CSSImportRule ) {
      if ( rule.styleSheet ) collectIconNames(rule.styleSheet, names);
    }
    else if ( rule instanceof CSSStyleRule ) {
      if ( !rule.style.getPropertyValue("--fa") ) continue;
      for ( const selector of rule.selectorText.split(",") ) {
        const match = selector.trim().match(/^\.fa-([a-z0-9-]+)$/);
        if ( match ) names.add(match[1]);
      }
    }
    else if ( rule.cssRules ) collectIconNames(rule, names);
  }
}

/* -------------------------------------------- */

/**
 * The first string in a computed CSS content value, such as `"\f6e2" / ""`, with escapes decoded.
 * @param {string} content
 * @returns {string|null}
 */
function parseContent(content) {
  const match = content?.match(/^"((?:[^"\\]|\\.)*)"/);
  if ( !match ) return null;
  const text = match[1].replace(/\\([0-9a-f]{1,6}) ?|\\(.)/gi, (_, hex, char) => {
    return hex ? String.fromCodePoint(parseInt(hex, 16)) : char;
  });
  return text || null;
}
