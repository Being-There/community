import test from "node:test";
import assert from "node:assert/strict";
import {createFamily,createSubject,createMemory,createStory,belongsToFamily} from "../lib/core/model.mjs";
test("several subjects belong to the same family",()=>{
 const family=createFamily({id:"family-example",name:"Sample family"});
 const a=createSubject({id:"a",familyId:family.id,displayName:"Alex"});
 const b=createSubject({id:"b",familyId:family.id,displayName:"Morgan"});
 const memory=createMemory({id:"m",familyId:family.id,subjectIds:[a.id,b.id],kind:"photo"});
 assert.deepEqual(memory.subjectIds,["a","b"]);
 assert.equal(belongsToFamily(memory,"other-family"),false);
 assert.equal(belongsToFamily(memory,family.id),true);
});
test("different contributors can preserve separate story versions",()=>{
 const base={familyId:"family-example",memoryId:"m"};
 const one=createStory({...base,id:"s1",contributorId:"alex",recordingId:"r1"});
 const two=createStory({...base,id:"s2",contributorId:"morgan",recordingId:"r2"});
 assert.notEqual(one.recordingId,two.recordingId);
 assert.throws(()=>createStory({...base,id:"s3",contributorId:"",recordingId:"r3"}));
});
test("invalid memory types and subjects are rejected",()=>{
 assert.throws(()=>createMemory({id:"m",familyId:"f",kind:"diagnosis"}));
 assert.throws(()=>createMemory({id:"m",familyId:"f",kind:"photo",subjectIds:[""]}));
});
