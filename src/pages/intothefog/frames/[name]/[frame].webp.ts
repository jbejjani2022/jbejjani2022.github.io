import type { APIRoute, GetStaticPaths } from 'astro';
import { allGifs, gifDelays, gifFrame } from '../../../../lib/gif';

// Still frames of every GIF, for the pause / step-through player.
export const getStaticPaths = (async () => {
  const paths = [];
  for (const [name, path] of allGifs()) {
    const frames = (await gifDelays(path)).length;
    for (let frame = 0; frame < frames; frame++) {
      paths.push({ params: { name, frame: String(frame) }, props: { path } });
    }
  }
  return paths;
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params, props }) => {
  const image = await gifFrame(props.path, Number(params.frame));
  return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/webp' } });
};
