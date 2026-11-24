export interface ArticleSeed {
  id: number;
  slug: string;
  title: string;
  metaDescription: string;
  category: string;
  author: string;
  publishedAt: string;
  readTime: string;
  theme: string;
  thumbnail: string;
  images: string[];
  video: string;
  sourceUrl: string;
  content: string;
}

export const ARTICLES: ArticleSeed[];
