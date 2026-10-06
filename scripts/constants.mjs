/**
 * The package identifier. Must match the "id" field of module.json and the module folder name.
 * @type {string}
 */
export const MODULE_ID = "situational-awareness";

/**
 * The socket channel reserved for this module by the "socket" manifest field.
 * @type {string}
 */
export const SOCKET_NAME = `module.${MODULE_ID}`;

/**
 * Localization prefix used by every string in lang/en.json.
 * @type {string}
 */
export const I18N = "SITAWARE";

/**
 * Upper bound for any render texture this module allocates, matching the core visibility texture limit.
 * @type {number}
 */
export const MAX_TEXTURE_SIZE = 4096;
