import {createFamily,createSubject,createMemory,createStory} from "../lib/core/model.mjs";
export function makeSampleFamily(){
 const family=createFamily({id:"demo-family",name:"The Example Family"});
 const subjects=[createSubject({id:"alex",familyId:family.id,displayName:"Alex"}),createSubject({id:"morgan",familyId:family.id,displayName:"Morgan"})];
 const memories=[createMemory({id:"garden-photo",familyId:family.id,subjectIds:subjects.map(x=>x.id),kind:"photo"})];
 const stories=[createStory({id:"story-alex",familyId:family.id,memoryId:memories[0].id,contributorId:"relative-one",recordingId:"demo-audio-1"}),createStory({id:"story-morgan",familyId:family.id,memoryId:memories[0].id,contributorId:"relative-two",recordingId:"demo-audio-2"})];
 return {family,subjects,memories,stories};
}
