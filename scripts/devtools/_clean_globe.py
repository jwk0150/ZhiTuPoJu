from PIL import Image

src = r'c:\Users\Ibiza\Desktop\project\挑战杯\frontend\assets\brand\home-globe.png'
out = r'c:\Users\Ibiza\Desktop\project\挑战杯\frontend\assets\brand\home-globe-clean.png'
im = Image.open(src).convert('RGBA')
px = im.load()
w, h = im.size
print('corner', px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3])


def is_bg(r, g, b):
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    sat = max(r, g, b) - min(r, g, b)
    if lum > 210 and sat < 55:
        return True
    if lum > 230 and sat < 80:
        return True
    if r > 200 and g > 220 and b > 235 and sat < 70:
        return True
    return False


for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if is_bg(r, g, b):
            px[x, y] = (0, 0, 0, 0)
        else:
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            sat = max(r, g, b) - min(r, g, b)
            if lum > 185 and sat < 70:
                alpha = max(0, min(255, int((230 - lum) * 4)))
                px[x, y] = (r, g, b, alpha)

im.save(out, 'PNG')
print('saved', out)
