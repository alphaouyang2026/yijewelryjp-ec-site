// The transparent gold logo kept at the repository root; Vite serves it as a content-hashed asset.
export { default as logoUrl } from '../../../assets/brand/yi-logo-gold-transparent.png';

/**
 * The logo file's own pixel size, for the <img> width and height attributes:
 * they give the browser its square shape before the file loads, so nothing
 * shifts. Its size on screen comes from tokens.css (--logo-header, --logo-footer).
 */
export const LOGO_FILE_SIZE = { width: 480, height: 480 };

export const BRAND_NAME = 'Y&I Jewelry';
