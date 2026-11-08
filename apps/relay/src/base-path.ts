/**
 * Removes the relay's base path from a request, so the routes stay the same when
 * the office is served under a path such as `/office` (docs/PRD.md, base path).
 *
 * @param request - The incoming request.
 * @param basePath - The base path, such as `/office`; empty or absent at the root.
 * @returns The request to route: the original when there is nothing to remove.
 */
export function withoutBasePath(request: Request, basePath: string | undefined): Request {
  let base = basePath ?? '';
  while (base.endsWith('/')) base = base.slice(0, -1);
  if (base === '') return request;
  const url = new URL(request.url);
  if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return request;
  url.pathname = url.pathname.slice(base.length) || '/';
  return new Request(url, request);
}
