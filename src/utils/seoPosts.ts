import type { SeoLandingPage, SeoLandingPost } from '../types';

export function slugifySeoPost(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('id-ID')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

export function getSeoLandingPosts(page: SeoLandingPage): SeoLandingPost[] {
  const posts = Array.isArray(page.posts) ? page.posts : [];
  if (!page.content?.trim() || posts.some((post) => post.id === page.id)) return posts;

  return [
    {
      id: page.id,
      slug: slugifySeoPost(page.title || page.seoTitle || page.subdomain),
      title: page.title || page.seoTitle || page.subdomain,
      content: page.content,
    },
    ...posts,
  ];
}

export function getSeoLandingPostPath(page: SeoLandingPage, post: SeoLandingPost) {
  return post.id === page.id ? '/' : `/${post.slug}/`;
}

export function findSeoLandingPost(page: SeoLandingPage, pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  return getSeoLandingPosts(page).find((post) => {
    const postPath = getSeoLandingPostPath(page, post).replace(/\/+$/, '') || '/';
    return postPath === normalizedPath;
  });
}