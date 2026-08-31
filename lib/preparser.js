// preparser.js - Raw template string transformation

export function preParse(rawCode) {
  if (!rawCode) return '';

  // 1. Expand multi-attribute assignment: [id, name]="val" -> id="val" name="val"
  let clean = rawCode.replace(/\[\s*([a-zA-Z0-9_,\s-]+)\s*\]\s*=\s*(["'])(.*?)\2/g, (_, attrs, quote, val) => {
    return attrs.split(',').map(a => `${a.trim()}=${quote}${val}${quote}`).join(' ');
  });

  // 2. Expand self-closing custom tags: <card /> -> <card></card>
  const voidElements = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'track', 'wbr']);
  clean = clean.replace(/<([a-zA-Z0-9-]+)([^>]*?)\/>/g, (match, tag, attrs) => {
    if (voidElements.has(tag.toLowerCase())) return match;
    return `<${tag}${attrs}></${tag}>`;
  });

  return clean;
}
