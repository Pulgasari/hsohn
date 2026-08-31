// preparser.js - Raw template string transformation

// 1. Expand multi-attribute assignment: [id, name]="val" -> id="val" name="val"

const REGEXP_MULTI_ATTR = /\[\s*([a-zA-Z0-9_,\s-]+)\s*\]\s*=\s*(["'])(.*?)\2/g;

function expandMultiAttr (input) {
  const output = input.replace(REGEXP_MULTI_ATTR, (_, attrs, quote, val) => {
    return attrs.split(',').map(a => `${a.trim()}=${quote}${val}${quote}`).join(' ');
  });
  return output;
}

// 2. Expand self-closing custom tags: <card /> -> <card></card>

const voidElements = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'track', 'wbr']);
  
function expandSelfClosingCustomTags (input) {
  const output = clean.replace(/<([a-zA-Z0-9-]+)([^>]*?)\/>/g, (match, tag, attrs) => {
    if (voidElements.has(tag.toLowerCase())) return match;
    return `<${tag}${attrs}></${tag}>`;
  });
  return output;
}

// :::::: MAIN

function preParse (code) {
  if (!code) return '';
  
  code = expandMultiAttr (code);
  coee = expandSelfClosingCustomTags (code)
  
  return code;
}

// :::::: EXPORT

export       { preParse };
export default preParse;
