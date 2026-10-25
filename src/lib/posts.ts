import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

export const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '');
export function urlFor(path = '') {
  return `${basePath}/${path.replace(/^\/+/, '')}`;
}
export function coverFor(post: Post) { return urlFor(post.data.cover); }
export function postUrl(post: Post) { return urlFor(`yazi/${post.id}/`); }
export function categoryUrl(category: string) { return urlFor(`kategori/${slugify(category)}/`); }
export function tagUrl(tag: string) { return urlFor(`etiket/${slugify(tag)}/`); }
export function slugify(value: string) {
  return value.toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function dateTR(date: Date) {
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
}
export async function getPosts(): Promise<Post[]> {
  return (await getCollection('blog', ({ data }) => data.draft !== true))
    .sort((a,b) => b.data.pubDate.valueOf()-a.data.pubDate.valueOf() || a.data.title.localeCompare(b.data.title,'tr'));
}
export function categoriesFrom(posts: Post[]) {
  return [...new Set(posts.map(p => p.data.category))].sort((a,b) => a.localeCompare(b,'tr'));
}
export function tagsFrom(posts: Post[]) {
  return [...new Set(posts.flatMap(p => p.data.tags))].sort((a,b) => a.localeCompare(b,'tr'));
}
