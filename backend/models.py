from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, Text, ForeignKey, JSON, func, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Customer(Base):
    __tablename__ = 'customers'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100))
    phone = Column(String(20))
    city = Column(String(50))
    total_spend = Column(Numeric(10, 2), default=0.0)
    order_count = Column(Integer, default=0)
    last_purchase_date = Column(Date)
    preferred_category = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())

    orders = relationship("Order", back_populates="customer", cascade="all, delete-orphan")
    communications = relationship("Communication", back_populates="customer", cascade="all, delete-orphan")


class Order(Base):
    __tablename__ = 'orders'

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey('customers.id', ondelete="CASCADE"))
    amount = Column(Numeric(10, 2))
    category = Column(String(50))
    order_date = Column(DateTime, server_default=func.now())

    customer = relationship("Customer", back_populates="orders")


class Segment(Base):
    __tablename__ = 'segments'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    description = Column(Text)
    filters = Column(JSON)  # Stores JSON filter rules
    customer_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    campaigns = relationship("Campaign", back_populates="segment")


class Campaign(Base):
    __tablename__ = 'campaigns'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    segment_id = Column(Integer, ForeignKey('segments.id', ondelete="SET NULL"), nullable=True)
    message_template = Column(Text)
    channel = Column(String(20), default='whatsapp')  # 'whatsapp' or 'email'
    goal = Column(Text)
    status = Column(String(20), default='draft')  # 'draft', 'active', 'completed'
    total_sent = Column(Integer, default=0)
    total_delivered = Column(Integer, default=0)
    total_opened = Column(Integer, default=0)
    total_clicked = Column(Integer, default=0)
    total_failed = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    launched_at = Column(DateTime, nullable=True)

    segment = relationship("Segment", back_populates="campaigns")
    communications = relationship("Communication", back_populates="campaign", cascade="all, delete-orphan")


class Communication(Base):
    __tablename__ = 'communications'
    __table_args__ = (
        UniqueConstraint('campaign_id', 'customer_id', name='uix_campaign_customer'),
    )

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id', ondelete="CASCADE"))
    customer_id = Column(Integer, ForeignKey('customers.id', ondelete="CASCADE"))
    message = Column(Text)
    channel = Column(String(20))
    status = Column(String(20), default='pending')  # 'pending', 'sent', 'delivered', 'opened', 'clicked', 'failed'
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    clicked_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)

    campaign = relationship("Campaign", back_populates="communications")
    customer = relationship("Customer", back_populates="communications")
    events = relationship("Event", back_populates="communication", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = 'events'

    id = Column(Integer, primary_key=True, index=True)
    communication_id = Column(Integer, ForeignKey('communications.id', ondelete="CASCADE"))
    event_type = Column(String(20))  # 'sent', 'delivered', 'opened', 'clicked', 'failed'
    created_at = Column(DateTime, server_default=func.now())

    communication = relationship("Communication", back_populates="events")
