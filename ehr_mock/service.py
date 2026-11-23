"""SQLite-backed, synthetic EHR resources. Not an athenahealth integration."""
import sqlite3
from datetime import date, timedelta
from threading import RLock

class EHR:
    def __init__(self, path=":memory:"):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = RLock()
        self.db.executescript("""
        CREATE TABLE IF NOT EXISTS patients(patientid INTEGER PRIMARY KEY, name TEXT, dob TEXT);
        CREATE TABLE IF NOT EXISTS slots(slotid INTEGER PRIMARY KEY, date TEXT, time TEXT, provider TEXT);
        CREATE TABLE IF NOT EXISTS appointments(appointmentid INTEGER PRIMARY KEY AUTOINCREMENT,patientid INTEGER,slotid INTEGER UNIQUE);
        CREATE TABLE IF NOT EXISTS refills(requestid INTEGER PRIMARY KEY AUTOINCREMENT,patientid INTEGER,medication TEXT,status TEXT);
        """)
        if not self.db.execute("SELECT 1 FROM patients").fetchone():
            self.db.execute("INSERT INTO patients VALUES(1,'Alex Morgan','1990-06-15')")
            for i in range(2,51):
                self.db.execute("INSERT INTO patients VALUES(?,?,?)",(i,f'Synthetic Patient {i}','1985-01-01'))
            for i in range(1,71):
                self.db.execute("INSERT INTO slots VALUES(?,?,?,?)",(i,str(date.today()+timedelta(days=(i-1)//5+1)),['09:00','10:30','11:00','14:00','15:30'][(i-1)%5],f'Demo Provider {(i-1)%5+1}'))
            self.db.execute("INSERT INTO appointments(patientid,slotid) VALUES(1,70)")
            self.db.commit()
    def verify(self,name,dob):
        return self.db.execute("SELECT patientid FROM patients WHERE lower(name)=? AND dob=?",(name.lower().strip(),dob)).fetchone()
    def slots(self):
        return [dict(r) for r in self.db.execute("SELECT * FROM slots WHERE date>? AND slotid NOT IN (SELECT slotid FROM appointments) ORDER BY date, time LIMIT 10",(str(date.today()),))]
    def book(self,patientid,slotid,reschedule=False):
        with self.lock:
            slot=self.db.execute("SELECT * FROM slots WHERE slotid=? AND date>?",(slotid,str(date.today()))).fetchone()
            if not slot: raise ValueError("Slot does not exist or is in the past")
            if self.db.execute("SELECT 1 FROM appointments WHERE slotid=?",(slotid,)).fetchone(): raise ValueError("Slot is no longer available")
            if reschedule and not self.db.execute("SELECT 1 FROM appointments WHERE patientid=?",(patientid,)).fetchone(): raise ValueError("No appointment to reschedule")
            with self.db:
                if reschedule: self.db.execute("DELETE FROM appointments WHERE patientid=?",(patientid,))
                cur=self.db.execute("INSERT INTO appointments(patientid,slotid) VALUES(?,?)",(patientid,slotid))
            return {"appointmentid":cur.lastrowid,**dict(slot)}
    def cancel(self,patientid):
        with self.lock,self.db:
            cur=self.db.execute("DELETE FROM appointments WHERE patientid=?",(patientid,))
            if not cur.rowcount: raise ValueError("No appointment to cancel")
        return {"cancelled":cur.rowcount}
    def refill(self,patientid,medication):
        if medication!="Lisinopril 10 mg": raise ValueError("Medication is not in this synthetic record")
        with self.lock,self.db:
            cur=self.db.execute("INSERT INTO refills(patientid,medication,status) VALUES(?,?,'Needs review')",(patientid,medication))
        return {"requestid":cur.lastrowid,"status":"Needs review"}
