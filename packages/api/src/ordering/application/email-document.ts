import type { Email } from '../domain/mailer';

/**
 * An email's content, before it is rendered as plain text and as HTML: an
 * opening, then sections, each with an optional heading and paragraphs of
 * lines (or a link), and a closing.
 */
export type EmailDocument = {
  to: string;
  subject: string;
  sections: EmailSection[];
};

export type EmailSection = { heading?: string; paragraphs: EmailParagraph[] };

/** Lines shown together, or a link shown as its URL. */
export type EmailParagraph = readonly string[] | { link: string };

/** The store's name, as the emails sign off and their HTML header shows it. */
export const STORE_NAME = 'Y&I Jewelry';

// The brand's colors (the logo's black and gold) for the HTML part's header and headings.
const BRAND_BLACK = '#0b0b0b';
const BRAND_GOLD = '#d4be72';
const DEEP_GOLD = '#7a6630';

/** Renders `document` as an email whose text and HTML parts say the same. */
export function renderEmail(document: EmailDocument): Email {
  return { to: document.to, subject: document.subject, text: textOf(document), html: htmlOf(document) };
}

function textOf({ sections }: EmailDocument): string {
  const blocks = sections.map(({ heading, paragraphs }) =>
    [
      ...(heading === undefined ? [] : [`■ ${heading}`]),
      ...paragraphs.map((paragraph) => ('link' in paragraph ? paragraph.link : paragraph.join('\n'))),
    ].join('\n\n'),
  );
  return `${blocks.join('\n\n\n')}\n`;
}

function htmlOf({ subject, sections }: EmailDocument): string {
  const body = sections
    .map(({ heading, paragraphs }) =>
      [
        heading === undefined
          ? ''
          : `<h2 style="margin:32px 0 12px;font-size:16px;color:${DEEP_GOLD};border-bottom:1px solid ${BRAND_GOLD};padding-bottom:4px">${escapeHtml(heading)}</h2>`,
        ...paragraphs.map((paragraph) =>
          'link' in paragraph
            ? `<p style="margin:0 0 12px"><a href="${escapeHtml(paragraph.link)}" style="color:${DEEP_GOLD}">${escapeHtml(paragraph.link)}</a></p>`
            : `<p style="margin:0 0 12px">${paragraph.map(escapeHtml).join('<br>')}</p>`,
        ),
      ].join(''),
    )
    .join('');
  return [
    '<!DOCTYPE html>',
    `<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:#f6f4ef;font-family:sans-serif;font-size:14px;line-height:1.7;color:#1a1a1a">`,
    `<div style="max-width:600px;margin:0 auto;background:#ffffff">`,
    `<div style="background:${BRAND_BLACK};color:${BRAND_GOLD};padding:20px 24px;font-size:20px;letter-spacing:0.1em">${escapeHtml(STORE_NAME)}</div>`,
    `<div style="padding:24px">${body}</div>`,
    '</div></body></html>',
  ].join('');
}

/** `text` with the characters HTML gives meaning to escaped, so it shows as written. */
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
