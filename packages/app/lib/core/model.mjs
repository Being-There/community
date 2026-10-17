/** Provider-independent, synthetic-safe domain primitives. No network or storage dependencies. */
export function createFamily({id,name}) {
  requireText(id,"family id"); requireText(name,"family name");
  return Object.freeze({id,name});
}
export function createSubject({id,familyId,displayName}) {
  requireText(id,"subject id"); requireText(familyId,"family id"); requireText(displayName,"display name");
  return Object.freeze({id,familyId,displayName});
}
export function createMemory({id,familyId,subjectIds=[],kind}) {
  requireText(id,"memory id"); requireText(familyId,"family id");
  if (!["photo","video","audio","text"].includes(kind)) throw new Error("Unsupported memory kind");
  if (!Array.isArray(subjectIds) || subjectIds.some(x=>typeof x!=="string"||!x.trim())) throw new Error("Invalid subjects");
  return Object.freeze({id,familyId,subjectIds:Object.freeze([...new Set(subjectIds)]),kind});
}
export function createStory({id,familyId,memoryId,contributorId,recordingId}) {
  for(const [key,value] of Object.entries({id,familyId,memoryId,contributorId,recordingId})) requireText(value,key);
  return Object.freeze({id,familyId,memoryId,contributorId,recordingId});
}
export function belongsToFamily(record,familyId) {
  return typeof familyId==="string" && familyId.length>0 && record?.familyId===familyId;
}
function requireText(value,name) {if(typeof value!=="string"||!value.trim()) throw new Error("Missing "+name);}
