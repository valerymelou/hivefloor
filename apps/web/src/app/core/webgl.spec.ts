import { describe, expect, it } from 'vitest';
import { isSoftwareRenderer, lowPowerDevice, webglAvailable, webglRenderer } from './webgl';

function fakeDocument(context: unknown): Document {
  return { createElement: () => ({ getContext: () => context }) } as unknown as Document;
}

const media = (coarse: boolean) => (): MediaQueryList =>
  ({ matches: coarse }) as unknown as MediaQueryList;

describe('webglAvailable (W11)', () => {
  it('reports whether a context can be created', () => {
    expect(webglAvailable(fakeDocument({}))).toBe(true);
    expect(webglAvailable(fakeDocument(null))).toBe(false);
  });

  it('treats a throwing browser as having no WebGL', () => {
    const broken = {
      createElement: () => {
        throw new Error('no canvas');
      },
    } as unknown as Document;
    expect(webglAvailable(broken)).toBe(false);
  });
});

describe('webglRenderer', () => {
  it('reads the unmasked name when the browser reveals it', () => {
    const gl = {
      getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 7 }),
      getParameter: (p: number) => (p === 7 ? 'Apple M3' : ''),
    };
    expect(webglRenderer(fakeDocument(gl))).toBe('Apple M3');
  });

  it('returns nothing without WebGL or the extension', () => {
    expect(webglRenderer(fakeDocument(null))).toBe('');
    expect(webglRenderer(fakeDocument({ getExtension: () => null }))).toBe('');
  });
});

describe('lowPowerDevice (W10)', () => {
  it('saves power on touch-first devices and software renderers', () => {
    expect(isSoftwareRenderer('ANGLE (Google, SwiftShader driver)')).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15)')).toBe(true);
    expect(isSoftwareRenderer('Apple M3')).toBe(false);
    expect(lowPowerDevice(media(true), 'Adreno 740')).toBe(true);
    expect(lowPowerDevice(media(false), 'SwiftShader')).toBe(true);
    expect(lowPowerDevice(media(false), 'Apple M3')).toBe(false);
  });
});
