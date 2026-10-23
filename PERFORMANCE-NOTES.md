# COREX — Performance pass

Apply this archive at the root of the existing site repository (merge/copy files; do not delete the existing assets):

- Replace `index.html`.
- Replace `js/cases.js` with the included version.
- Add the 14 files in `assets/hero/` (the new `.webp` and `-800.webp` variants). Keep the existing PNGs; they remain as fallback sources.

What changed based on the Lighthouse screenshots:

- Converted seven 1.8–2.3 MiB hero PNGs to responsive WebP variants. The original seven total about 13.75 MiB; the new full-size WebPs total about 0.77 MiB. Mobile variants total about 0.30 MiB. The page requests the first slide up front and loads the other slides only when needed.
- The intro hero panel is marked active in the HTML so the LCP image can render without waiting for the bottom-of-page scripts.
- Nonessential GSAP/ScrollTrigger animations are loaded after the page load, not on the initial critical path.
- Kept PNG fallback paths in case a WebP file is missing.

After deploying, rerun Lighthouse in a clean Chrome profile or Incognito with extensions disabled. The report included a Selenium IDE extension and was not a clean measurement. Check LCP and Performance again; the score can vary with device/network throttling.
