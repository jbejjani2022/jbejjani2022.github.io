import type { Element, ElementContent, Root } from 'hast';
import { SKIP, visit } from 'unist-util-visit';

// Turns GFM footnotes into Tufte-style sidenotes.
//
// Input (from remark-gfm / remark-rehype):
//   <sup><a href="#user-content-fn-1" data-footnote-ref>1</a></sup>
//   ...
//   <section data-footnotes><h2>Footnotes</h2><ol><li id="user-content-fn-1">…</li></ol></section>
//
// Output, at the first reference to each note:
//   <input type="checkbox" id="sn-1" class="sn-checkbox">
//   <label for="sn-1" class="sn-toggle"><sup class="sn-ref">1</sup></label>
//   <span class="sidenote" role="note"><span class="sn-num">1</span> …</span>
//
// The note is an inline <span> placed right after its reference (not an <aside> after the
// paragraph) so it stays valid inside <p>, <li>, and <td>, and so the CSS float lands on
// the same line as the reference. The bottom footnotes section is removed.

// Elements allowed inside a <span>. Anything else is renamed to <span> so the markup stays valid.
const PHRASING = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'img',
  'ins', 'kbd', 'mark', 'math', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'svg',
  'time', 'u', 'var', 'wbr',
]);

const isFootnoteSection = (node: Element) => node.tagName === 'section' && 'dataFootnotes' in node.properties;

const isBackref = (node: ElementContent) =>
  node.type === 'element' && node.tagName === 'a' && 'dataFootnoteBackref' in node.properties;

function toPhrasing(nodes: ElementContent[]): ElementContent[] {
  return nodes
    .filter((node) => !isBackref(node))
    .map((node) => {
      if (node.type !== 'element') return node;
      const children = toPhrasing(node.children);
      if (PHRASING.has(node.tagName)) return { ...node, children };
      return { ...node, tagName: 'span', children };
    });
}

// Flattens a footnote <li> into phrasing content; paragraphs are separated by <br>.
function noteContent(li: Element): ElementContent[] {
  const out: ElementContent[] = [];
  for (const child of li.children) {
    if (child.type === 'text' && child.value.trim() === '') continue;
    const inner = child.type === 'element' && child.tagName === 'p' ? child.children : [child];
    if (out.length > 0) out.push({ type: 'element', tagName: 'br', properties: {}, children: [] });
    out.push(...toPhrasing(inner));
  }
  // Drop the trailing space GFM leaves before the (now removed) backref arrow.
  const last = out.at(-1);
  if (last?.type === 'text') last.value = last.value.trimEnd();
  return out;
}

function collectNotes(tree: Root): Map<string, ElementContent[]> {
  const notes = new Map<string, ElementContent[]>();
  visit(tree, 'element', (node, index, parent) => {
    if (!isFootnoteSection(node)) return;
    visit(node, 'element', (li) => {
      if (li.tagName === 'li' && typeof li.properties.id === 'string') {
        notes.set(li.properties.id, noteContent(li));
      }
    });
    if (parent && index !== undefined) {
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
  });
  return notes;
}

function footnoteRef(node: Element): Element | undefined {
  if (node.tagName !== 'sup') return undefined;
  const link = node.children.find((c): c is Element => c.type === 'element' && c.tagName === 'a');
  return link && 'dataFootnoteRef' in link.properties ? link : undefined;
}

const text = (value: string): ElementContent => ({ type: 'text', value });

export default function rehypeSidenotes() {
  return (tree: Root) => {
    const notes = collectNotes(tree);
    if (notes.size === 0) return;
    const rendered = new Set<string>();

    visit(tree, 'element', (node, index, parent) => {
      const link = footnoteRef(node);
      if (!link || !parent || index === undefined) return;

      const targetId = String(link.properties.href ?? '').replace(/^#/, '');
      const label = link.children.map((c) => (c.type === 'text' ? c.value : '')).join('');
      const ref: Element = {
        type: 'element',
        tagName: 'sup',
        properties: { className: ['sn-ref'] },
        children: [text(label)],
      };

      // Repeat references to the same note just show the number.
      const content = notes.get(targetId);
      if (!content || rendered.has(targetId)) {
        parent.children.splice(index, 1, ref);
        return [SKIP, index + 1];
      }
      rendered.add(targetId);

      const id = `sn-${label}`;
      const replacement: Element[] = [
        {
          type: 'element',
          tagName: 'input',
          properties: { type: 'checkbox', id, className: ['sn-checkbox'], ariaLabel: `Show note ${label}` },
          children: [],
        },
        {
          type: 'element',
          tagName: 'label',
          properties: { htmlFor: [id], className: ['sn-toggle'] },
          children: [ref],
        },
        {
          type: 'element',
          tagName: 'span',
          properties: { className: ['sidenote'], role: 'note' },
          children: [
            { type: 'element', tagName: 'span', properties: { className: ['sn-num'] }, children: [text(label)] },
            text(' '),
            ...content,
          ],
        },
      ];
      parent.children.splice(index, 1, ...replacement);
      return [SKIP, index + replacement.length];
    });
  };
}
