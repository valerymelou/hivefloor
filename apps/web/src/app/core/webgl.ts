/**
 * Tells whether the browser can draw WebGL. Without it the list view is the
 * default (W11).
 *
 * @param doc - The document to create a test canvas in.
 * @returns `true` when a WebGL context can be created.
 */
export function webglAvailable(doc: Document = document): boolean {
  try {
    const canvas = doc.createElement('canvas');
    return (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) !== null;
  } catch {
    return false;
  }
}

/**
 * Tells whether a WebGL renderer name is a software rasterizer.
 *
 * @param renderer - The unmasked renderer name.
 * @returns `true` for SwiftShader, llvmpipe and the like.
 */
export function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|software/i.test(renderer);
}

/**
 * The name of the browser's WebGL renderer, where the browser reveals it.
 *
 * @param doc - The document to create a test canvas in.
 * @returns The renderer's name, or an empty string.
 */
export function webglRenderer(doc: Document = document): string {
  const gl = doc.createElement('canvas').getContext('webgl2');
  if (gl === null) return '';
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return info === null ? '' : String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
}

/**
 * Tells whether to save power (W10): phones and other touch-first devices, and
 * browsers drawing without a GPU, get no shadows, no desk lights and a lower
 * resolution.
 *
 * @param media - `window.matchMedia`.
 * @param renderer - The WebGL renderer's name.
 * @returns `true` when the office should draw less.
 */
export function lowPowerDevice(
  media: (query: string) => MediaQueryList,
  renderer: string,
): boolean {
  return media('(pointer: coarse)').matches || isSoftwareRenderer(renderer);
}
