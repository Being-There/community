import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../prototypes/family-journey.html",import.meta.url),"utf8");

test("prototype cannot fetch external resources or persist family content",()=>{
  assert.match(html,/default-src 'none'/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.doesNotMatch(html,/<(?:script|img|iframe)[^>]+src\s*=/i);
  assert.doesNotMatch(html,/<link[^>]+href\s*=/i);
  assert.doesNotMatch(html,/\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|mediaDevices|sendBeacon)\b/);
});
test("every audience has an interactive, clearly simulated journey",()=>{
  assert.match(html,/data-view="organizer"/);
  assert.match(html,/data-view="contributor"/);
  assert.match(html,/data-view="person"/);
  assert.match(html,/No sign-in, invites, recording, uploads, storage, or network access/);
  assert.match(html,/No audio exists in this prototype/);
  assert.match(html,/id="listen">Read a sample story<\/button>/);
  assert.doesNotMatch(html,/id="listen">Listen to the story<\/button>/);
  assert.match(html,/Just enjoy this one/);
});
test("invents names and avoids a fixed clinical or kinship role",()=>{
  for(const name of ["Avery","Riley","Casey"]) assert.match(html,new RegExp(name));
  assert.match(html,/No medical labels or family roles are required/);
  assert.match(html,/no account required for a profile/);
  assert.doesNotMatch(html,/\/api\//);
});
test("has basic accessibility markers for manual follow-up testing",()=>{
  assert.match(html,/Skip to experience/);
  assert.match(html,/aria-current="page"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/prefers-reduced-motion/);
});

test("navigation moves focus to visible section and step headings",()=>{
  for(const id of ["organizer-title","contributor-title","person-title"]) assert.match(html,new RegExp('id="'+id+'" tabindex="-1"'));
  assert.match(html,/\[data-step\]:not\(\[hidden\]\) h1/);
  assert.match(html,/\[data-step\]:not\(\[hidden\]\) h2/);
  assert.match(html,/\?\.focus\(\)/);
});
test("each fictional memory uses matching visual art",()=>{
  assert.match(html,/id="park-art"/);
  assert.match(html,/Illustration of a park with a winding path, hills, trees, and birds/);
  assert.match(html,/toggleAttribute\('hidden',memory===1\)/);
  assert.match(html,/toggleAttribute\('hidden',memory!==1\)/);
  assert.match(html,/\.visual svg\[hidden\]\{display:none!important\}/);
});
