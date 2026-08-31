// preparser.js - Raw template string transformation

// 1. Expand multi-attribute assignment: [id, name]="val" -> id="val" name="val"

const REGEXP_MULTI_ATTR = /\[\s*([a-zA-Z0-9_,\s-]+)\s*\]\s*=\s*(["'])(.*?)\2/g;

function expandMultiAttr (input) {
  const output = input.replace(REGEXP_MULTI_ATTR, (_, attrs, quote, val) => {
    return attrs.split(',').map(a => `${a.trim()}=${quote}${val}${quote}`).join(' ');
  });
  return output;
}

// 2. Convert positional string arguments: <tag 'value' -> <tag $attr="value"
  // Matches positional quoted strings right after tag name or class/id definitions
function convertPositionalStringArguments (input) {
  clean = clean.replace(/(<[a-zA-Z0-9_-]+(?:\s+[^>]*?)?)\s+(["'])(.*?)\2/g, (_, tagStart, quote, val) => {
    return `${tagStart} $attr="${val}"`;
  });
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



// preparser.js - Transforms tmpl DSL syntaxes into standard HTML attributes
function convertTagNames (rawCode) {
  // 1. Convert tag-level CSS selectors: <tag.class1.class2#my-id -> <tag class="class1 class2" id="my-id"
  clean = clean.replace(/<([a-zA-Z0-9_-]+)((?:[\.#][a-zA-Z0-9_-]+)+)/g, (_, tagName, selectors) => {
    const classes = [];
    let id = null;

    // Parse .className and #id parts
    selectors.replace(/([\.#])([a-zA-Z0-9_-]+)/g, (__, type, name) => {
      if (type === '.') classes.push(name);
      if (type === '#') id = name;
    });

    let result = `<${tagName}`;
    if (classes.length > 0) result += ` class="${classes.join(' ')}"`;
    if (id) result += ` id="${id}"`;

    return result;
  });
}
