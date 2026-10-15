import assert from "node:assert/strict";
import test from "node:test";
import {
 normalizedArtistEmail,validArtistEmail,artistCanAccess,artistCanSeePreview
} from "../lib/artist-access-policy.ts";
test("email normalization and validation",()=>{
 assert.equal(normalizedArtistEmail("  Artist@Example.COM "), "artist@example.com");
 assert.equal(validArtistEmail("  Artist@Example.COM "),true);
 assert.equal(validArtistEmail("invalid"),false);
 assert.equal(validArtistEmail("a".repeat(255)+"@example.com"),false);
});
test("artist revocation and verification",()=>{
 assert.equal(artistCanAccess(true,true,false),true);
 assert.equal(artistCanAccess(false,true,false),false);
 assert.equal(artistCanAccess(true,false,false),false);
 assert.equal(artistCanAccess(true,true,true),false);
});
test("previews require artist ownership and published state",()=>{
 assert.equal(artistCanSeePreview("artist-a","artist-a","ready"),true);
 assert.equal(artistCanSeePreview("artist-a","artist-b","ready"),false);
 assert.equal(artistCanSeePreview("artist-a","artist-a","draft"),false);
 assert.equal(artistCanSeePreview("artist-a","artist-a","withdrawn"),false);
 assert.equal(artistCanSeePreview("artist-a","artist-a","approved"),true);
});
