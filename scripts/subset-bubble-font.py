"""Reproduce the checked-in Baloo 2 Latin/Vietnamese variable subset.

Build-time tooling only: fonttools[woff]==4.57.0. Pass the upstream Baloo2[wght].ttf
as the single argument; the SHA-256 check prevents silently changing the face.
The character set retains Latin, Vietnamese, combining marks and UI symbols.
"""
from hashlib import sha256
from pathlib import Path
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

SOURCE_SHA256 = "d47a6852548059b1db49a1319d06d499d546c3fa2237cf9eee9c43c8abb025c2"
UNICODES = "U+D,U+20-7E,U+A0-FF,U+102-103,U+110-111,U+128-129,U+131,U+152-153,U+168-169,U+1A0-1A1,U+1AF-1B0,U+2BB-2BC,U+2C6,U+2DA,U+2DC,U+300-301,U+303-304,U+308-309,U+323,U+1EA0-1EF9,U+2009,U+200B,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2032-2033,U+2039-203A,U+2044,U+20AB-20AC,U+2122,U+2191,U+2193,U+2212,U+2215"

source = Path(sys.argv[1])
if sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
    raise ValueError("Unexpected Baloo 2 master; review the new face before regenerating")
font = TTFont(source, recalcTimestamp=False)
options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["*"]
options.name_IDs = ["*"]
options.name_languages = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
subsetter.subset(font)
font.recalcTimestamp = False
font.flavor = "woff2"
output = Path(__file__).resolve().parents[1] / "src/features/photobooth/components/shared/brand/assets/baloo-2-latin-vietnamese.woff2"
font.save(output)
print(f"{output.name}: {output.stat().st_size} bytes, {len(font.getBestCmap())} codepoints")
