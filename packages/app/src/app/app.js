import { createRecordingRecovery } from '/modules/recording-recovery.mjs';
const $ = id => document.getElementById(id);
let accountId, families = [], familyId, memories = [], people = [], contributorNames = new Map(), index = 0, recovery, recording;
const volatileRecordings = new Map();
let uploadAttempt, textAttempt;
let experience = 'family';
const params = new URL(location.href).searchParams;
if (params.has('invite')) { sessionStorage.setItem('pending-invitation', params.get('invite')); history.replaceState(null, '', '/'); }
const say = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error', error); };
const csrf = () => document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith('__Host-being-there-csrf='))?.split('=')[1];
async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, { method, credentials: 'same-origin', headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() ?? '', 'X-Being-There-Account': accountId ?? '' }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) });
  if (response.status === 401) { $('app').hidden = true; $('signin').hidden = false; throw new Error('Please sign in again. Pending recordings stay on this device.'); }
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(response.status === 403 ? 'Please sign in again before this protected action.' : data.error ?? 'That did not work. Please try again.'); }
  return response.status === 204 ? null : response.json();
}
async function run(action) { try { await action(); } catch (error) { say(error.message || 'That did not work. Please try again.', true); } }
const option = (value, label) => { const el = document.createElement('option'); el.value = value; el.textContent = label; return el; };
function current() { const selected = memories.filter(memory => !memory.hidden); return selected.length ? selected[index % selected.length] : null; }
function base() { return '/api/families/' + familyId; }
const blobBase64 = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Could not read this file.')); reader.readAsDataURL(blob); });
function textNode(tag, value) { const el = document.createElement(tag); el.textContent = value; return el; }
function setExperience(next) {
  experience = next === 'enjoy' ? 'enjoy' : 'family';
  document.body.classList.toggle('enjoy', experience === 'enjoy');
  $('family-view').setAttribute('aria-pressed', String(experience === 'family'));
  $('enjoy-view').setAttribute('aria-pressed', String(experience === 'enjoy'));
  $('view-description').textContent = experience === 'enjoy'
    ? 'Tablet view: enjoy any shared memory, listen, or tell a story. Nothing to answer.'
    : 'Family space: add memories and stories, and manage family access.';
  $('share-title').textContent = experience === 'enjoy' ? 'Tell a story, if you feel like it' : 'Add a story to this memory, if you like';
}
async function showMemory() {
  const memory = current(); $('viewer').hidden = !familyId; $('empty').hidden = Boolean(memory); $('photo').hidden = !memory || memory.mediaKind === 'video'; $('video').hidden = !memory || memory.mediaKind !== 'video'; $('next').disabled = !memory;
  $('memory-title').textContent = memory?.title || (memory ? 'A shared moment' : 'Your family memories');
  $('stories').replaceChildren(); $('story-text').value = '';
  if (!memory) { $('photo').removeAttribute('src'); $('video').removeAttribute('src'); $('video').hidden = true; return; }
  const imageUrl = base() + '/media/' + memory.originalIds[0];
  if (memory.mediaKind === 'video') {
    $('photo').removeAttribute('src'); $('photo').removeAttribute('srcset');
    $('video').src = imageUrl; $('video').setAttribute('aria-label', memory.title || 'Family video');
    $('video').load();
  } else {
    $('video').pause(); $('video').removeAttribute('src');
    const choices = new Map(); for (const rendition of memory.renditions ?? []) if (!choices.has(rendition.width)) choices.set(rendition.width, imageUrl + '?variant=' + rendition.name + ' ' + rendition.width + 'w'); $('photo').srcset = [...choices.values()].join(', '); $('photo').sizes = '(max-width: 700px) 100vw, 90vw'; $('photo').src = imageUrl; $('photo').alt = memory.title ? 'Shared photograph: ' + memory.title : 'A photograph shared with your family';
  }
  const { stories } = await api(base() + '/memories/' + memory.id + '/stories');
  if (!stories.length) $('stories').append(textNode('p', 'Enjoy this moment. There is no need to add anything.'));
  for (const story of stories) {
    const row = document.createElement('article'); row.className = 'story';
    const contributor = contributorNames.get(story.contributorId) || 'Family member';
    const speaker = story.speakerPersonId && people.find(person => person.id === story.speakerPersonId)?.displayName;
    row.append(textNode('strong', speaker ? speaker + ' · shared by ' + contributor : contributor));
    if (story.text) row.append(textNode('p', story.text));
    if (story.recordingId) { const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none'; audio.src = base() + '/media/' + story.recordingId; audio.setAttribute('aria-label', 'Listen to this family story'); row.append(audio); }
    $('stories').append(row);
  }
}
async function sameAccount() {
  const response = await fetch('/api/session', { credentials: 'same-origin' });
  const session = response.ok ? await response.json() : null;
  if (!session || session.accountId !== accountId) {
    recovery = null; $('app').hidden = true; $('signin').hidden = false;
    throw new Error('The signed-in account changed. Reload before opening local recordings. Saved recordings stay with their original account.');
  }
}
async function pendingRecordings() {
  $('pending').replaceChildren(); if (!recovery) return; await sameAccount();
  let stored = []; try { stored = await recovery.pendingRecordings(); } catch {}
  const all = new Map(stored.map(item => [item.id, item]));
  for (const item of volatileRecordings.values()) if (item.familyId === familyId && item.accountId === accountId) all.set(item.id, item);
  for (const item of all.values()) {
    const row = document.createElement('div'); row.append(textNode('p', volatileRecordings.has(item.id) ? 'This recording is kept in this page. Send it before closing the page.' : 'A recording is safely waiting on this device.'));
    const button = textNode('button', 'Send saved recording'); button.onclick = () => run(async () => { button.disabled = true; try { await sendRecording(item); } finally { button.disabled = false; } }); row.append(button); $('pending').append(row);
  }
}
async function sendRecording(item) {
  await sameAccount();
  if (!recovery || item.familyId !== familyId) throw new Error('Switch to the family this recording belongs to.');
  const result = await api(base() + '/memories/' + item.memoryId + '/stories', { method: 'POST', body: { id: item.id, text: item.text || '', base64: await blobBase64(item.blob), mimeType: item.mimeType, ...(item.speakerPersonId ? { speakerPersonId: item.speakerPersonId } : {}) } });
  if (result.durable !== true || result.storyId !== item.id || !result.recordingId) throw new Error('Recording acknowledgment was incomplete. Your local copy is retained.');
  await recovery.removeRecording(item.id); volatileRecordings.delete(item.id); await pendingRecordings(); await showMemory(); say('Your story is preserved.');
}
async function loadFamily() {
  familyId = $('family').value; index = 0; $('no-family').hidden = Boolean(familyId); $('experience').hidden = !familyId;
  $('contribute').hidden = !familyId; $('organizer').hidden = families.find(row => row.id === familyId)?.role !== 'organizer';
  if (!familyId) { $('viewer').hidden = true; return; }
  const results = await Promise.all([api(base() + '/memories'), api(base() + '/people'), api(base() + '/contributors')]);
  memories = results[0].memories; people = results[1].people; contributorNames = new Map(results[2].contributors.map(row => [row.id, row.displayName]));
  $('speaker').replaceChildren(option('', 'The signed-in family contributor'), ...people.map(row => option(row.id, row.displayName || 'Person')));
  $('account-note').textContent = 'Signed in as a family ' + (families.find(row => row.id === familyId)?.role || 'member') + '. Profiles are not login accounts.';
  $('upload-people').replaceChildren(...people.map(row => option(row.id, row.displayName || 'Person')));
  $('record').disabled = false;
  try { recovery = createRecordingRecovery({ familyId, accountId }); await pendingRecordings(); }
  catch { recovery = null; $('record').disabled = true; $('pending').textContent = 'Local recording recovery is unavailable in this browser. You can still enjoy memories and share words.'; }
  await showMemory(); await loadTools();
}
async function loadTools() {
  if ($('organizer').hidden) return;
  const { members } = await api(base() + '/members'); $('members').replaceChildren(textNode('h3', 'Family access'));
  for (const member of members.filter(row => row.state === 'active')) { const row = document.createElement('p'); row.append(document.createTextNode((member.email || 'Family member') + ' · ' + member.role + ' ')); const button = textNode('button', 'Revoke future access'); button.onclick = () => run(async () => { if (!confirm('Revoke this person’s future access? Their original contributions stay preserved.')) return; await api(base() + '/members/' + member.accountId + '/revoke', { method: 'POST' }); await init(); }); row.append(button); $('members').append(row); }
  const { invitations } = await api(base() + '/invitations'); $('invitations').replaceChildren(textNode('h3', 'Pending invitations'));
  for (const invitation of invitations.filter(row => row.state === 'pending' && row.expiresAt > Date.now())) { const row = document.createElement('p'); row.append(document.createTextNode(invitation.email + ' · ' + invitation.role + ' ')); const button = textNode('button', 'Revoke invitation'); button.onclick = () => run(async () => { await api(base() + '/invitations/' + invitation.id + '/revoke', { method: 'POST' }); await loadTools(); }); row.append(button); $('invitations').append(row); }
}
async function previewInvitation() {
  const token = sessionStorage.getItem('pending-invitation'); $('invitation').hidden = !token;
  if (!token) return;
  const value = await api('/api/invitations/preview', { method: 'POST', body: { token } });
  $('invite-description').textContent = 'Join “' + value.family.label + '” as ' + value.role + '. This grants access to private family memories and contributions. Accept only if this is the family you intended to join.';
}
async function init() {
  const response = await fetch('/api/session', { credentials: 'same-origin' });
  if (!response.ok) { $('signin').hidden = false; $('logout').hidden = true; $('app').hidden = true; say('Sign in to open your private family memories.'); return; }
  accountId = (await response.json()).accountId; $('signin').hidden = true; $('logout').hidden = false; $('app').hidden = false;
  const result = await api('/api/families'); families = result.families; $('family').replaceChildren(...families.map(row => option(row.id, row.label)));
  if (families.some(row => row.id === familyId)) $('family').value = familyId;
  await loadFamily(); await previewInvitation(); say(families.length ? 'Choose a memory and enjoy it at your own pace.' : 'A private invitation is needed.');
}
$('accept-invite').onclick = () => run(async () => { await api('/api/invitations/accept', { method: 'POST', body: { token: sessionStorage.getItem('pending-invitation'), displayName: $('nickname').value || 'Family member' } }); sessionStorage.removeItem('pending-invitation'); await init(); say('Welcome. Your family memories are private.'); });
$('family-view').onclick = () => setExperience('family');
$('enjoy-view').onclick = () => run(async () => { setExperience('enjoy'); await showMemory(); $('memory-title').focus(); });
$('family').onchange = () => run(loadFamily);

$('next').onclick = () => run(async () => { index++; await showMemory(); $('memory-title').focus(); });
$('person-form').onsubmit = event => { event.preventDefault(); run(async () => { await api(base() + '/people', { method: 'POST', body: { id: crypto.randomUUID(), displayName: $('person-name').value } }); $('person-name').value = ''; await loadFamily(); say('Person added. A profile does not grant account access.'); }); };
$('upload').onsubmit = event => { event.preventDefault(); run(async () => { const file = $('file').files[0]; if (!file || file.size > 14 * 1024 * 1024) throw new Error('Choose a JPEG, PNG, WebP, MP4 or WebM file no larger than 14 MB.'); const mimeType = ['video/mp4', 'video/webm'].includes(file.type) ? file.type : null; if (!mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Unsupported photo or video format.'); const button = $('upload').querySelector('button'); button.disabled = true; try { const personIds = [...$('upload-people').selectedOptions].map(row => row.value); const signature = JSON.stringify([familyId, $('caption').value, personIds]); if (!uploadAttempt || uploadAttempt.file !== file || uploadAttempt.signature !== signature) uploadAttempt = { id: crypto.randomUUID(), file, signature }; const result = await api(base() + '/contributions', { method: 'POST', body: { id: uploadAttempt.id, title: $('caption').value, personIds, base64: await blobBase64(file), ...(mimeType ? { mimeType } : {}) } }); if (!result.durable) throw new Error('The original was not acknowledged. Please try again.'); uploadAttempt = null; $('upload').reset(); await loadFamily(); say((mimeType ? 'Video' : 'Photograph') + ' shared. The exact original is preserved.'); } finally { button.disabled = false; } }); };
$('share-text').onclick = () => run(async () => { const memory = current(); if (!memory || !$('story-text').value.trim()) return; const signature = JSON.stringify([familyId, memory.id, $('story-text').value, $('speaker').value]); if (!textAttempt || textAttempt.signature !== signature) textAttempt = { id: crypto.randomUUID(), signature }; const saved = await api(base() + '/memories/' + memory.id + '/stories', { method: 'POST', body: { id: textAttempt.id, text: $('story-text').value, ...($('speaker').value ? { speakerPersonId: $('speaker').value } : {}) } }); if (!saved.durable || saved.storyId !== textAttempt.id) throw new Error('The contribution was not durably acknowledged.'); textAttempt = null; await showMemory(); say('Your words are preserved as a separate contribution.'); });
$('invite-form').onsubmit = event => { event.preventDefault(); run(async () => { const invitation = await api(base() + '/invitations', { method: 'POST', body: { email: $('invite-email').value, role: $('invite-role').value } }); $('invite-link').value = location.origin + '/?invite=' + invitation.token; $('invite-link-label').hidden = false; await loadTools(); say('Copy the private invitation link and share it with the intended person.'); }); };
$('export').onclick = () => run(async () => { const value = await api(base() + '/exports', { method: 'POST' }); const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'being-there-private-archive.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); say('Verified archive prepared. Keep the downloaded file private.'); });
$('record').onclick = () => run(async () => {
  await sameAccount();
  const memory = current(); if (!memory || !recovery) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Recording is unavailable in this browser. You can still share words.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) { stream.getTracks().forEach(track => track.stop()); throw new Error('This browser cannot save a supported audio recording.'); }
  const recorder = new MediaRecorder(stream, { mimeType }); const chunks = []; const scopedRecovery = recovery;
  const item = { id: crypto.randomUUID(), familyId, accountId, memoryId: memory.id, mimeType, text: '', ...($('speaker').value ? { speakerPersonId: $('speaker').value } : {}) }; let save = Promise.resolve();
  recorder.ondataavailable = event => { if (!event.data.size) return; chunks.push(event.data); const snapshot = { ...item, blob: new Blob(chunks, { type: mimeType }) }; volatileRecordings.set(item.id, snapshot); save = save.catch(() => {}).then(() => scopedRecovery.saveRecording(snapshot)); };
  recording = { recorder, stream, done: null };
  recording.done = new Promise(resolve => { recorder.onstop = async () => { stream.getTracks().forEach(track => track.stop()); try { await save; volatileRecordings.delete(item.id); $('record-status').textContent = 'Your recording is saved on this device. Send it when you are ready.'; } catch { say('Local recovery could not be saved. Keep this page open and try again.', true); } finally { recording = null; $('record').hidden = false; $('stop').hidden = true; for (const key of ['family', 'speaker', 'next']) $(key).disabled = false; try { await pendingRecordings(); } catch (error) { say(error.message, true); } resolve(); } }; });
  recorder.start(5000); $('record').hidden = true; $('stop').hidden = false; for (const key of ['family', 'speaker', 'next']) $(key).disabled = true;
  $('record-status').textContent = 'Recording. Take your time. Finish whenever you like.';
});
$('stop').onclick = () => { if (recording && recording.recorder.state !== 'inactive') recording.recorder.stop(); };
$('logout').onclick = () => run(async () => { if (recording) { const done = recording.done; recording.recorder.stop(); await done; } await api('/api/session/logout', { method: 'POST' }); recovery = null; $('photo').removeAttribute('src'); $('video').pause(); $('video').removeAttribute('src'); $('stories').replaceChildren(); setExperience('family'); await init(); });
window.addEventListener('pagehide', () => { if (recording?.recorder.state === 'recording') recording.recorder.stop(); });
run(init);
