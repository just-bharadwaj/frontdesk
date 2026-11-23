import assert from 'node:assert/strict';
import {test} from 'node:test';
import {initial,freshConversation,respond} from '../web/engine.ts';
function run(turns){let s=structuredClone(initial),c=freshConversation();s.conversations.unshift(c);for(const text of turns)s=respond(s,c.id,text);return {s,c:s.conversations[0]}}
const identity='Alex Morgan, 1990-06-15';
test('booking is verified, confirmed and audited',()=>{const {s,c}=run(['book',identity,'s1','confirm']);assert.equal(c.status,'Booked');assert.equal(s.appointments.at(-1).slot,'s1');assert.deepEqual(c.trace.map(t=>t.tool),['find_patient','verify_identity','search_slots','book_appointment'])});
test('no booking without confirmation',()=>assert.equal(run(['book',identity,'s1','maybe']).c.stage,'confirm'));
test('wrong identity twice hands off without disclosure',()=>{const {c}=run(['refill','Alex Morgan, 1990-06-16','Other, 1990-06-15']);assert.equal(c.status,'Handed off');assert.equal(c.verified,false)});
test('emergency interrupts confirmation',()=>{const {c}=run(['book',identity,'s1','chest pain','confirm']);assert.equal(c.status,'Urgent handoff');assert.equal(c.trace.some(t=>t.tool==='book_appointment'),false)});
test('refill is a request only',()=>{const {c,s}=run(['refill',identity,'request refill']);assert.equal(c.status,'Needs review');assert.equal(s.refills.at(-1).status,'Needs review')});
test('reschedule cancels old appointment and books new slot',()=>{const {c,s}=run(['reschedule',identity,'s2','confirm']);assert.equal(c.status,'Rescheduled');assert.equal(s.appointments.find(a=>a.id==='alex-existing').status,'Cancelled')});
test('cancel operates on an existing visit',()=>{const {c,s}=run(['cancel',identity,'confirm cancel']);assert.equal(c.status,'Cancelled');assert.equal(s.appointments.find(a=>a.id==='alex-existing').status,'Cancelled')});
test('slot conflict reopens selection',()=>{const {s,c}=run(['book',identity,'s1','confirm']);let next=freshConversation();s.conversations.unshift(next);let d=s;for(const t of ['book',identity,'s1','confirm'])d=respond(d,next.id,t);assert.equal(d.conversations[0].stage,'slot');assert.equal(d.appointments.filter(a=>a.slot==='s1').length,1)});
