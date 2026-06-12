from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import Communication, Campaign, Event

router = APIRouter(prefix="/api/receipt", tags=["receipt"])

class ReceiptSchema(BaseModel):
    communication_id: int
    event: str  # 'sent', 'delivered', 'opened', 'clicked', 'failed'

# Standard transition ordering
STATUS_ORDER = {
    "pending": 0,
    "sent": 1,
    "delivered": 2,
    "opened": 3,
    "clicked": 4,
    "failed": -1  # terminal state
}

@router.post("")
def receive_receipt(payload: ReceiptSchema, db: Session = Depends(get_db)):
    comm_id = payload.communication_id
    event = payload.event.lower()
    
    if event not in STATUS_ORDER and event != "failed":
        raise HTTPException(status_code=400, detail=f"Invalid event type: {event}")
        
    comm = db.query(Communication).filter(Communication.id == comm_id).first()
    if not comm:
        raise HTTPException(status_code=404, detail="Communication not found")
        
    campaign = db.query(Campaign).filter(Campaign.id == comm.campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    old_status = comm.status.lower()
    new_status = event
    
    # 1. Terminal state check
    if old_status == "failed":
        # Once failed, we do not update further
        return {"status": "ignored", "reason": "Communication already in terminal failed state"}
        
    # 2. Logic for updating status
    should_update = False
    if new_status == "failed":
        should_update = True
    else:
        # Check ordering
        old_order = STATUS_ORDER.get(old_status, 0)
        new_order = STATUS_ORDER.get(new_status, 0)
        if new_order > old_order:
            should_update = True
            
    if not should_update:
        return {"status": "ignored", "reason": f"Transition from {old_status} to {new_status} is invalid or out of order"}
        
    # 3. Update communication status and timestamps
    comm.status = new_status
    now = datetime.now()
    
    # Track which states were jumped/transitioned to increment campaign metrics correctly
    # If a callback jumps steps, we want to increment all intermediate campaign counters
    jumped_states = []
    
    if new_status == "failed":
        comm.failed_at = now
        jumped_states.append("failed")
    else:
        # Check transitions and fill in intermediate timestamps and campaign counters
        if old_status == "pending":
            if new_status == "sent":
                comm.sent_at = now
                jumped_states.extend(["sent"])
            elif new_status == "delivered":
                comm.sent_at = comm.sent_at or now
                comm.delivered_at = now
                jumped_states.extend(["sent", "delivered"])
            elif new_status == "opened":
                comm.sent_at = comm.sent_at or now
                comm.delivered_at = comm.delivered_at or now
                comm.opened_at = now
                jumped_states.extend(["sent", "delivered", "opened"])
            elif new_status == "clicked":
                comm.sent_at = comm.sent_at or now
                comm.delivered_at = comm.delivered_at or now
                comm.opened_at = comm.opened_at or now
                comm.clicked_at = now
                jumped_states.extend(["sent", "delivered", "opened", "clicked"])
        elif old_status == "sent":
            if new_status == "delivered":
                comm.delivered_at = now
                jumped_states.extend(["delivered"])
            elif new_status == "opened":
                comm.delivered_at = comm.delivered_at or now
                comm.opened_at = now
                jumped_states.extend(["delivered", "opened"])
            elif new_status == "clicked":
                comm.delivered_at = comm.delivered_at or now
                comm.opened_at = comm.opened_at or now
                comm.clicked_at = now
                jumped_states.extend(["delivered", "opened", "clicked"])
        elif old_status == "delivered":
            if new_status == "opened":
                comm.opened_at = now
                jumped_states.extend(["opened"])
            elif new_status == "clicked":
                comm.opened_at = comm.opened_at or now
                comm.clicked_at = now
                jumped_states.extend(["opened", "clicked"])
        elif old_status == "opened":
            if new_status == "clicked":
                comm.clicked_at = now
                jumped_states.extend(["clicked"])

    # 4. Insert into events audit log table
    audit_event = Event(
        communication_id=comm.id,
        event_type=new_status,
        created_at=now
    )
    db.add(audit_event)
    
    # 5. Update campaign aggregate counts based on transitioned states atomically
    update_data = {}
    for state in jumped_states:
        if state == "sent":
            update_data[Campaign.total_sent] = Campaign.total_sent + 1
        elif state == "delivered":
            update_data[Campaign.total_delivered] = Campaign.total_delivered + 1
        elif state == "opened":
            update_data[Campaign.total_opened] = Campaign.total_opened + 1
        elif state == "clicked":
            update_data[Campaign.total_clicked] = Campaign.total_clicked + 1
        elif state == "failed":
            update_data[Campaign.total_failed] = Campaign.total_failed + 1
            
    if update_data:
        db.query(Campaign).filter(Campaign.id == campaign.id).update(update_data, synchronize_session=False)
        db.commit()
        db.refresh(campaign)
            
    # Check if campaign is fully completed:
    # A campaign is completed if all communications are in terminal states (delivered/opened/clicked/failed).
    # Since clicked, opened, delivered are progress stages, let's say the campaign is "completed" once all
    # communications are no longer in "pending" or "sent" status, or once the simulation finishes.
    # To keep it simple, let's keep status 'active' during polling, or mark it completed if total terminal states
    # (failed + clicked + opened (non-clicked) + delivered (non-opened)) equals the segment count.
    # Wait, the customer count of segment equals total communications.
    total_comms = db.query(Communication).filter(Communication.campaign_id == campaign.id).count()
    completed_comms = db.query(Communication).filter(
        Communication.campaign_id == campaign.id,
        Communication.status.in_(["clicked", "failed"]) # for this demo, clicked and failed can be the endpoints, but delivered/opened can also be endpoints.
    ).count()
    # Actually, any comm that is delivered, opened, clicked, or failed is no longer "pending" or "sent".
    # But wait, a communication can go from delivered -> opened -> clicked. So it's not terminal until clicked or failed, or until the time expires.
    # Let's say a campaign status is marked "completed" if all communications have reached clicked/failed OR if a certain time passes.
    # Let's count how many are pending/sent/delivered/opened. If there are 0 "pending" or "sent" or "delivered" or "opened" (i.e. they are all clicked or failed), we can mark it completed. Or simpler: once all communications are either clicked, failed, or we have waited for the simulation to finish.
    # Let's write a check: if total_clicked + total_failed == total_comms, campaign status = 'completed'.
    # But since some users might not open/click, they will remain at "delivered" or "opened" status in the simulation.
    # So once the simulation completes (the longest sleep in channel service is 20s + 15s = 35s), the campaign stays "active" or can be marked "completed" if no more changes happen.
    # Let's check: if (campaign.total_clicked + campaign.total_failed + (campaign.total_opened - campaign.total_clicked) + (campaign.total_delivered - campaign.total_opened) == total_comms) or similar.
    # Wait, any comm that has status in ['delivered', 'opened', 'clicked', 'failed'] has finished its lifecycle or is in progress.
    # Let's check how many are still in 'pending' or 'sent'. If there are 0 'pending' and 0 'sent', then every message has been either delivered or failed. Since delivered messages might or might not open/click, they are "done" in terms of transmission.
    # So if `db.query(Communication).filter(Communication.campaign_id == campaign.id, Communication.status.in_(['pending', 'sent'])).count() == 0`:
    # then campaign status = 'completed'.
    # This is a perfect logical condition! Let's implement it.
    pending_or_sent_count = db.query(Communication).filter(
        Communication.campaign_id == campaign.id,
        Communication.status.in_(["pending", "sent"])
    ).count()
    
    if pending_or_sent_count == 0 and campaign.status == "active":
        campaign.status = "completed"
        
    db.commit()
    
    return {
        "status": "success",
        "communication_id": comm.id,
        "old_status": old_status,
        "new_status": new_status,
        "campaign_status": campaign.status
    }
