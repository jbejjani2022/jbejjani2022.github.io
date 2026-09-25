import type { Element, ElementContent, Root, RootContent } from 'hast';

// Turns an image paragraph followed by an italic-only paragraph into a figure:
//
//   <p><img></p><p><em>caption</em></p>  ->  <figure><img><figcaption>caption</figcaption></figure>
//
// Image paragraphs without a caption become captionless figures so they center the same way.

const isBlank = (node: RootContent | ElementContent) =>
  node.type === 'text' && node.value.trim() === '';

const isElement = (node: RootContent | ElementContent | undefined, tag: string): node is Element =>
  node?.type === 'element' && node.tagName === tag;

function soleChild(node: Element, tag: string): Element | undefined {
  const meaningful = node.children.filter((child) => !isBlank(child));
  const [only] = meaningful;
  return meaningful.length === 1 && isElement(only, tag) ? only : undefined;
}

function nextNonBlank(children: (RootContent | ElementContent)[], from: number): number {
  let i = from;
  while (i < children.length && isBlank(children[i])) i++;
  return i;
}

function transform(parent: Root | Element) {
  const children = parent.children as (RootContent | ElementContent)[];
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.type !== 'element') continue;
    if (node.tagName !== 'p') {
      transform(node);
      continue;
    }
    const img = soleChild(node, 'img');
    if (!img) continue;

    const figure: Element = {
      type: 'element',
      tagName: 'figure',
      properties: {},
      children: [img],
    };

    const j = nextNonBlank(children, i + 1);
    const next = children[j];
    const em = isElement(next, 'p') ? soleChild(next, 'em') : undefined;
    if (em) {
      figure.children.push({
        type: 'element',
        tagName: 'figcaption',
        properties: {},
        children: em.children,
      });
      children.splice(i, j - i + 1, figure);
    } else {
      children[i] = figure;
    }
  }
}

export default function rehypeFigures() {
  return (tree: Root) => transform(tree);
}
