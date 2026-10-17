/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 *
 * Indentation grammar: leading tabs define depth. Depth jump > 1 fails the file.
 */

function countTabDepth(line) {
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\t') depth += 1;
    else break;
  }
  return depth;
}

function isSeparatorLine(content) {
  return /^-{3,}\s*$/.test(content);
}

function unwrapBadgePath(content) {
  const trimmed = String(content || '').trim();
  const m = trimmed.match(/^\{(.*)\}$/);
  return m ? m[1].trim() : trimmed;
}

function isBadgePathLine(content) {
  if (!content || content.endsWith(':')) return false;
  if (content.startsWith('-')) return false;
  const pathText = unwrapBadgePath(content);
  if (!pathText) return false;
  return (
    /^(badges\/|\.\/badges\/|[A-Za-z]:\\|\/)/.test(pathText) ||
    /\.(svg|png|jpe?g|webp|gif)$/i.test(pathText)
  );
}

function isLeafLine(content) {
  return content.startsWith('-');
}

/**
 * @param {string} text
 * @returns {{ ok: true, lines: object[] } | { ok: false, message: string }}
 */
function tokenizeLines(text) {
  const rawLines = String(text).split(/\r?\n/);
  const lines = [];

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const depth = countTabDepth(raw);
    const content = raw.slice(depth).trimEnd();
    const trimmed = content.trim();

    if (trimmed === '') {
      lines.push({ index: i, depth: 0, content: '', blank: true, separator: false, leaf: false, badgePath: false });
      continue;
    }

    // Spaces-only indent: treat as depth 0 with warning (preferred: count tabs only)
    if (/^ +/.test(raw) && !raw.startsWith('\t')) {
      // still parse at depth 0
    }

    lines.push({
      index: i,
      depth,
      content: trimmed,
      blank: false,
      separator: isSeparatorLine(trimmed),
      leaf: isLeafLine(trimmed),
      badgePath: isBadgePathLine(trimmed),
    });
  }

  return { ok: true, lines };
}

/**
 * Walk non-blank, non-separator structural lines and enforce depth grammar.
 * Returns nodes with parentIndex / children indices into the filtered list,
 * plus fatal error if depth jumps by more than 1.
 */
function buildHeaderForest(lines) {
  const structural = [];
  for (const line of lines) {
    if (line.blank || line.separator || line.badgePath) continue;
    structural.push(line);
  }

  const nodes = structural.map((line) => ({
    ...line,
    children: [],
    parent: null,
  }));

  const stack = []; // { depth, node }

  for (const node of nodes) {
    while (stack.length && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      if (node.depth !== 0) {
        return {
          ok: false,
          message: `Indentation depth jump at line ${node.index + 1}`,
        };
      }
    } else {
      const parent = stack[stack.length - 1];
      if (node.depth !== parent.depth + 1) {
        return {
          ok: false,
          message: `Indentation depth jump at line ${node.index + 1}`,
        };
      }
      node.parent = parent.node;
      parent.node.children.push(node);
    }

    if (!node.leaf) {
      stack.push({ depth: node.depth, node });
    }
  }

  const roots = nodes.filter((n) => n.parent == null);
  return { ok: true, nodes, roots };
}

function headerPathFor(node) {
  const parts = [];
  let cur = node.parent;
  while (cur) {
    const name = cur.content.replace(/:$/, '').trim();
    parts.unshift(name);
    cur = cur.parent;
  }
  return parts;
}

module.exports = {
  countTabDepth,
  isSeparatorLine,
  isBadgePathLine,
  unwrapBadgePath,
  isLeafLine,
  tokenizeLines,
  buildHeaderForest,
  headerPathFor,
};
