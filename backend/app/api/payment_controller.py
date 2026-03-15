from fastapi import APIRouter, HTTPException
from app.models.schemas import PaymentRequest, PaymentByPlateRequest
from app.repositories.session_repository import SessionRepository

PENALTY_THRESHOLD = 200000

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/pay")
def pay_sessions(data: PaymentRequest):
    if not data.session_ids:
        raise HTTPException(status_code=400, detail="No session IDs provided")
    updated = SessionRepository.mark_paid(data.session_ids)
    return {"message": f"{updated} session(s) marked as paid", "updated": updated}


@router.post("/pay-all")
def pay_all_by_plate(data: PaymentByPlateRequest):
    plate = data.plate_number.strip().upper()
    total_unpaid = SessionRepository.get_total_unpaid_by_plate(plate)
    if total_unpaid == 0:
        return {"message": "No unpaid sessions found", "updated": 0, "total_paid": 0}
    updated = SessionRepository.mark_all_paid_by_plate(plate)
    return {
        "message": f"{updated} session(s) paid for {plate}",
        "updated": updated,
        "total_paid": total_unpaid,
    }


@router.get("/unpaid/{plate_number}")
def get_unpaid_sessions(plate_number: str):
    rows = SessionRepository.get_unpaid_by_plate(plate_number.upper())
    total = SessionRepository.get_total_unpaid_by_plate(plate_number.upper())
    penalty_applied = total >= PENALTY_THRESHOLD
    return {
        "sessions": [dict(r) for r in rows],
        "total_unpaid": total,
        "penalty_warning": penalty_applied,
        "penalty_threshold": PENALTY_THRESHOLD,
    }


@router.get("/check-penalty/{plate_number}")
def check_penalty(plate_number: str):
    plate = plate_number.strip().upper()
    total = SessionRepository.get_total_unpaid_by_plate(plate)
    penalty_applied = False
    if total >= PENALTY_THRESHOLD:
        SessionRepository.apply_penalty_doubling(plate)
        penalty_applied = True
        total = SessionRepository.get_total_unpaid_by_plate(plate)
    return {
        "plate_number": plate,
        "total_unpaid": total,
        "penalty_applied": penalty_applied,
        "message": (
            f"PENALTY APPLIED: Outstanding amount has been doubled to {total:,} HUF. "
            "According to Budapest parking enforcement regulations, unpaid parking fees "
            "may lead to additional penalties or legal enforcement actions. "
            "Immediate payment is required."
            if penalty_applied
            else "No penalty applied."
        ),
    }


@router.get("/congestion")
def get_congestion():
    rows = SessionRepository.get_congestion_by_zone()
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
