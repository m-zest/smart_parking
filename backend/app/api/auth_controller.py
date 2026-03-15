import uuid
import hashlib
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import get_connection

ADMIN_SECRET_CODE = "ADMIN-HU-2026"

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    admin_code: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


@router.post("/register")
def register(data: RegisterRequest):
    role = "user"
    if data.admin_code:
        if data.admin_code != ADMIN_SECRET_CODE:
            raise HTTPException(status_code=403, detail="Invalid admin code")
        role = "admin"

    pw_hash = _hash(data.password)
    user_id = str(uuid.uuid4())
    now = datetime.now().isoformat()

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO users (user_id, name, email, password, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, data.name, data.email, pw_hash, role, now))
        conn.commit()
    except Exception:
        conn.close()
        raise HTTPException(status_code=409, detail="Email already registered")
    conn.close()

    return {
        "user_id": user_id,
        "name": data.name,
        "email": data.email,
        "role": role,
    }


@router.post("/login")
def login(data: LoginRequest):
    pw_hash = _hash(data.password)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email=? AND password=?", (data.email, pw_hash))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "user_id": row["user_id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
    }


@router.get("/users")
def list_users():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id, name, email, role, created_at FROM users ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/users/{user_id}")
def get_user(user_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id, name, email, role, created_at FROM users WHERE user_id=?", (user_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    # Get user sessions
    cur.execute("""
        SELECT * FROM parking_sessions WHERE user_id=? ORDER BY entry_timestamp DESC
    """, (user_id,))
    sessions = [dict(r) for r in cur.fetchall()]

    # Get user payments
    cur.execute("""
        SELECT * FROM payments WHERE user_id=? ORDER BY payment_timestamp DESC
    """, (user_id,))
    payments = [dict(r) for r in cur.fetchall()]

    # Stats
    cur.execute("""
        SELECT
            COUNT(*) as total_sessions,
            COALESCE(SUM(CASE WHEN status='paid' THEN final_fee ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN status IN ('unpaid','overdue') THEN final_fee ELSE 0 END), 0) as total_unpaid,
            COALESCE(SUM(CASE WHEN status='active' THEN 1 ELSE 0 END), 0) as active_sessions
        FROM parking_sessions WHERE user_id=?
    """, (user_id,))
    stats = dict(cur.fetchone())
    conn.close()

    return {
        **dict(row),
        "sessions": sessions,
        "payments": payments,
        "stats": stats,
    }


@router.get("/users-summary")
def users_summary():
    """Admin endpoint: all users with their session/payment stats."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            u.user_id, u.name, u.email, u.role, u.created_at,
            COUNT(ps.session_id) as total_sessions,
            COALESCE(SUM(CASE WHEN ps.status='paid' THEN ps.final_fee ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN ps.status IN ('unpaid','overdue') THEN ps.final_fee ELSE 0 END), 0) as total_unpaid,
            COALESCE(SUM(CASE WHEN ps.status='active' THEN 1 ELSE 0 END), 0) as active_sessions
        FROM users u
        LEFT JOIN parking_sessions ps ON u.user_id = ps.user_id
        GROUP BY u.user_id
        ORDER BY total_unpaid DESC
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows
