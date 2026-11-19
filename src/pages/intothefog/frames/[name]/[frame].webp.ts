import type { APIRoute, GetStaticPaths } from 'astro';
import { allGifs, gifFrame, gifTimeline } from '../../../../lib/gif';

// The stills every GIF rests on, for the pause / step-through player.
export const getStaticPaths = (async () => {
  const paths = [];
  for (const [name, path] of allGifs()) {
    for (const { frame } of await gifTimeline(path)) {
      paths.push({ params: { name, frame: String(frame) }, props: { path } });
    }
  }
  return paths;
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params, props }) => {
  const image = await gifFrame(props.path, Number(params.frame));
  return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/webp' } });
};
