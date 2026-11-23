export type Trace={tool:string;status:string;detail:string;time:string};
export type Message={role:'assistant'|'user';text:string};
export type Conversation={id:string;name:string;intent:string;status:string;verified:boolean;failures:number;stage:string;messages:Message[];trace:Trace[];selected?:string;created:string};
export type Appointment={id:string;name:string;time:string;type:string;provider:string;status:string;date:string;slot?:string};
export type Refill={id:string;name:string;medication:string;status:string};
export type Store={conversations:Conversation[];appointments:Appointment[];refills:Refill[]};
export const today=new Date().toISOString().slice(0,10);
export function futureDate(n:number){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
export const slots=[{id:'s1',date:futureDate(2),time:'09:00 AM',provider:'Dr. Maya Chen'},{id:'s2',date:futureDate(2),time:'10:30 AM',provider:'Dr. Maya Chen'},{id:'s3',date:futureDate(3),time:'02:00 PM',provider:'Dr. James Wilson'}];
export const initial:Store={conversations:[
{id:'c100',name:'Olivia Martinez',intent:'Appointment',status:'Booked',verified:true,failures:0,stage:'done',created:'09:42 AM',messages:[{role:'user',text:'I’d like to schedule a follow-up.'},{role:'assistant',text:'Your identity has been verified and your follow-up is booked.'}],trace:[{tool:'find_patient',status:'success',detail:'Synthetic patient matched',time:'09:41:02'},{tool:'verify_identity',status:'success',detail:'Name and date of birth verified',time:'09:41:20'},{tool:'search_slots',status:'success',detail:'3 available slots returned',time:'09:41:21'},{tool:'book_appointment',status:'success',detail:'Follow-up booked',time:'09:42:00'}]},
{id:'c101',name:'Noah Williams',intent:'Refill request',status:'Needs review',verified:true,failures:0,stage:'done',created:'09:35 AM',messages:[{role:'user',text:'Please request a refill.'},{role:'assistant',text:'Your refill request is with the care team. It has not been approved.'}],trace:[{tool:'verify_identity',status:'success',detail:'Identity verified',time:'09:34:12'},{tool:'request_refill',status:'success',detail:'Request routed to staff, not approved',time:'09:35:00'}]},
{id:'c102',name:'Unverified visitor',intent:'Clinical question',status:'Handed off',verified:false,failures:0,stage:'done',created:'09:18 AM',messages:[{role:'user',text:'Can I change my dose?'},{role:'assistant',text:'I can’t provide medical advice. I’ve routed your question to clinic staff.'}],trace:[{tool:'handoff_to_staff',status:'success',detail:'Clinical question; no advice given',time:'09:18:00'}]},
],appointments:[{id:'a1',name:'Olivia Martinez',time:'09:00 AM',type:'Follow-up',provider:'Dr. Maya Chen',status:'Confirmed',date:today},{id:'a2',name:'Ethan Parker',time:'09:30 AM',type:'Annual wellness',provider:'Dr. James Wilson',status:'Checked in',date:today},{id:'a3',name:'Sophia Lee',time:'10:15 AM',type:'Consultation',provider:'Dr. Maya Chen',status:'Confirmed',date:today},{id:'a4',name:'Liam Johnson',time:'11:00 AM',type:'Follow-up',provider:'Dr. James Wilson',status:'Confirmed',date:today},{id:'a5',name:'Ava Thompson',time:'11:30 AM',type:'Annual wellness',provider:'Dr. Maya Chen',status:'Pending',date:today},{id:'alex-existing',name:'Alex Morgan',time:'03:00 PM',type:'Follow-up',provider:'Dr. Maya Chen',status:'Confirmed',date:futureDate(7)}],refills:[{id:'r1',name:'Noah Williams',medication:'Lisinopril 10 mg',status:'Needs review'}]};
export function freshConversation():Conversation{return {id:crypto.randomUUID(),name:'Unverified visitor',intent:'General inquiry',status:'In progress',verified:false,failures:0,stage:'intent',created:new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}),messages:[{role:'assistant',text:'Hi! I’m FrontDesk, your clinic’s virtual assistant. I can help schedule a visit, manage an appointment, or send a refill request. What can I help with?'}],trace:[]}}
export function respond(store:Store,id:string,input:string):Store{
const s=structuredClone(store),c=s.conversations.find(x=>x.id===id)!;c.messages.push({role:'user',text:slots.some(x=>x.id===input)?(()=>{const slot=slots.find(x=>x.id===input)!;return slot.date+' at '+slot.time})():input});
const say=(text:string)=>c.messages.push({role:'assistant',text});
const log=(tool:string,detail:string,status='success')=>c.trace.push({tool,detail,status,time:new Date().toLocaleTimeString()});
const t=input.toLowerCase();
if(/chest pain|can't breathe|cannot breathe|stroke|suicid|severe bleeding/.test(t)){c.status='Urgent handoff';c.stage='done';log('handoff_to_staff','Emergency language detected; workflow stopped');say('If this may be an emergency, call 911 now. I can’t provide emergency care. I’ve flagged this conversation for staff; don’t wait for their response.');return s}
if(/ignore.*rules|list all patients|system prompt|bypass/.test(t)){say('I can only help with your own appointments and refill requests after identity verification. I can’t disclose patient lists or bypass verification.');return s}
if(/double.*dose|change.*dose|diagnos|medical advice|side effect/.test(t)){c.status='Handed off';c.stage='done';log('handoff_to_staff','Clinical question; no medical advice');say('I can’t advise on medication changes or clinical concerns. I’ve routed your question to clinic staff.');return s}
if(c.stage==='done'){say('This conversation is complete. Start a new chat for another request.');return s}
if(c.stage==='intent'){
c.intent=/refill|medication/.test(t)?'Refill request':/reschedul|move/.test(t)?'Reschedule':/cancel/.test(t)?'Cancel appointment':'Appointment';c.stage='verify';say('First, please enter your full name and date of birth (YYYY-MM-DD). For this demo, use Alex Morgan, 1990-06-15.');return s}
if(c.stage==='verify'){
log('find_patient','Identity lookup performed; no record disclosed');
if(!(/^alex morgan[,]?\s+1990-06-15$/.test(t.trim()))){c.failures++;log('verify_identity','Identity did not match','blocked');if(c.failures>=2){c.stage='done';c.status='Handed off';log('handoff_to_staff','Two failed verification attempts');say('I couldn’t verify your identity. I’ve routed this to staff without revealing patient information.')}else say('Those details didn’t match. Please try your full name and date of birth once more.');return s}
c.name='Alex Morgan';c.verified=true;log('verify_identity','Name + DOB matched synthetic record');
if(c.intent==='Refill request'){c.stage='refill';say('Thanks, Alex. Your demo medication is Lisinopril 10 mg. Send “request refill” to send a request to staff. This is not a prescription approval.')}
else if(c.intent==='Cancel appointment'){c.stage='cancel';say('Please confirm: cancel your existing demo follow-up appointment? Reply “confirm cancel”.')}
else {if(c.intent==='Reschedule'&&!s.appointments.some(a=>a.name===c.name&&a.status!=='Cancelled')){c.stage='done';c.status='No change';say('There is no active appointment to reschedule. Start a new chat to book a visit.');return s}c.stage='slot';log('search_slots','Future available slots returned');say('Thanks, Alex. Choose an available appointment below, or type 1, 2, or 3. I’ll ask you to confirm before making changes.')}return s}
if(c.stage==='slot'){
if(/next friday/.test(t)){say('Let’s use an exact date. Choose one of the dated slots below so there’s no ambiguity.');return s}
const slot=slots.find(x=>x.id===input)||slots[Number(input)-1];
if(!slot){say('Please select one of the available slots below.');return s}
c.selected=slot.id;c.stage='confirm';say('Confirm '+(c.intent==='Reschedule'?'moving your appointment to ':'booking ')+slot.date+' at '+slot.time+' with '+slot.provider+'? Reply “confirm”.');return s}
if(c.stage==='confirm'){
if(!/^(confirm|yes)$/i.test(input.trim())){say('No changes made. Reply “confirm” to book this slot.');return s}
const slot=slots.find(x=>x.id===c.selected)!;
if(s.appointments.some(a=>a.slot===slot.id&&a.status!=='Cancelled')){log('book_appointment','Slot no longer available','blocked');log('search_slots','Refresh availability');c.stage='slot';say('That slot was just taken. Please choose another available time.');return s}
if(c.intent==='Reschedule')s.appointments.filter(a=>a.name==='Alex Morgan'&&a.status!=='Cancelled').forEach(a=>a.status='Cancelled');
s.appointments.push({id:crypto.randomUUID(),name:c.name,time:slot.time,date:slot.date,provider:slot.provider,type:'Follow-up',status:'Confirmed',slot:slot.id});log(c.intent==='Reschedule'?'reschedule':'book_appointment','Confirmed '+slot.date+' '+slot.time);c.status=c.intent==='Reschedule'?'Rescheduled':'Booked';c.stage='done';say('You’re all set, Alex. Your appointment is confirmed for '+slot.date+' at '+slot.time+' with '+slot.provider+'.');return s}
if(c.stage==='refill'){
if(!/request refill|confirm|yes/i.test(input)){say('Reply “request refill” to send this request to staff.');return s}
s.refills.push({id:crypto.randomUUID(),name:c.name,medication:'Lisinopril 10 mg',status:'Needs review'});log('request_refill','Lisinopril request queued for staff review');c.status='Needs review';c.stage='done';say('Your refill request has been sent to the care team for review. It has not been approved.');return s}
if(c.stage==='cancel'){if(!/confirm cancel/i.test(input)){say('No changes made. Reply “confirm cancel” to cancel.');return s}s.appointments.filter(a=>a.name===c.name).forEach(a=>a.status='Cancelled');log('cancel','Existing synthetic appointment cancelled');c.status='Cancelled';c.stage='done';say('Your demo appointment has been cancelled.');return s}
return s}
