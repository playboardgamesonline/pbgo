#!/usr/bin/env python3
"""Génère un dossier d'import Sanity (data.ndjson + images) avec familles, rôles, courtisans, missions et réglages.

Usage : python3 scripts/generer-seed-sanity.py <dossier-Assets> <dossier-sortie> [chemin-absolu-de-sortie-sur-le-mac]
Puis :  pnpm --filter studio exec sanity dataset import <dossier-sortie>/data.ndjson production --replace

Les images viennent de <Assets>/cartes (voir extraire-cartes.py) et <dossier-sortie>/images (pictos).
Les missions dont la règle n'est pas confirmée sont importées en brouillon (« drafts. ») pour vérification dans le Studio.
"""
import json
import shutil
import sys
from pathlib import Path

FAMILLES = [
    ("papillon", "Papillon", "#a3bcc2"),
    ("crapaud", "Crapaud", "#8d9431"),
    ("rossignol", "Rossignol", "#d2415e"),
    ("lievre", "Lièvre", "#f5b935"),
    ("cerf", "Cerf", "#0f8a69"),
    ("carpe", "Carpe", "#4a73b5"),
]
PLURIELS = {"papillon": "papillons", "crapaud": "crapauds", "rossignol": "rossignols", "lievre": "lièvres", "cerf": "cerfs", "carpe": "carpes"}
ROLES = [("noble", "Noble", "NOBLE"), ("espion", "Espion", "ESPION"), ("assassin", "Assassin", "ASSASSIN"), ("garde", "Garde", "GARDE")]
QUANTITES = {"BASE": 4, "GARDE": 3, "NOBLE": 4, "ASSASSIN": 2, "ESPION": 2}
ORDRE_MISSIONS = ["carpe", "cerf", "crapaud", "lievre", "papillon", "rossignol"]

PHRASES = [
    "L'homme qui sait courtiser est évidemment : {pseudo} ({points} pts)",
    "La Reine n'a d'yeux que pour {pseudo} ({points} pts)",
    "Toute la cour s'incline devant {pseudo} ({points} pts)",
    "Intrigues, poisons et révérences : {pseudo} triomphe ({points} pts)",
    "Ce soir, le banquet est donné en l'honneur de {pseudo} ({points} pts)",
    "Les murmures de la cour sont unanimes : {pseudo} ({points} pts)",
]


def condition(**champs):
    return {"_type": "condition", **champs}


def missions():
    liste = []
    for i, cle in enumerate(ORDRE_MISSIONS, 1):
        confirmee = cle == "papillon"
        liste.append({
            "fichier": f"MISSION_LIGHT_{i}.png", "couleur": "blanche", "confirmee": confirmee,
            "texte": f"Vous devez posséder moins de {PLURIELS[cle]} que votre voisin de gauche.",
            "condition": condition(type="comparaisonJoueurs", filtreFamille=cle, comparateur="lt", adversaire="voisinGauche", mode="cartes"),
        })
    for i, (role, nombre, nom) in enumerate([("espion", 3, "espions"), ("noble", 3, "nobles"), ("assassin", 2, "assassins"), ("garde", 4, "gardes")], 7):
        liste.append({
            "fichier": f"MISSION_LIGHT_{i}.png", "couleur": "blanche", "confirmee": True,
            "texte": f"Vous devez posséder au moins {nombre} {nom}.",
            "condition": condition(type="nombreCartesDomaine", filtreRole=role, comparateur="gte", valeur=nombre, mode="cartes"),
        })
    for i, cle in enumerate(ORDRE_MISSIONS, 1):
        liste.append({
            "fichier": f"MISSION_DARK_{i}.png", "couleur": "bleue", "confirmee": cle == "lievre",
            "texte": f"Les {PLURIELS[cle]} doivent être en disgrâce à la cour.",
            "condition": condition(type="statutFamille", famille=cle, statut="disgrace"),
        })
    reines = [
        ("Au moins 2 familles doivent être en disgrâce à la cour.", "disgrace", 2, True),
        ("Au moins 2 familles doivent être dans la lumière.", "lumiere", 2, False),
        ("Au moins 3 familles doivent être en disgrâce à la cour.", "disgrace", 3, False),
        ("Au moins 1 famille doit être neutre.", "neutre", 1, False),
    ]
    for i, (texte, statut, valeur, confirmee) in enumerate(reines, 7):
        liste.append({
            "fichier": f"MISSION_DARK_{i}.png", "couleur": "bleue", "confirmee": confirmee, "texte": texte,
            "condition": condition(type="nombreFamillesStatut", statut=statut, comparateur="gte", valeur=valeur),
        })
    return liste


def main(assets: Path, sortie: Path, base_absolue: str):
    images = sortie / "images"
    images.mkdir(parents=True, exist_ok=True)
    cartes = assets / "cartes"

    def image(nom_source: Path, nom: str | None = None):
        cible = images / (nom or nom_source.name)
        if nom_source.resolve() != cible.resolve():
            shutil.copyfile(nom_source, cible)
        return {"_type": "image", "_sanityAsset": f"image@file://{base_absolue}/images/{cible.name}"}

    docs = []
    for cle, nom, couleur in FAMILLES:
        docs.append({"_id": f"famille-{cle}", "_type": "famille", "nom": nom, "cle": cle, "couleur": couleur, "picto": image(images / f"picto-{cle}.png")})
    for cle, nom, _ in ROLES:
        docs.append({"_id": f"role-{cle}", "_type": "role", "nom": nom, "cle": cle, "picto": image(images / f"picto-{cle}.png")})

    for cle, _, _ in FAMILLES:
        for role_fichier, quantite in QUANTITES.items():
            role = next((r for r in ROLES if r[2] == role_fichier), None)
            doc = {
                "_id": f"courtisan-{role_fichier.lower()}-{cle}",
                "_type": "courtisan",
                "famille": {"_type": "reference", "_ref": f"famille-{cle}"},
                "carte": image(cartes / f"{role_fichier}_{cle.upper()}.png"),
                "quantite": quantite,
            }
            if role:
                doc["role"] = {"_type": "reference", "_ref": f"role-{role[0]}"}
            docs.append(doc)

    for m in missions():
        slug = m["fichier"].removesuffix(".png").lower().replace("_", "-")
        texte = m["texte"] if m["confirmee"] else f"[À vérifier] {m['texte']}"
        docs.append({
            "_id": slug if m["confirmee"] else f"drafts.{slug}",
            "_type": "mission",
            "couleur": m["couleur"],
            "texte": texte,
            "carte": image(cartes / m["fichier"]),
            "condition": m["condition"],
        })

    docs.append({
        "_id": "reglages",
        "_type": "reglages",
        "logo": image(assets / "logo.png"),
        "tapis": image(assets / "tapis.jpg"),
        "dosCourtisan": image(cartes / "DOS_COURTISAN.png"),
        "dosMissionBlanche": image(cartes / "DOS_MISSION_LIGHT.png"),
        "dosMissionBleue": image(cartes / "DOS_MISSION_DARK.png"),
        "phrasesVainqueur": PHRASES,
    })

    with open(sortie / "data.ndjson", "w", encoding="utf-8") as f:
        for doc in docs:
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
    print(f"{len(docs)} documents, {len(list(images.iterdir()))} images → {sortie}")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    sortie = Path(sys.argv[2])
    main(Path(sys.argv[1]), sortie, sys.argv[3] if len(sys.argv) == 4 else str(sortie.resolve()))
