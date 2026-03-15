import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_connection

PENALTY_THRESHOLD = 200000

router = APIRouter(prefix="/payments", tags=["payments"])


class PaySessionRequest(BaseModel):
    session_ids: List[str]
    user_id: Optional[str] = None
    cardholder_name: Optional[str] = None
    card_last_four: Optional[str] = None


class PayAllRequest(BaseModel):
    plate_number: str
    user_id: Optional[str] = None
    cardholder_name: Optional[str] = None
    card_last_four: Optional[str] = None


@router.post("/pay")
def pay_sessions(data: PaySessionRequest):
    if not data.session_ids:
        raise HTTPException(status_code=400, detail="No session IDs provided")

    conn = get_connection()
    cur = conn.cursor()

    receipts = []
    now = datetime.now().isoformat()

    for sid in data.session_ids:
        cur.execute("SELECT * FROM parking_sessions WHERE session_id=? AND status IN ('unpaid','overdue')", (sid,))
        session = cur.fetchone()
        if not session:
            continue

        # Mark as paid
        cur.execute("UPDATE parking_sessions SET status='paid' WHERE session_id=?", (sid,))

        # Create payment record
        payment_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO payments (payment_id, user_id, session_id, amount, cardholder_name, card_last_four, payment_timestamp, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'success')
        """, (payment_id, data.user_id or "", sid, session["final_fee"], data.cardholder_name or "", data.card_last_four or "", now))

        receipts.append({
            "payment_id": payment_id,
            "session_id": sid,
            "plate_number": session["plate_number"],
            "zone_id": session["zone_id"],
            "amount": session["final_fee"],
            "payment_timestamp": now,
            "status": "success",
        })

    conn.commit()
    conn.close()

    total_paid = sum(r["amount"] for r in receipts)
    return {
        "message": f"{len(receipts)} session(s) paid successfully",
        "total_paid": total_paid,
        "receipts": receipts,
    }


@router.post("/pay-all")
def pay_all_by_plate(data: PayAllRequest):
    plate = data.plate_number.strip().upper()
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT * FROM parking_sessions
        WHERE plate_number=? AND status IN ('unpaid','overdue')
    """, (plate,))
    sessions = cur.fetchall()

    if not sessions:
        conn.close()
        return {"message": "No unpaid sessions found", "updated": 0, "total_paid": 0, "receipts": []}

    receipts = []
    now = datetime.now().isoformat()

    for session in sessions:
        sid = session["session_id"]
        cur.execute("UPDATE parking_sessions SET status='paid' WHERE session_id=?", (sid,))

        payment_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO payments (payment_id, user_id, session_id, amount, cardholder_name, card_last_four, payment_timestamp, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'success')
        """, (payment_id, data.user_id or "", sid, session["final_fee"], data.cardholder_name or "", data.card_last_four or "", now))

        receipts.append({
            "payment_id": payment_id,
            "session_id": sid,
            "plate_number": plate,
            "amount": session["final_fee"],
            "payment_timestamp": now,
            "status": "success",
        })

    conn.commit()
    conn.close()

    total_paid = sum(r["amount"] for r in receipts)
    return {
        "message": f"{len(receipts)} session(s) paid for {plate}",
        "updated": len(receipts),
        "total_paid": total_paid,
        "receipts": receipts,
    }


@router.get("/unpaid/{plate_number}")
def get_unpaid_sessions(plate_number: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM parking_sessions
        WHERE plate_number=? AND status IN ('unpaid','overdue')
        ORDER BY entry_timestamp DESC
    """, (plate_number.upper(),))
    rows = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT COALESCE(SUM(final_fee), 0) FROM parking_sessions
        WHERE plate_number=? AND status IN ('unpaid','overdue')
    """, (plate_number.upper(),))
    total = int(cur.fetchone()[0])
    conn.close()

    return {
        "sessions": rows,
        "total_unpaid": total,
        "penalty_warning": total >= PENALTY_THRESHOLD,
        "penalty_threshold": PENALTY_THRESHOLD,
    }


@router.get("/check-penalty/{plate_number}")
def check_penalty(plate_number: str):
    plate = plate_number.strip().upper()
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT COALESCE(SUM(final_fee), 0) FROM parking_sessions
        WHERE plate_number=? AND status IN ('unpaid','overdue')
    """, (plate,))
    total = int(cur.fetchone()[0])

    penalty_applied = False
    if total >= PENALTY_THRESHOLD:
        cur.execute("""
            UPDATE parking_sessions
            SET final_fee = final_fee * 2, status = 'overdue'
            WHERE plate_number=? AND status IN ('unpaid', 'overdue')
        """, (plate,))
        conn.commit()
        penalty_applied = True

        cur.execute("""
            SELECT COALESCE(SUM(final_fee), 0) FROM parking_sessions
            WHERE plate_number=? AND status IN ('unpaid','overdue')
        """, (plate,))
        total = int(cur.fetchone()[0])

    conn.close()

    return {
        "plate_number": plate,
        "total_unpaid": total,
        "penalty_applied": penalty_applied,
        "message": (
            f"PENALTY APPLIED: Outstanding amount has been doubled to {total:,} HUF. "
            "Immediate payment is required."
            if penalty_applied
            else "No penalty applied."
        ),
    }


@router.get("/history/{user_id}")
def payment_history(user_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.*, ps.plate_number, ps.zone_id, ps.duration_minutes
        FROM payments p
        JOIN parking_sessions ps ON p.session_id = ps.session_id
        WHERE p.user_id=?
        ORDER BY p.payment_timestamp DESC
    """, (user_id,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


@router.get("/congestion")
def get_congestion():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT zone_id, COUNT(*) AS active_count
        FROM parking_sessions
        WHERE status='active'
        GROUP BY zone_id
    """)
    rows = cur.fetchall()
    conn.close()

    result = []
    for r in rows:
        count = r["active_count"]
        if count <= 3:
            level = "low"
        elif count <= 7:
            level = "medium"
        else:
            level = "high"
        result.append({
            "zone_id": r["zone_id"],
            "active_vehicles": count,
            "congestion_level": level,
        })
    return result
