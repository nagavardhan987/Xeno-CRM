from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime, timedelta
import json

from database import get_db
from models import Customer, Segment

router = APIRouter(prefix="/api/segments", tags=["segments"])

class SegmentFilterSchema(BaseModel):
    min_spend: Optional[float] = Field(None)
    max_spend: Optional[float] = Field(None)
    inactive_days: Optional[int] = Field(None)
    min_orders: Optional[int] = Field(None)
    city: Optional[Any] = Field(None)
    category: Optional[Any] = Field(None)
    vip: Optional[bool] = Field(None, description="Top 10% spenders OR spend > ₹15000")
    new_customers: Optional[bool] = Field(None, description="Purchased in last 30 days")

class SegmentCreateSchema(BaseModel):
    name: str
    description: Optional[str] = ""
    filters: Dict[str, Any]

def get_vip_threshold(db: Session) -> float:
    """Compute the 90th percentile spend threshold dynamically."""
    all_spends = db.query(Customer.total_spend).order_by(Customer.total_spend.asc()).all()
    if not all_spends:
        return 15000.0
    idx = int(len(all_spends) * 0.90)
    return float(all_spends[min(idx, len(all_spends) - 1)][0])

def get_matching_customers_query(db: Session, filters: dict):
    """Build SQLAlchemy query from filter dict. Supports all business-rule keys."""
    query = db.query(Customer)

    # --- VIP: top 10% OR spend > ₹15000 ---
    if filters.get("vip"):
        vip_threshold = get_vip_threshold(db)
        query = query.filter(Customer.total_spend >= min(vip_threshold, 15000))

    # --- New Customers: purchased in last 30 days ---
    if filters.get("new_customers"):
        cutoff = datetime.now().date() - timedelta(days=30)
        query = query.filter(Customer.last_purchase_date >= cutoff)

    # --- Spend range ---
    if filters.get("min_spend") is not None:
        query = query.filter(Customer.total_spend >= filters["min_spend"])
    if filters.get("max_spend") is not None:
        query = query.filter(Customer.total_spend <= filters["max_spend"])

    # --- Order count ---
    if filters.get("min_orders") is not None:
        query = query.filter(Customer.order_count >= filters["min_orders"])

    # --- Inactive days ---
    if filters.get("inactive_days") is not None:
        cutoff_date = datetime.now().date() - timedelta(days=int(filters["inactive_days"]))
        query = query.filter(Customer.last_purchase_date <= cutoff_date)

    # --- City (string or list) ---
    if filters.get("city"):
        query = _apply_multivalue_filter(query, Customer.city, filters["city"])

    # --- Category (string or list) ---
    if filters.get("category"):
        query = _apply_multivalue_filter(query, Customer.preferred_category, filters["category"])

    return query


def _apply_multivalue_filter(query, column, filter_val):
    """Handle city/category filters that can be string, list, or Mongo-style dict."""
    import ast

    def parse(val):
        if isinstance(val, dict):
            for k, v in val.items():
                if k in ("$in", "in", "$or") and isinstance(v, list):
                    return [str(i).strip() for i in v]
            return [str(val)]
        elif isinstance(val, list):
            return [str(i).strip() for i in val]
        elif isinstance(val, str):
            try:
                parsed = ast.literal_eval(val)
                if isinstance(parsed, (dict, list)):
                    return parse(parsed)
            except Exception:
                pass
            if "," in val:
                return [i.strip() for i in val.split(",")]
            return [val.strip()]
        return [str(val)]

    vals = parse(filter_val)
    # Case-insensitive comparison
    vals_lower = [v.lower() for v in vals]
    if len(vals_lower) == 1:
        return query.filter(func.lower(column) == vals_lower[0])
    return query.filter(func.lower(column).in_(vals_lower))


def humanize_filters(filters: dict) -> list[str]:
    """Convert filter dict to human-readable tag strings."""
    tags = []
    if filters.get("vip"):
        tags.append("VIP Customers (top spenders)")
    if filters.get("new_customers"):
        tags.append("New (last 30 days)")
    if filters.get("min_spend") is not None:
        tags.append(f"Spend ≥ ₹{int(filters['min_spend']):,}")
    if filters.get("max_spend") is not None:
        tags.append(f"Spend ≤ ₹{int(filters['max_spend']):,}")
    if filters.get("inactive_days") is not None:
        tags.append(f"Inactive {filters['inactive_days']}+ days")
    if filters.get("min_orders") is not None:
        tags.append(f"Orders ≥ {filters['min_orders']}")
    def _extract_val(val):
        import ast
        if isinstance(val, str):
            try:
                parsed = ast.literal_eval(val)
                if isinstance(parsed, (dict, list)):
                    val = parsed
            except Exception:
                pass
        if isinstance(val, dict):
            vals = list(val.values())[0] if val else []
            return ", ".join(vals) if isinstance(vals, list) else str(vals)
        elif isinstance(val, list):
            return ", ".join(val)
        return str(val)

    if filters.get("city"):
        tags.append(f"City: {_extract_val(filters['city'])}")
    if filters.get("category"):
        tags.append(f"Category: {_extract_val(filters['category'])}")
    return tags or ["All customers"]


@router.post("")
def create_segment(payload: SegmentCreateSchema, db: Session = Depends(get_db)):
    try:
        import ast
        filters_dict = {}
        for k, v in payload.filters.items():
            if isinstance(v, str):
                try:
                    parsed = ast.literal_eval(v)
                    filters_dict[k] = parsed
                except Exception:
                    filters_dict[k] = v
            else:
                filters_dict[k] = v

        matching_query = get_matching_customers_query(db, filters_dict)
        customer_count = matching_query.count()

        segment = db.query(Segment).filter(Segment.name == payload.name).first()
        
        if segment:
            segment.filters = filters_dict
            segment.description = payload.description
            segment.customer_count = customer_count
        else:
            segment = Segment(
                name=payload.name,
                description=payload.description,
                filters=filters_dict,
                customer_count=customer_count
            )
            db.add(segment)
            
        db.commit()
        db.refresh(segment)

        return {
            "id": segment.id,
            "name": segment.name,
            "description": segment.description,
            "filters": segment.filters,
            "filter_tags": humanize_filters(segment.filters),
            "customer_count": segment.customer_count,
            "created_at": segment.created_at.isoformat() if segment.created_at else None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
def list_segments(db: Session = Depends(get_db)):
    try:
        segments = db.query(Segment).order_by(Segment.id.desc()).all()
        result = []
        for s in segments:
            # Dynamically recalculate customer_count to avoid stale values
            count = get_matching_customers_query(db, s.filters or {}).count()
            if s.customer_count != count:
                s.customer_count = count
                db.commit()
                
            result.append({
                "id": s.id,
                "name": s.name,
                "description": s.description,
                "filters": s.filters,
                "filter_tags": humanize_filters(s.filters or {}),
                "customer_count": s.customer_count,
                "created_at": s.created_at.isoformat() if s.created_at else None
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{segment_id}")
def get_segment(segment_id: int, db: Session = Depends(get_db)):
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    try:
        matching_query = get_matching_customers_query(db, segment.filters or {})
        fresh_count = matching_query.count()
        if fresh_count != segment.customer_count:
            segment.customer_count = fresh_count
            db.commit()
            db.refresh(segment)
    except Exception:
        pass
    return {
        "id": segment.id,
        "name": segment.name,
        "description": segment.description,
        "filters": segment.filters,
        "filter_tags": humanize_filters(segment.filters or {}),
        "customer_count": segment.customer_count,
        "created_at": segment.created_at.isoformat() if segment.created_at else None
    }


@router.get("/{segment_id}/preview")
def preview_segment(segment_id: int, db: Session = Depends(get_db)):
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    try:
        matching_query = get_matching_customers_query(db, segment.filters or {})
        customers = matching_query.limit(50).all()
        cutoff_date = datetime.now().date() - timedelta(days=60)
        result = []
        for c in customers:
            is_active = c.last_purchase_date >= cutoff_date if c.last_purchase_date else False
            result.append({
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "city": c.city,
                "total_spend": float(c.total_spend),
                "order_count": c.order_count,
                "last_purchase_date": c.last_purchase_date.isoformat() if c.last_purchase_date else None,
                "preferred_category": c.preferred_category,
                "is_active": is_active
            })
        return {
            "segment_id": segment.id,
            "name": segment.name,
            "customer_count": matching_query.count(),
            "filter_tags": humanize_filters(segment.filters or {}),
            "customers": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
