import rss from '@astrojs/rss';
import { getPosts, postUrl } from '../lib/posts';

export async function GET(context) {
  const posts = await getPosts();
  return rss({
    title: 'CoreXLyth — Dijital keşif kayıtları',
    description: 'Android, teknoloji, rehberler ve dijital dünyaya dair CoreXLyth yazıları.',
    site: context.site ?? 'https://corexlyth.github.io',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postUrl(post),
    })),
    customData: '<language>tr-TR</language>',
  });
}
