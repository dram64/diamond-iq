import { useState } from 'react';

/**
 * Hero band — sits between the top nav and the home page's first content
 * section. Visually frames the product as a baseball-focused analytics app.
 *
 * To swap the hero image, drop a 1920x600 WebP (under 200 KB) at
 * `frontend/public/images/hero.webp`. No code changes needed — the
 * component will switch from the gradient placeholder to the photo
 * automatically on next page load.
 */

const HERO_PATH = '/images/hero.webp';

export function Hero() {
  // We optimistically attempt to load /images/hero.webp. If the file isn't
  // there (placeholder mode), the <img>'s onError flips us to the
  // navy-to-red gradient placeholder rendered behind everything.
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = !imageBroken;

  return (
    <section
      aria-label="Diamond IQ"
      className="relative isolate overflow-hidden rounded-l border border-hairline-strong"
      // Height controlled by Tailwind utilities below; min-h ensures the
      // gradient placeholder is visible even on devices that haven't
      // rasterized the <img> yet.
      style={{ minHeight: 140 }}
    >
      {/* Gradient placeholder — visible whenever the photo is missing or
          still decoding. Uses our design tokens (MLB navy → live red). */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(120deg, var(--diq-accent, #002d72) 0%, #1a3a7a 55%, var(--diq-live, #d50032) 130%)',
        }}
      />

      {/* Subtle dot pattern on top of the gradient for visual interest while
          we don't have a photo. Vanishes once a real photo loads. */}
      {!showImage && (
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full opacity-[0.08]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="diq-hero-dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diq-hero-dots)" />
        </svg>
      )}

      {/* Real photo — falls through to the gradient via onError when the file
          isn't deployed. */}
      {showImage && (
        <img
          src={HERO_PATH}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          onError={() => setImageBroken(true)}
        />
      )}

      {/* Bottom-up dark overlay so future text or our own subtle wordmark
          stays legible regardless of photo content. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
      />

      {/* Content layer — the only thing that affects layout height. */}
      <div className="relative flex h-[140px] items-end px-6 py-5 sm:h-[200px] md:h-[240px] md:px-9 md:py-6">
        <div className="text-white">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 sm:text-[11px]">
            Diamond IQ
          </div>
        </div>
      </div>
    </section>
  );
}
