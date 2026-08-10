import sys, pymupdf
from PIL import Image, ImageChops

def page_img(d, i, dpi):
    pm = d[i].get_pixmap(dpi=dpi)
    im = Image.frombytes("RGB", (pm.width, pm.height), pm.samples)
    # trim white margins
    bg = Image.new("RGB", im.size, (255,255,255))
    diff = ImageChops.difference(im, bg).convert("L").point(lambda x: 255 if x > 40 else 0)
    bbox = diff.getbbox()
    if bbox:
        pad = 6
        im = im.crop((max(0,bbox[0]-pad), max(0,bbox[1]-pad),
                      min(im.width,bbox[2]+pad), min(im.height,bbox[3]+pad)))
    return im

def main():
    pdf, out, dpi, pages = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    idx = []
    for part in pages.split(","):
        if "-" in part:
            a,b = part.split("-"); idx += list(range(int(a)-1, int(b)))
        else:
            idx.append(int(part)-1)
    d = pymupdf.open(pdf)
    ims = [page_img(d, i, dpi) for i in idx]
    H = max(i.height for i in ims)
    ims = [i.resize((int(i.width*H/i.height), H)) for i in ims]
    W = sum(i.width for i in ims) + 10*(len(ims)-1)
    canvas = Image.new("RGB", (W, H), (255,255,255))
    x = 0
    for i in ims:
        canvas.paste(i, (x,0)); x += i.width + 10
    canvas.save(out)
    print(out, canvas.size, "pdfpages", [i+1 for i in idx], "total", d.page_count)

main()
