import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().min(8),
    description: z.string().min(35).max(220),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string().min(2),
    tags: z.array(z.string().min(2)).min(1),
    cover: z.string().startsWith('assets/'),
    coverAlt: z.string().min(5),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
