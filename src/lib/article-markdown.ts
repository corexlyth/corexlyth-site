import { unified } from 'unified';import remarkParse from 'remark-parse';import remarkGfm from 'remark-gfm';import remarkRehype from 'remark-rehype';import rehypeSanitize from 'rehype-sanitize';import rehypeStringify from 'rehype-stringify';
import {literalHtml,articleBlocks,articleHast,articleSchema} from './article-plugins.mjs';
const processor=unified().use(remarkParse).use(remarkGfm).use(literalHtml).use(articleBlocks).use(remarkRehype).use(articleHast).use(rehypeSanitize,articleSchema).use(rehypeStringify);
export async function renderArticleMarkdown(source:string){return String(await processor.process(source));}
