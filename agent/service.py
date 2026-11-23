"""Deterministic, tool-driven reference agent; deliberately not presented as an LLM."""
import re
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4
from pydantic import BaseModel, Field
from ehr_mock.service import EHR

class ToolInput(BaseModel):
    name: str | None = None
    dob: str | None = None
    slotid: int | None = Field(default=None,gt=0)
    medication: str | None = None
    reason: str | None = None

class ToolOutput(BaseModel):
    tool: str
    status: Literal["success","blocked"]
    data: dict = Field(default_factory=dict)

class Turn(BaseModel):
    message: str = Field(min_length=1,max_length=2000)

class Session(BaseModel):
    id: str = Field(default_factory=lambda:str(uuid4()))
    patientid: int | None = None
    stage: str = "intent"
    intent: str = "book"
    failures: int = 0
    selected: int | None = None
    offered: list[int] = Field(default_factory=list)
    outcome: str = "In progress"
    messages: list[dict] = Field(default_factory=list)
    trace: list[dict] = Field(default_factory=list)

class Agent:
    def __init__(self,ehr=None):
        self.ehr=ehr or EHR()
        self.sessions={}
    def create(self):
        session=Session()
        self.sessions[session.id]=session
        return session
    def tool(self,s,name,raw):
        args=ToolInput.model_validate(raw)
        try:
            if name in {"search_slots","book_appointment","reschedule","cancel","request_refill"} and not s.patientid:
                raise ValueError("Identity verification required")
            if name=="find_patient":
                data={"lookup":"deferred until full identity supplied"}
            elif name=="verify_identity":
                match=self.ehr.verify(args.name or "",args.dob or "")
                if not match: raise ValueError("Identity did not match")
                s.patientid=match["patientid"];data={"verified":True}
            elif name=="search_slots":
                data={"slots":self.ehr.slots()};s.offered=[x["slotid"] for x in data["slots"]]
            elif name in {"book_appointment","reschedule"}:
                if args.slotid is None: raise ValueError("Slot required")
                data=self.ehr.book(s.patientid,args.slotid,name=="reschedule")
            elif name=="cancel": data=self.ehr.cancel(s.patientid)
            elif name=="request_refill": data=self.ehr.refill(s.patientid,args.medication)
            elif name=="handoff_to_staff": data={"queued":True,"reason":args.reason}
            else: raise ValueError("Unknown tool")
            result=ToolOutput(tool=name,status="success",data=data)
        except ValueError as error:
            result=ToolOutput(tool=name,status="blocked",data={"error":str(error)})
        s.trace.append({**result.model_dump(),"time":datetime.now(timezone.utc).isoformat()})
        return result
    def turn(self,s,text):
        Turn(message=text)
        s.messages.append({"role":"user","text":text})
        answer=self._respond(s,text.strip())
        s.messages.append({"role":"assistant","text":answer})
        return {"session_id":s.id,"reply":answer,"state":s.model_dump()}
    def _respond(self,s,text):
        t=text.lower()
        if re.search(r"chest pain|can't breathe|cannot breathe|stroke|suicid|severe bleeding",t):
            s.stage="done";s.outcome="Urgent handoff"
            self.tool(s,"handoff_to_staff",{"reason":"Emergency language detected"})
            return "If this may be an emergency, call 911 now. Do not wait for staff. This conversation is flagged for staff."
        if re.search(r"ignore.*rules|list all patients|system prompt|bypass",t):
            return "I cannot disclose patient lists or bypass identity verification."
        if re.search(r"double.*dose|change.*dose|diagnos|medical advice|side effect",t):
            s.stage="done";s.outcome="Handed off"
            self.tool(s,"handoff_to_staff",{"reason":"Clinical question; no advice given"})
            return "I cannot provide medical advice. Your question is routed to clinic staff."
        if s.stage=="done": return "This conversation is complete. Please start a new session."
        if s.stage=="intent":
            s.intent="refill" if re.search("refill|medication",t) else "reschedule" if re.search("reschedul|move",t) else "cancel" if "cancel" in t else "book"
            s.stage="verify"
            return "Please enter your full name and date of birth (YYYY-MM-DD). Demo: Alex Morgan, 1990-06-15."
        if s.stage=="verify":
            self.tool(s,"find_patient",{})
            dob=re.search(r"\d{4}-\d{2}-\d{2}",t)
            name=t[:dob.start()].strip(" ,") if dob else t
            result=self.tool(s,"verify_identity",{"name":name,"dob":dob.group() if dob else ""})
            if result.status=="blocked":
                s.failures+=1
                if s.failures>=2:
                    s.stage="done";s.outcome="Handed off"
                    self.tool(s,"handoff_to_staff",{"reason":"Two failed identity attempts"})
                    return "Identity could not be verified. Staff will review; no patient data was revealed."
                return "Those details did not match. Please try your name and date of birth once more."
            if s.intent=="refill":
                s.stage="refill";return "Your demo medication is Lisinopril 10 mg. Reply confirm to send a refill request, not an approval."
            if s.intent=="cancel":
                s.stage="cancel";return "Reply confirm cancel to cancel your existing synthetic appointment."
            s.stage="slot";result=self.tool(s,"search_slots",{})
            return "Choose an exact slot ID: "+", ".join(f'{x["slotid"]}: {x["date"]} {x["time"]}' for x in result.data["slots"])
        if s.stage=="slot":
            if not t.isdigit() or int(t) not in s.offered:
                return "Please choose an exact dated slot ID from the offered list; ambiguous dates need clarification."
            s.selected=int(t);s.stage="confirm"
            return f"Confirm slot {s.selected}? Reply confirm before any changes are made."
        if s.stage=="confirm":
            if t not in {"yes","confirm"}: return "No changes made. Reply confirm to proceed."
            result=self.tool(s,"reschedule" if s.intent=="reschedule" else "book_appointment",{"slotid":s.selected})
            if result.status=="blocked":
                s.stage="slot";available=self.tool(s,"search_slots",{})
                return "That slot is no longer available. Refreshed slots: "+", ".join(f'{x["slotid"]}: {x["date"]} {x["time"]}' for x in available.data["slots"])
            s.stage="done";s.outcome="Rescheduled" if s.intent=="reschedule" else "Booked"
            return "Your appointment is confirmed: "+str(result.data["date"])+" at "+result.data["time"]+"."
        if s.stage=="refill":
            if t not in {"confirm","yes","request refill"}: return "Reply confirm to send the request."
            self.tool(s,"request_refill",{"medication":"Lisinopril 10 mg"})
            s.stage="done";s.outcome="Needs review"
            return "Refill request sent to staff for review. It has not been approved."
        if s.stage=="cancel":
            if t!="confirm cancel": return "No changes made. Reply confirm cancel."
            result=self.tool(s,"cancel",{})
            if result.status=="blocked": return result.data["error"]
            s.stage="done";s.outcome="Cancelled"
            return "Your synthetic appointment has been cancelled."
        return "Please start a new session."
