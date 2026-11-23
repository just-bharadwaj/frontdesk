import {Conversation,Store,Message,Trace,freshConversation} from './engine';
export const apiMode=new URLSearchParams(location.search).get('api')==='1'&&['localhost','127.0.0.1'].includes(location.hostname);
async function request(path:string,body?:object){const r=await fetch('/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error('Local Python API unavailable ('+r.status+'). Start uvicorn, then try again.');return r.json()}
type ApiState={id:string;patientid:number|null;stage:string;intent:string;failures:number;outcome:string;messages:{role:'user'|'assistant';text:string}[];trace:{tool:string;status:string;data:Record<string,unknown>;time:string}[]};
function normalize(s:ApiState):Conversation {
const c=freshConversation();return {...c,id:s.id,name:s.patientid?'Alex Morgan':'Unverified visitor',verified:!!s.patientid,stage:s.stage,intent:({book:'Appointment',reschedule:'Reschedule',cancel:'Cancel appointment',refill:'Refill request'} as Record<string,string>)[s.intent],failures:s.failures,status:s.outcome,messages:s.messages.length?s.messages as Message[]:c.messages,trace:s.trace.map(t=>({tool:t.tool,status:t.status,detail:JSON.stringify(t.data),time:new Date(t.time).toLocaleTimeString()})) as Trace[]}}
export async function createApiConversation(){return normalize(await request('/sessions',{}))}
export async function apiTurn(id:string,text:string){const r=await request('/sessions/'+id+'/messages',{message:text});return normalize(r.state)}
export async function apiSnapshot():Promise<Pick<Store,'appointments'|'refills'>>{return request('/staff/snapshot')}
export async function apiForward(id:string){return request('/staff/refills/'+id+'/forward',{})}

export async function apiConversations():Promise<Conversation[]>{const states:ApiState[]=await request('/staff/conversations');return states.map(normalize)}
