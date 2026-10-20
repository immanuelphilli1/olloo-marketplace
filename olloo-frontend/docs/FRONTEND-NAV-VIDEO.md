# Top video strip: fetch it from the API

For the developer of the storefront (`LHDexpress/handco-web-client`).

The thin video strip at the top of every page (desktop only, `components/Nav.tsx`) is now managed by staff in the admin **Banners** page, slot **Every page: Top video strip (desktop header)**. Stop using the bundled file (`images.nav.bannerVid` and `/assets/nav/banner-poster.png`) and fetch the strip from the API.

## API call

`GET /api/v1/placements/site?position=nav_video`

No authentication, no cart header. The response has the same shape as the home banners (`GET /placements/home`), with one more field, `videoUrl`.

```json
{
  "items": [
    {
      "rid": "p7Kq2LmZx9Aa",
      "position": "nav_video",
      "imageUrl": "https://hcomall.com/storage/uploads/placements/strip-poster.jpg",
      "videoUrl": "https://hcomall.com/storage/uploads/placements/strip.mp4",
      "altText": "New season preview",
      "title": null,
      "description": null,
      "buttonText": null,
      "linkUrl": "/categories/fashion"
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `videoUrl` | The video (MP4 or WebM). Always set for this slot. |
| `imageUrl` | The poster: shown before the video plays, and instead of it when the browser blocks autoplay (iPhone Low Power Mode, data saver). Always set for this slot. |
| `altText` | Use as the video's `aria-label`. Can be `null`. |
| `linkUrl` | Optional. When set, the whole strip is a link: a storefront path (`/categories/...`) or a full URL. |
| `title`, `description`, `buttonText` | Always `null` for this slot. The strip shows no text. |

- Items are active only and in staff order. Show the **first** item. Staff can keep a second one ready and switch the order.
- `items: []` means staff have not added a strip, or turned it off. Then hide the strip.
- Other values: `GET /placements/site` (without `position`) returns every position of the `site` page; today that is only `nav_video`. An unknown position answers `422`.

## Changes

### 1. Fetch once per visit

Add a call next to `getHomePlacements` in `src/api/services/catalog.ts`:

```ts
export type SiteVideoPlacement = HomeBannerPlacement & { videoUrl: string | null }

export async function getNavVideo(): Promise<SiteVideoPlacement | null> {
  const response = await cachedGet(buildCacheKey('placements/site', { position: 'nav_video' }), () =>
    apiRequest<{ items: SiteVideoPlacement[] }>('/placements/site', {
      auth: false,
      cart: false,
      searchParams: { position: 'nav_video' },
    }),
  )
  return response.items.find((item) => item.videoUrl) ?? null
}
```

`Nav` is on every page, so load it once (in `Nav`, or in a small context next to `HomePlacementsContext`) and keep it for the visit.

### 2. Render it in `Nav.tsx`

Keep the existing `bannerVideoRef` (it sets `muted` on the element and retries `play()`); it is what makes autoplay work on Safari. Replace the hardcoded `src` and `poster`:

```tsx
const [navVideo, setNavVideo] = useState<SiteVideoPlacement | null>(null)
const [isNavVideoLoaded, setIsNavVideoLoaded] = useState(false)

useEffect(() => {
  let cancelled = false
  getNavVideo()
    .then((video) => { if (!cancelled) setNavVideo(video) })
    .catch(() => { if (!cancelled) setNavVideo(null) })
    .finally(() => { if (!cancelled) setIsNavVideoLoaded(true) })
  return () => { cancelled = true }
}, [])
```

```tsx
{(!isNavVideoLoaded || navVideo) && (
  <div className="relative hidden lg:block h-10 overflow-hidden lg:h-12">
    {navVideo && (
      <BannerLink linkUrl={navVideo.linkUrl} className="block size-full">
        <video
          key={navVideo.videoUrl}
          ref={bannerVideoRef}
          className="size-full object-cover"
          src={navVideo.videoUrl ?? undefined}
          poster={navVideo.imageUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-label={navVideo.altText ?? 'Advertisement'}
        />
      </BannerLink>
    )}
  </div>
)}
```

- **While loading**, the empty strip keeps its height (`h-10 lg:h-12`), so the header does not jump when the video arrives.
- **When the API answers with no strip** (or fails), the strip is removed. Do not fall back to a bundled video.
- `key={navVideo.videoUrl}` makes React create a new `<video>` when staff replace the file, so `bannerVideoRef` runs again for it.
- **SSR:** the server renders the strip empty (state starts as `null` on both sides), so hydration still matches. The video appears after hydration.

### 3. Delete the bundled files

Remove `images.nav.bannerVid` from `src/assets/images.ts`, and delete `public/assets/nav/banner-vid.mp4` (38 MB on `main`) and `public/assets/nav/banner-poster.png`, once nothing else references them.

## Before you ship this

Staff must add the strip in the admin first, or the strip disappears from the live site. In **Banners**, choose **Every page: Top video strip (desktop header)**, upload the video and a poster image, and save. Check:

```bash
curl -s 'https://hcomall.com/api/v1/placements/site?position=nav_video'
```

It must return one item with a `videoUrl`.

The admin accepts MP4 or WebM up to 20 MB, but a small file is what makes autoplay reliable. Use H.264, level 4.0, at most 4096 px wide, about 2 MB. The re-encoded file on the `ssr-v2` branch (`public/assets/nav/banner-vid-v2.mp4`, 0.87 MB) is a good first upload. To re-encode another clip:

```bash
ffmpeg -i in.mp4 -an -vf "scale=2880:96:flags=lanczos,fps=30" \
  -c:v libx264 -profile:v main -level:v 4.0 -pix_fmt yuv420p \
  -crf 23 -preset slow -movflags +faststart strip.mp4
```

## How to check

1. `curl` the endpoint above: one item, with `videoUrl` and `imageUrl`.
2. Open the site at 1024 px wide or more: the strip plays, muted, and loops.
3. In the admin, turn the strip off (Active off). Reload: the strip is gone and the header has no empty gap.
4. In Safari, turn on Low Power Mode (or block autoplay): the poster shows.
