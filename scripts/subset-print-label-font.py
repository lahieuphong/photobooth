"""Subset the static Newsreader 400 italic face used by the hero's fixed label.

Build-time tooling only: fonttools[woff]==4.57.0. The source is the Latin WOFF2
returned by next/font/google Newsreader({ weight: '400', style: 'italic' }).
The checksum pins the reviewed face; the ordinary Vietnamese display font is
still available for camera messages and other text.

Source: https://fonts.gstatic.com/s/newsreader/v26/cY9kfjOCX1hbuyalUrK439vogqC9yFZCYg7oRZaLP4obnf7fTXglsMwoT9ZHFjSShVCjzSY.woff2
"""
from hashlib import sha256
from pathlib import Path
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

SOURCE_SHA256 = "56febd06c694ba791028f22c659bc1f8c80954732a77db8d708432296268e163"
source = Path(sys.argv[1])
if sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
    raise ValueError("Unexpected Newsreader face; review before regenerating")
font = TTFont(source, recalcTimestamp=False)
options = subset.Options()
options.layout_features = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(text="Photobooth")
subsetter.subset(font)
font.flavor = "woff2"
output = Path(__file__).resolve().parents[1] / "src/features/photobooth/components/shared/brand/assets/newsreader-print-label.woff2"
font.save(output)
print(f"{output.name}: {output.stat().st_size} bytes")
