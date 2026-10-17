import assert from "node:assert/strict";
import {makeSampleFamily} from "../examples/sample-family.mjs";
const data=makeSampleFamily();
assert.equal(data.subjects.length,2);
assert.equal(data.memories.length,1);
assert.equal(data.stories.length,2);
assert(data.stories.every(story=>story.memoryId===data.memories[0].id));
process.stdout.write("Synthetic family fixture verified: 2 subjects, 1 memory, 2 story references.\n");
