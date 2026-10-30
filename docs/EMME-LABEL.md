# Emme Label

Public entry: label.html. Artist profiles: label-artista.html?artista=SLUG.
Official supplied logos are preserved unmodified in assets/emme-label-*.png.
The roster is intentionally empty pending confirmation of members. Do not infer membership from studio clients or collaborators.

Add confirmed artists to label-artists.json using this schema:

```json
[{"slug":"artist-name","name":"Artist Name","published":true,"photo":"assets/label/artist.jpg","tagline":"Short description","bio":["Biography paragraph"],"links":[{"label":"Spotify","url":"https://open.spotify.com/artist/VERIFIED_ID"}]}]
```

Use approved photos, biographies, and exact verified links. Publication generates the roster card and its profile from the same record. External links stay separate from the card's profile link. Keep unpublished entries with published:false. Profiles are noindex until dedicated canonical artist routes are introduced.

## Catalogue and artist pages

Moody now has a static canonical page at label-moody.html with full biography, social links, OG metadata and JSON-LD. The previous query URL forwards to it. Update the static page alongside the corresponding artist record when changing approved copy.

label-releases.json intentionally contains no releases until the owner confirms the Emme Label catalogue. Use records shaped as follows:

```json
[{"published":true,"artistSlug":"moody","artistName":"MOODY","title":"Approved title","type":"Singolo","date":"2027-01-01","cover":"assets/releases/approved-cover.jpg","links":[{"label":"Ascolta","url":"https://verified-release-url.example"}]}]
```

Do not mark upcoming releases as already available; use an appropriate pre-save link label. Confirm inclusion in the Label catalogue with the owner. The artist player represents the artist's broader Spotify catalogue, not Label ownership. No Spotify iframe or request is made before the visitor activates the player. No consent is persisted. The contact links use the existing studio mailbox with separate subjects for collaboration, press and proposals; there is no new form or personal data database.

Sharing images: assets/label-share.png and assets/label-moody-share.png (1200×630). Public canonical pages are listed in sitemap.xml; legacy query page stays noindex.
