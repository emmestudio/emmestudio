# Emme Label

Public entry: label.html. Artist profiles: label-artista.html?artista=SLUG.
Official supplied logos are preserved unmodified in assets/emme-label-*.png.
The roster is intentionally empty pending confirmation of members. Do not infer membership from studio clients or collaborators.

Add confirmed artists to label-artists.json using this schema:

```json
[{"slug":"artist-name","name":"Artist Name","published":true,"photo":"assets/label/artist.jpg","tagline":"Short description","bio":["Biography paragraph"],"links":[{"label":"Spotify","url":"https://open.spotify.com/artist/VERIFIED_ID"}]}]
```

Use approved photos, biographies, and exact verified links. Publication generates the roster card and its profile from the same record. External links stay separate from the card's profile link. Keep unpublished entries with published:false. Profiles are noindex until dedicated canonical artist routes are introduced.
