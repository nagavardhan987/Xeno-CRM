import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import logging
import traceback

logger = logging.getLogger(__name__)

from database import get_db
from models import Campaign, Segment, Customer, Communication, Order
from routers.segments import get_matching_customers_query

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])

class CampaignCreateSchema(BaseModel):
    name: str
    segment_id: int
    message_template: str
    channel: Optional[str] = "whatsapp"
    goal: Optional[str] = ""
    launch: Optional[bool] = False

def get_channel_service_url():
    return os.getenv("CHANNEL_SERVICE_URL", "http://localhost:8001")

async def send_to_channel_service(client: httpx.AsyncClient, channel_url: str, payload: dict):
    try:
        response = await client.post(f"{channel_url}/send", json=payload, timeout=5.0)
        return response.status_code == 200
    except Exception as e:
        print(f"Error calling channel service: {e}")
        return False

async def background_campaign_launch(campaign_id: int, db_session_factory):
    # Create a new DB session for background task to avoid session conflicts
    db: Session = db_session_factory()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign or campaign.status != "launching":
            print(f"Campaign {campaign_id} not in launching state. Aborting background launch.")
            return

        segment = db.query(Segment).filter(Segment.id == campaign.segment_id).first()
        if not segment:
            print(f"Segment not found for campaign {campaign_id}")
            campaign.status = "failed"
            db.commit()
            return

        # Fetch all customers in segment
        customers_query = get_matching_customers_query(db, segment.filters or {})
        customers = customers_query.all()
        
        if not customers:
            print(f"No customers found in segment for campaign {campaign_id}")
            campaign.status = "completed"
            db.commit()
            return

        campaign.status = "active"
        campaign.launched_at = datetime.now()
        db.commit()

        channel_url = get_channel_service_url()
        print(f"Launching campaign {campaign_id} to {len(customers)} customers via {channel_url}...")

        # We will dispatch the messages
        async with httpx.AsyncClient() as client:
            for customer in customers:
                # Personalize message
                message = campaign.message_template.replace("{name}", customer.name)
                
                # Create communication entry
                comm = Communication(
                    campaign_id=campaign.id,
                    customer_id=customer.id,
                    message=message,
                    channel=campaign.channel,
                    status="pending"
                )
                db.add(comm)
                db.flush() # Flushes so comm gets id
                
                # Send to channel stub
                payload = {
                    "communication_id": comm.id,
                    "customer_name": customer.name,
                    "message": message,
                    "channel": campaign.channel
                }
                
                # We commit each communication to DB and call the service
                db.commit()
                
                # Fire and forget call to channel service
                # (channel service runs its own simulation in background)
                await send_to_channel_service(client, channel_url, payload)

        print(f"Successfully launched campaign {campaign_id}.")
    except Exception as e:
        print(f"Error in background campaign launch: {e}")
        db.rollback()
        # Set campaign back to draft/failed if launching crashes
        try:
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("")
def create_campaign(payload: CampaignCreateSchema, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    segment = db.query(Segment).filter(Segment.id == payload.segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
        
    try:
        campaign = Campaign(
            name=payload.name,
            segment_id=payload.segment_id,
            message_template=payload.message_template,
            channel=payload.channel,
            goal=payload.goal or "",
            status="draft"
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)

        if payload.launch:
            campaign.status = "launching"
            db.commit()
            from database import SessionLocal
            background_tasks.add_task(background_campaign_launch, campaign.id, SessionLocal)
        
        return {
            "id": campaign.id,
            "name": campaign.name,
            "segment_id": campaign.segment_id,
            "segment_name": segment.name,
            "message_template": campaign.message_template,
            "channel": campaign.channel,
            "goal": campaign.goal,
            "status": campaign.status,
            "total_sent": campaign.total_sent,
            "total_delivered": campaign.total_delivered,
            "total_opened": campaign.total_opened,
            "total_clicked": campaign.total_clicked,
            "total_failed": campaign.total_failed,
            "deliver_rate": 0.0,
            "open_rate": 0.0,
            "click_rate": 0.0,
            "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
            "launched_at": campaign.launched_at.isoformat() if campaign.launched_at else None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
def list_campaigns(db: Session = Depends(get_db)):
    try:
        campaigns = db.query(Campaign).order_by(Campaign.id.desc()).all()
        result = []
        for c in campaigns:
            seg = db.query(Segment).filter(Segment.id == c.segment_id).first()
            
            total_sent = c.total_sent or 0
            total_delivered = c.total_delivered or 0
            total_opened = c.total_opened or 0
            total_clicked = c.total_clicked or 0
            
            deliver_rate = min((total_delivered / total_sent * 100), 100.0) if total_sent > 0 else 0.0
            open_rate = min((total_opened / total_delivered * 100), 100.0) if total_delivered > 0 else 0.0
            click_rate = min((total_clicked / total_delivered * 100), 100.0) if total_delivered > 0 else 0.0
            
            result.append({
                "id": c.id,
                "name": c.name,
                "segment_id": c.segment_id,
                "segment_name": seg.name if seg else "Deleted Segment",
                "message_template": c.message_template,
                "channel": c.channel,
                "goal": c.goal,
                "status": "draft" if total_sent == 0 else c.status,
                "total_sent": total_sent,
                "total_delivered": total_delivered,
                "total_opened": total_opened,
                "total_clicked": total_clicked,
                "total_failed": c.total_failed,
                "deliver_rate": round(deliver_rate, 1),
                "open_rate": round(open_rate, 1),
                "click_rate": round(click_rate, 1),
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "launched_at": c.launched_at.isoformat() if c.launched_at else None
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{campaign_id}")
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
            
        seg = db.query(Segment).filter(Segment.id == campaign.segment_id).first()
        
        # Calculate rates - handle None values gracefully
        total_sent = campaign.total_sent or 0
        total_delivered = campaign.total_delivered or 0
        total_opened = campaign.total_opened or 0
        total_clicked = campaign.total_clicked or 0
        total_failed = campaign.total_failed or 0
        
        deliver_rate = min((total_delivered / total_sent * 100), 100.0) if total_sent > 0 else 0.0
        open_rate = min((total_opened / total_delivered * 100), 100.0) if total_delivered > 0 else 0.0
        click_rate = min((total_clicked / total_delivered * 100), 100.0) if total_delivered > 0 else 0.0
        
        # Revenue Influenced estimation
        revenue_influenced = 0.0
        if campaign.launched_at:
            comm_cust_ids = db.query(Communication.customer_id).filter(
                Communication.campaign_id == campaign.id,
                Communication.status == 'clicked'
            ).all()
            cust_ids = [c[0] for c in comm_cust_ids]
            
            if cust_ids:
                try:
                    rev_res = db.query(func.sum(Order.amount)).filter(
                        Order.customer_id.in_(cust_ids),
                        Order.order_date >= campaign.launched_at
                    ).scalar()
                    revenue_influenced = float(rev_res) if rev_res else 0.0
                except Exception:
                    revenue_influenced = 0.0

        return {
            "id": campaign.id,
            "name": campaign.name,
            "segment_id": campaign.segment_id,
            "segment_name": seg.name if seg else "Deleted Segment",
            "segment_customer_count": seg.customer_count if seg else 0,
            "message_template": campaign.message_template,
            "channel": campaign.channel,
            "goal": campaign.goal,
            "status": "draft" if total_sent == 0 else campaign.status,
            "total_sent": total_sent,
            "total_delivered": total_delivered,
            "total_opened": total_opened,
            "total_clicked": total_clicked,
            "total_failed": total_failed,
            "deliver_rate": round(deliver_rate, 1),
            "open_rate": round(open_rate, 1),
            "click_rate": round(click_rate, 1),
            "revenue_influenced": round(revenue_influenced, 2),
            "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
            "launched_at": campaign.launched_at.isoformat() if campaign.launched_at else None
        }
    except Exception as e:
        logger.exception(f"CRASH in GET /api/campaigns/{campaign_id}: {str(e)}")
        traceback.print_exc()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

class SimulateEventSchema(BaseModel):
    event_type: str  # sent, delivered, opened, clicked

@router.post("/{campaign_id}/simulate")
def simulate_campaign_event(campaign_id: int, payload: SimulateEventSchema, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    comms = db.query(Communication).filter(Communication.campaign_id == campaign_id).all()
    if not comms:
        raise HTTPException(status_code=400, detail="No communications found for this campaign")

    # Update logic based on event_type
    import random
    from datetime import datetime
    now = datetime.now()
    updated_count = 0

    for comm in comms:
        if payload.event_type == "sent" and comm.status == "pending":
            comm.status = "sent"
            comm.sent_at = now
            campaign.total_sent = (campaign.total_sent or 0) + 1
            updated_count += 1
        elif payload.event_type == "delivered" and comm.status == "sent":
            if random.random() < 0.95: # 95% delivery rate
                comm.status = "delivered"
                comm.delivered_at = now
                campaign.total_delivered = (campaign.total_delivered or 0) + 1
                updated_count += 1
        elif payload.event_type == "opened" and comm.status == "delivered":
            if random.random() < 0.72: # 72% open rate
                comm.status = "opened"
                comm.opened_at = now
                campaign.total_opened = (campaign.total_opened or 0) + 1
                updated_count += 1
        elif payload.event_type == "clicked" and comm.status == "opened":
            if random.random() < 0.40: # 40% click rate
                comm.status = "clicked"
                comm.clicked_at = now
                campaign.total_clicked = (campaign.total_clicked or 0) + 1
                updated_count += 1

    db.commit()
    return {"message": f"Simulated {updated_count} events for {payload.event_type}", "updated_count": updated_count}

@router.post("/{campaign_id}/launch")
def launch_campaign(campaign_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if campaign.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft campaigns can be launched")
        
    # Check if segment exists and has customers
    seg = db.query(Segment).filter(Segment.id == campaign.segment_id).first()
    if not seg:
        raise HTTPException(status_code=400, detail="Campaign segment does not exist")
        
    # Mark as launching
    campaign.status = "launching"
    db.commit()
    
    # Run dispatch in the background
    from database import SessionLocal
    background_tasks.add_task(background_campaign_launch, campaign.id, SessionLocal)
    
    return {"status": "launching", "message": "Campaign launch started in background."}


@router.get("/{campaign_id}/communications")
def get_campaign_communications(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    comms = db.query(Communication).filter(Communication.campaign_id == campaign_id).order_by(Communication.id.asc()).all()
    
    result = []
    for c in comms:
        cust = db.query(Customer).filter(Customer.id == c.customer_id).first()
        result.append({
            "id": c.id,
            "customer_name": cust.name if cust else "Unknown Customer",
            "customer_email": cust.email if cust else "",
            "customer_phone": cust.phone if cust else "",
            "message": c.message,
            "channel": c.channel,
            "status": c.status,
            "sent_at": c.sent_at.isoformat() if c.sent_at else None,
            "delivered_at": c.delivered_at.isoformat() if c.delivered_at else None,
            "opened_at": c.opened_at.isoformat() if c.opened_at else None,
            "clicked_at": c.clicked_at.isoformat() if c.clicked_at else None,
            "failed_at": c.failed_at.isoformat() if c.failed_at else None,
            "error_message": getattr(c, 'error_message', None)
        })
        
    return result
 

@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    try:
        db.delete(campaign)
        db.commit()
        return {"status": "success", "message": f"Campaign {campaign_id} deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.exception(f"Error deleting campaign {campaign_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete campaign")

# Trigger reload 3
