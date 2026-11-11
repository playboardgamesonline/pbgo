# @pbgo/cities

The cities a member can say they live in (`docs/accounts.md`, "Profiles"). A static list searched in memory by the server (`searchCities`, `cityById`): no third party hears what a member types, nothing is loaded into the database, and the list never goes to a browser.

## Data and credit

The list is made from the places of GeoNames (https://www.geonames.org) with 5000 inhabitants and more, and the capitals and the seats of the first-level divisions, 64,674 places, 2.4 MB (`data/cities.json`).
GeoNames data is licensed under Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/): **this product includes data from GeoNames**, which is credited in the Terms of Use of the site (`/legal/terms`) and must stay credited wherever the list goes. The data is provided as is, without warranty of accuracy, timeliness or completeness.

## Making the list again

```bash
# in a fresh folder: cities5000.zip and admin1CodesASCII.txt from https://download.geonames.org/export/dump/
node packages/cities/scripts/build.mjs <cities5000.txt> <admin1CodesASCII.txt> packages/cities/data/cities.json [--min-population <n>]
```

The script only reads the two files. A new list changes the numbers of the places that a profile keeps (`profiles.city_id`): GeoNames keeps a number for a place for good, and `cityById` answers nothing for one that left the list, so a profile whose city did is shown with no city until the member picks another.
