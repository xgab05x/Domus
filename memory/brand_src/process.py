from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC = "/tmp/brand"
OUT = "/app/frontend/public/brand"


def knock_out_black(path, out, max_w=640, thresh=110, global_dark=False):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    marker = im.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for s in seeds:
        if sum(marker.getpixel(s)) < thresh:
            ImageDraw.floodfill(marker, s, (255, 0, 255), thresh=thresh)
    arr = np.asarray(im).astype(np.float32)
    mk = np.asarray(marker)
    bg = (mk[..., 0] == 255) & (mk[..., 1] == 0) & (mk[..., 2] == 255)
    mx = arr.max(axis=2)
    if global_dark:
        bg = bg | (mx < 48)
    alpha_lum = np.clip((mx - 6.0) / 60.0, 0, 1)
    alpha = np.where(bg, alpha_lum, 1.0)
    # soften edge by blurring the hard mask slightly and taking the max with lum alpha
    soft = Image.fromarray((np.where(bg, 0, 255)).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    soft = np.asarray(soft).astype(np.float32) / 255.0
    alpha = np.clip(np.maximum(alpha * (bg == 0) + alpha_lum * bg, soft * (bg == 0) + np.minimum(soft, alpha_lum) * bg), 0, 1)
    # un-premultiply dark fringe pixels
    a_safe = np.clip(alpha, 0.05, 1.0)[..., None]
    rgb = np.clip(arr / a_safe, 0, 255)
    rgb = np.where(alpha[..., None] < 0.999, rgb, arr)
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    res = Image.fromarray(rgba, "RGBA")
    a = rgba[..., 3]
    ys, xs = np.where(a > 12)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    pad = int(0.04 * max(x1 - x0, y1 - y0))
    res = res.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))
    if res.width > max_w:
        res = res.resize((max_w, int(res.height * max_w / res.width)), Image.LANCZOS)
    res.save(out, "PNG", optimize=True)
    print(out, res.size)


def crop_banner(path, out, max_w=1600, thresh=28):
    im = Image.open(path).convert("RGB")
    arr = np.asarray(im)
    lum = arr.max(axis=2)
    rows = np.where((lum > thresh).mean(axis=1) > 0.02)[0]
    cols = np.where((lum > thresh).mean(axis=0) > 0.02)[0]
    y0, y1, x0, x1 = rows.min(), rows.max(), cols.min(), cols.max()
    res = im.crop((x0, y0, x1 + 1, y1 + 1))
    if res.width > max_w:
        res = res.resize((max_w, int(res.height * max_w / res.width)), Image.LANCZOS)
    res.save(out, "WEBP", quality=86, method=6)
    print(out, res.size, "crop box", (x0, y0, x1, y1))


knock_out_black(f"{SRC}/sol_logo.webp", f"{OUT}/sol.png", global_dark=True)
knock_out_black(f"{SRC}/term_logo.webp", f"{OUT}/terminus.png")
crop_banner(f"{SRC}/sol_banner.webp", f"{OUT}/sol-banner.webp")
crop_banner(f"{SRC}/term_banner.webp", f"{OUT}/terminus-banner.webp")
