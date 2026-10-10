const UPLOADS_PREFIX = '/uploads/';

export function responsiveUploadImageUrl(source: string, width: number): string {
  if (!source.startsWith(UPLOADS_PREFIX)) return source;
  const filename = source.slice(UPLOADS_PREFIX.length);
  return `/media/${encodeURIComponent(filename)}?width=${width}`;
}

export function responsiveUploadImageSrcSet(source: string, widths: number[]): string | undefined {
  if (!source.startsWith(UPLOADS_PREFIX)) return undefined;
  return widths
    .map((width) => `${responsiveUploadImageUrl(source, width)} ${width}w`)
    .join(', ');
}