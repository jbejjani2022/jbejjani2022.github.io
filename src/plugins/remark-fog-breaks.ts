import type { Root } from 'mdast';
import type { VFile } from 'vfile';
import { newlineToBreak } from 'mdast-util-newline-to-break';

// remark-breaks, but only for Into the Fog pieces (src/content/fog/).
// Poems need every newline to be a line break; blog posts must not get that.
export default function remarkFogBreaks() {
  return (tree: Root, file: VFile) => {
    const path = file.path ?? '';
    if (path.replaceAll('\\', '/').includes('/src/content/fog/')) {
      newlineToBreak(tree);
    }
  };
}
