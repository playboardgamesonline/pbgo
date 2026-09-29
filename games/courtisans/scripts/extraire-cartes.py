#!/usr/bin/env python3
"""Extrait une image PNG par carte distincte depuis le PDF d'impression (materiel.pdf).

Usage : python3 scripts/extraire-cartes.py <materiel.pdf> <dossier-de-sortie>
Dépendances : poppler (pdfimages), Pillow, numpy
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

FAMILLES = ["PAPILLON", "CARPE", "LIEVRE", "ROSSIGNOL", "CERF", "CRAPAUD"]
ROLES = ["BASE"] * 4 + ["GARDE"] * 3 + ["NOBLE"] * 4 + ["ASSASSIN"] * 2 + ["ESPION"] * 2

# Lignes de coupe (pixels à 200 dpi) déduites des croix de coupe
COURTISAN = {"x": [70, 589, 1109], "y": [256, 1192], "taille": (472, 890)}
MISSION = {"x": [112, 852], "y": [186, 691, 1195, 1699], "taille": (688, 452)}


def cellules(page: Image.Image, grille):
    w, h = grille["taille"]
    return [page.crop((x, y, x + w, y + h)) for y in grille["y"] for x in grille["x"]]


def distance(a: Image.Image, b: Image.Image) -> float:
    return float(np.abs(np.asarray(a, dtype=int) - np.asarray(b, dtype=int)).mean())


def main(pdf: Path, sortie: Path):
    sortie.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdfimages", "-j", str(pdf), f"{tmp}/p"], check=True)
        pages = [Image.open(f).convert("RGB") for f in sorted(Path(tmp).glob("p-*.jpg"))]

    courtisans = [c for page in pages[:15] for c in cellules(page, COURTISAN)]
    assert len(courtisans) == 90

    groupes: dict[str, list[Image.Image]] = {}
    for i, carte in enumerate(courtisans):
        groupes.setdefault(f"{ROLES[i % 15]}_{FAMILLES[i // 15]}", []).append(carte)

    for nom, cartes in groupes.items():
        cartes[0].save(sortie / f"{nom}.png", optimize=True)
        ecart = max((distance(cartes[0], c) for c in cartes[1:]), default=0)
        print(f"{nom}.png  ({len(cartes)} ex., écart max entre exemplaires : {ecart:.1f})")

    cellules(pages[15], COURTISAN)[0].save(sortie / "DOS_COURTISAN.png", optimize=True)

    mission_pages = [cellules(pages[i], MISSION) for i in (16, 17, 18, 19, 20, 21)]
    light = mission_pages[0] + mission_pages[2][:2]
    dark = mission_pages[2][2:] + mission_pages[4][:4]
    for prefixe, cartes in (("MISSION_LIGHT", light), ("MISSION_DARK", dark)):
        for n, carte in enumerate(cartes, 1):
            carte.save(sortie / f"{prefixe}_{n}.png", optimize=True)
        print(f"{prefixe}_1..{len(cartes)}.png")
    mission_pages[1][0].save(sortie / "DOS_MISSION_LIGHT.png", optimize=True)
    mission_pages[3][2].save(sortie / "DOS_MISSION_DARK.png", optimize=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
