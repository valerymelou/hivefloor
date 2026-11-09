import { injectContentFiles } from '@analogjs/content';
import { DOCUMENT, effect, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { COPY, REPOSITORY, type GuideAttributes } from './content';

/** The public address of the site, with no trailing slash. */
export const SITE_URL = 'https://hivefloor.valerymelou.com';

const IMAGE = {
  url: `${SITE_URL}/assets/og-image.jpg`,
  width: '1200',
  height: '630',
  type: 'image/jpeg',
};

const AUTHOR = {
  '@type': 'Person',
  name: 'Valery Melou',
  url: 'https://valerymelou.com',
  sameAs: ['https://github.com/valerymelou', 'https://x.com/valerymelou'],
};
const AUTHOR_HANDLE = '@valerymelou';

/** What search engines and link previews are told about one page. */
export interface PageSeo {
  readonly title: string;
  readonly description: string;
  /** The page's one address: Cloudflare serves every page with a trailing slash. */
  readonly canonical: string;
  readonly type: 'website' | 'article';
  /** The page's structured data, for `application/ld+json`. */
  readonly structuredData: Readonly<Record<string, unknown>>;
}

function landingSeo(): PageSeo {
  const url = `${SITE_URL}/`;
  return {
    title: COPY.seo.title,
    description: COPY.seo.description,
    canonical: url,
    type: 'website',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: COPY.brand, url, author: AUTHOR },
        {
          '@type': 'SoftwareApplication',
          name: COPY.brand,
          description: COPY.seo.description,
          url,
          image: IMAGE.url,
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'macOS, Linux, Windows',
          license: `${REPOSITORY}/blob/main/LICENSE`,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          author: AUTHOR,
        },
      ],
    },
  };
}

function article(headline: string, title: string, description: string, canonical: string): PageSeo {
  return {
    title,
    description,
    canonical,
    type: 'article',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline,
      description,
      url: canonical,
      image: IMAGE.url,
      author: AUTHOR,
      isPartOf: { '@type': 'WebSite', name: COPY.brand, url: `${SITE_URL}/` },
    },
  };
}

/**
 * Works out the metadata for a page. Pure, so that every pre-rendered page gets
 * the same answer as the browser.
 *
 * @param url - The router's URL, with or without a query or a trailing slash.
 * @param guides - The attributes of every guide.
 * @returns The page's metadata. An unknown address gets the landing page's.
 */
export function seoFor(url: string, guides: readonly GuideAttributes[]): PageSeo {
  const raw = url.split(/[?#]/)[0] ?? '';
  const path = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  if (path === '/docs') {
    return article(
      COPY.docs.title,
      `${COPY.docs.title} | ${COPY.brand}`,
      COPY.seo.docs,
      `${SITE_URL}/docs/`,
    );
  }
  const guide = guides.find((candidate) => `/docs/${candidate.slug}` === path);
  if (guide === undefined) return landingSeo();
  return article(
    guide.title,
    `${guide.title} | ${COPY.brand} docs`,
    `${guide.description} ${COPY.seo.guideSuffix}`,
    `${SITE_URL}${path}/`,
  );
}

/** Keeps the document's head in step with the page on screen. */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly guides = injectContentFiles<GuideAttributes>((file) =>
    file.filename.includes('/docs/'),
  ).map((file) => file.attributes);

  /** Starts following the router. Call it once, from an injection context. */
  track(): void {
    const url = toSignal(
      this.router.events.pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.router.url),
      ),
      { initialValue: this.router.url },
    );
    effect(() => {
      this.apply(seoFor(url(), this.guides));
    });
  }

  private apply(page: PageSeo): void {
    this.titleService.setTitle(page.title);
    const named: readonly (readonly [string, string])[] = [
      ['description', page.description],
      ['twitter:card', 'summary_large_image'],
      ['twitter:site', AUTHOR_HANDLE],
      ['twitter:creator', AUTHOR_HANDLE],
      ['twitter:title', page.title],
      ['twitter:description', page.description],
      ['twitter:image', IMAGE.url],
      ['twitter:image:alt', COPY.seo.imageAlt],
    ];
    const properties: readonly (readonly [string, string])[] = [
      ['og:site_name', COPY.brand],
      ['og:locale', 'en_US'],
      ['og:type', page.type],
      ['og:title', page.title],
      ['og:description', page.description],
      ['og:url', page.canonical],
      ['og:image', IMAGE.url],
      ['og:image:secure_url', IMAGE.url],
      ['og:image:type', IMAGE.type],
      ['og:image:width', IMAGE.width],
      ['og:image:height', IMAGE.height],
      ['og:image:alt', COPY.seo.imageAlt],
    ];
    for (const [name, content] of named) this.meta.updateTag({ name, content });
    for (const [property, content] of properties) this.meta.updateTag({ property, content });
    this.headElement('link[rel="canonical"]', 'link', { rel: 'canonical' }).setAttribute(
      'href',
      page.canonical,
    );
    this.headElement('script[type="application/ld+json"]', 'script', {
      type: 'application/ld+json',
    }).textContent = JSON.stringify(page.structuredData).replaceAll('<', '\\u003c');
  }

  /** Finds an element in the head, adding it when this is the first page drawn. */
  private headElement(
    selector: string,
    tag: 'link' | 'script',
    attributes: Readonly<Record<string, string>>,
  ): HTMLElement {
    // The server's DOM answers `undefined` here, the browser's `null`.
    return this.document.head.querySelector<HTMLElement>(selector) ?? this.add(tag, attributes);
  }

  private add(tag: 'link' | 'script', attributes: Readonly<Record<string, string>>): HTMLElement {
    const element = this.document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    this.document.head.appendChild(element);
    return element;
  }
}
