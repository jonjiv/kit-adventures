/**
 * Phones and tablets (a finger is the main pointer). They get lighter graphics
 * to keep 60 fps. This is only for performance: touch controls switch on with
 * the first touch, not from this.
 */
export const IS_MOBILE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
