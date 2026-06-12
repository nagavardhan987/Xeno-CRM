from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from database import get_db
from models import Customer, Order

router = APIRouter(prefix="/api/customers", tags=["customers"])

@router.get("/stats")
def get_customer_stats(db: Session = Depends(get_db)):
    try:
        # Total count
        total_count = db.query(Customer).count()
        
        # Avg spend
        avg_spend_res = db.query(func.avg(Customer.total_spend)).scalar()
        avg_spend = float(avg_spend_res) if avg_spend_res else 0.0
        
        # Cities breakdown
        city_stats = db.query(
            Customer.city, 
            func.count(Customer.id).label("count")
        ).group_by(Customer.city).all()
        
        cities_breakdown = {city: count for city, count in city_stats}
        
        # Active vs Inactive count
        # Active: last purchase < 60 days ago
        cutoff_date = datetime.now().date() - timedelta(days=60)
        active_count = db.query(Customer).filter(Customer.last_purchase_date >= cutoff_date).count()
        inactive_count = total_count - active_count
        
        recoverable_revenue = inactive_count * avg_spend

        return {
            "total_customers": total_count,
            "average_spend": round(avg_spend, 2),
            "cities_breakdown": cities_breakdown,
            "active_count": active_count,
            "inactive_count": inactive_count,
            "recoverable_revenue": round(recoverable_revenue, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
def list_customers(
    search: Optional[str] = None,
    city: Optional[str] = None,
    category: Optional[str] = None,
    min_spend: Optional[float] = None,
    max_spend: Optional[float] = None,
    min_orders: Optional[int] = None,
    max_orders: Optional[int] = None,
    status: Optional[str] = None,  # 'active' (<60 days), 'inactive' (>=60 days)
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(Customer)
        
        if search:
            query = query.filter(
                or_(
                    Customer.name.ilike(f"%{search}%"),
                    Customer.email.ilike(f"%{search}%"),
                    Customer.phone.ilike(f"%{search}%")
                )
            )
            
        if city:
            query = query.filter(Customer.city == city)
            
        if category:
            query = query.filter(Customer.preferred_category == category)
            
        if min_spend is not None:
            query = query.filter(Customer.total_spend >= min_spend)
            
        if max_spend is not None:
            query = query.filter(Customer.total_spend <= max_spend)
            
        if min_orders is not None:
            query = query.filter(Customer.order_count >= min_orders)
            
        if max_orders is not None:
            query = query.filter(Customer.order_count <= max_orders)
            
        if status:
            cutoff_date = datetime.now().date() - timedelta(days=60)
            if status.lower() == 'active':
                query = query.filter(Customer.last_purchase_date >= cutoff_date)
            elif status.lower() == 'inactive':
                query = query.filter(Customer.last_purchase_date < cutoff_date)
        
        total_matching = query.count()
        customers = query.order_by(Customer.id).offset(offset).limit(limit).all()
        
        # Serialize with active status calculated
        cutoff_date = datetime.now().date() - timedelta(days=60)
        result = []
        for c in customers:
            is_active = c.last_purchase_date >= cutoff_date
            result.append({
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "phone": c.phone,
                "city": c.city,
                "total_spend": float(c.total_spend),
                "order_count": c.order_count,
                "last_purchase_date": c.last_purchase_date.isoformat() if c.last_purchase_date else None,
                "preferred_category": c.preferred_category,
                "is_active": is_active,
                "created_at": c.created_at.isoformat() if c.created_at else None
            })
            
        return {
            "total": total_matching,
            "limit": limit,
            "offset": offset,
            "customers": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    orders = db.query(Order).filter(Order.customer_id == customer_id).order_by(Order.order_date.desc()).all()
    
    cutoff_date = datetime.now().date() - timedelta(days=60)
    is_active = customer.last_purchase_date >= cutoff_date if customer.last_purchase_date else False
    
    customer_data = {
        "id": customer.id,
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "city": customer.city,
        "total_spend": float(customer.total_spend),
        "order_count": customer.order_count,
        "last_purchase_date": customer.last_purchase_date.isoformat() if customer.last_purchase_date else None,
        "preferred_category": customer.preferred_category,
        "is_active": is_active,
        "created_at": customer.created_at.isoformat() if customer.created_at else None
    }
    
    orders_data = [{
        "id": o.id,
        "amount": float(o.amount),
        "category": o.category,
        "order_date": o.order_date.isoformat() if o.order_date else None
    } for o in orders]
    
    return {
        "customer": customer_data,
        "orders": orders_data
    }
