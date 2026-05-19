from PIL import Image
import base64, io

img = Image.open('equippe-mvp/public/logo-equipe.png')

for size in [512, 384, 256, 192, 128]:
    resized = img.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    resized.save(buf, format='PNG', optimize=True)
    b64_len = len(base64.b64encode(buf.getvalue()))
    svg_overhead = 350
    total_kb = (b64_len + svg_overhead) / 1024
    ok = "OK" if total_kb < 32 else "TOO BIG"
    print(f"{size}x{size}: PNG={buf.tell()/1024:.1f}KB, SVG~{total_kb:.1f}KB [{ok}]")
