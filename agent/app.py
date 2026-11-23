"""Local reference API. Bind to loopback; authentication is intentionally out of scope."""
import os
from fastapi import FastAPI, HTTPException
from agent.service import Agent, Turn
from ehr_mock.service import EHR

app=FastAPI(title="FrontDesk synthetic demo",description="Local-only demo. No PHI. No LLM connected.")
agent=Agent(EHR(os.getenv("FRONTDESK_DB","frontdesk.db")))

@app.get("/api/health")
def health(): return {"status":"ok","mode":"deterministic","data":"synthetic"}

@app.post("/api/sessions",status_code=201)
def create_session(): return agent.create().model_dump()

@app.post("/api/sessions/{session_id}/messages")
def message(session_id:str,body:Turn):
    s=agent.sessions.get(session_id)
    if not s: raise HTTPException(404,"Unknown session")
    return agent.turn(s,body.message)

@app.get("/api/staff/conversations")
def conversations(): return [s.model_dump() for s in agent.sessions.values()]

@app.get("/api/ehr/appointment-slots")
def slots(): return {"appointments":agent.ehr.slots()}

@app.get("/api/ehr/providers")
def providers(): return {"providers":[{"providerid":i,"name":f"Demo Provider {i}"} for i in range(1,6)]}

@app.get("/api/ehr/departments")
def departments(): return {"departments":[{"departmentid":1,"name":"Evergreen Family Clinic"}]}

@app.get("/api/staff/snapshot")
def snapshot():
    db=agent.ehr.db
    appointments=[{"id":str(r["appointmentid"]),"name":r["name"],"time":r["time"],"date":r["date"],"provider":r["provider"],"type":"Follow-up","status":"Confirmed","slot":str(r["slotid"])}
        for r in db.execute("SELECT a.*,p.name,s.date,s.time,s.provider FROM appointments a JOIN patients p USING(patientid) JOIN slots s USING(slotid)")]
    refills=[{"id":str(r["requestid"]),"name":r["name"],"medication":r["medication"],"status":r["status"]}
        for r in db.execute("SELECT r.*,p.name FROM refills r JOIN patients p USING(patientid)")]
    return {"appointments":appointments,"refills":refills}

@app.post("/api/staff/refills/{request_id}/forward")
def forward_refill(request_id:int):
    with agent.ehr.lock, agent.ehr.db:
        cur=agent.ehr.db.execute("UPDATE refills SET status='Forwarded to clinician' WHERE requestid=? AND status='Needs review'",(request_id,))
        if not cur.rowcount: raise HTTPException(404,"Pending request not found")
    return {"status":"Forwarded to clinician"}
