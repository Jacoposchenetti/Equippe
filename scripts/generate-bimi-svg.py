"""
Genera un file SVG Tiny PS conforme allo standard BIMI
a partire dal logo PNG di Equipe.

BIMI SVG Tiny PS requirements:
- SVG Tiny 1.2 profile
- Deve contenere il baseProfile="tiny-ps"
- Deve avere un viewBox quadrato
- L'immagine va embeddata come base64 dentro l'SVG
- Niente script, niente link esterni
- Title obbligatorio
"""

import base64
import io
import sys
from pathlib import Path
from PIL import Image

def png_to_bimi_svg(input_png: str, output_svg: str, max_size: int = 256):
    """Converte un PNG in SVG Tiny PS per BIMI, ridimensionando se necessario."""
    
    png_path = Path(input_png)
    if not png_path.exists():
        print(f"Errore: file {input_png} non trovato")
        sys.exit(1)
    
    # Apri e ridimensiona il PNG per stare sotto i 32KB
    img = Image.open(png_path)
    if img.size[0] > max_size or img.size[1] > max_size:
        img = img.resize((max_size, max_size), Image.LANCZOS)
        print(f"   Ridimensionato a {max_size}x{max_size}")
    
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    png_data = buf.getvalue()
    
    b64 = base64.b64encode(png_data).decode("ascii")
    
    # Genera SVG Tiny PS conforme a BIMI
    # Requisiti: https://bimigroup.org/implementation-guide/
    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.2" baseProfile="tiny-ps"
     xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 1024 1024"
     width="1024" height="1024">
  <title>Equipe</title>
  <image x="0" y="0" width="1024" height="1024"
         href="data:image/png;base64,{b64}" />
</svg>'''
    
    output_path = Path(output_svg)
    output_path.write_text(svg_content, encoding="utf-8")
    
    size_kb = output_path.stat().st_size / 1024
    print(f"✅ SVG BIMI generato: {output_svg}")
    print(f"   Dimensione: {size_kb:.1f} KB")
    
    if size_kb > 32:
        print(f"   ⚠️  Il file supera i 32 KB raccomandati ({size_kb:.1f} KB)")
        print(f"      Alcuni provider potrebbero non accettarlo.")
        print(f"      Considera di ridimensionare il PNG prima della conversione.")
    else:
        print(f"   ✅ Dimensione entro i limiti raccomandati (< 32 KB)")


if __name__ == "__main__":
    input_file = "equippe-mvp/public/logo-equipe.png"
    output_file = "equippe-mvp/public/bimi-logo.svg"
    
    png_to_bimi_svg(input_file, output_file)
