import sys
import os
import random
from datetime import datetime, timedelta
from decimal import Decimal

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from faker import Faker
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Customer, Order

def seed_db():
    fake = Faker('en_IN')
    db = SessionLocal()
    
    try:
        # Check if database already has customers
        customer_count = db.query(Customer).count()
        if customer_count > 0:
            print(f"Database already seeded with {customer_count} customers. Skipping seeding.")
            return

        print("Seeding database with 700 customers and 3500 orders...")
        
        cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata']
        categories = ['Apparel', 'Footwear', 'Accessories', 'Beauty', 'Electronics']
        
        # We need 700 customers:
        # 30% recent (1-20 days ago) -> 210 customers
        # 30% mildly inactive (21-60 days ago) -> 210 customers
        # 40% inactive (61-150 days ago) -> 280 customers
        
        customer_groups = [
            {"count": 210, "min_days": 1, "max_days": 20},
            {"count": 210, "min_days": 21, "max_days": 60},
            {"count": 280, "min_days": 61, "max_days": 150}
        ]
        
        today = datetime.now().date()
        
        all_customers = []
        
        for group in customer_groups:
            for _ in range(group["count"]):
                name = fake.name()
                email = f"{name.lower().replace(' ', '.')}@{fake.free_email_domain()}"
                # clean up email
                email = "".join(c for c in email if c.isalnum() or c in ['.', '@', '-', '_'])
                phone = fake.phone_number()
                # sanitize phone to keep simple
                phone = "".join(c for c in phone if c.isdigit() or c in ['+', '-'])[:20]
                
                city = random.choice(cities)
                total_spend = Decimal(round(random.uniform(500, 30000), 2))
                order_count = random.randint(1, 25)
                
                # Calculate last purchase date
                days_ago = random.randint(group["min_days"], group["max_days"])
                last_purchase_date = today - timedelta(days=days_ago)
                
                preferred_category = random.choice(categories)
                
                customer = Customer(
                    name=name,
                    email=email,
                    phone=phone,
                    city=city,
                    total_spend=total_spend,
                    order_count=order_count,
                    last_purchase_date=last_purchase_date,
                    preferred_category=preferred_category
                )
                db.add(customer)
                all_customers.append(customer)
        
        # Commit customers so they get IDs
        db.commit()
        print("700 Customers inserted. Now creating 3,500 orders...")
        
        # Now we need to distribute 3,500 orders across the 700 customers
        # To make it perfectly consistent, we will distribute them based on each customer's order_count.
        # But wait, the sum of all customer order_counts might not be exactly 3,500.
        # Let's adjust order_counts so that they sum to exactly 3,500!
        # Initial sum of order counts:
        current_sum = sum(c.order_count for c in all_customers)
        diff = 3500 - current_sum
        
        # Adjust customer order counts randomly to make the sum exactly 3500
        while diff != 0:
            cust = random.choice(all_customers)
            if diff > 0 and cust.order_count < 35:
                cust.order_count += 1
                diff -= 1
            elif diff < 0 and cust.order_count > 1:
                cust.order_count -= 1
                diff += 1
        
        # Commit updated order counts
        db.commit()
        
        # Now generate the orders for each customer
        for customer in all_customers:
            n = customer.order_count
            total = float(customer.total_spend)
            
            # Generate n positive random values that sum to total
            if n == 1:
                amounts = [total]
            else:
                # generate random weights
                weights = [random.random() for _ in range(n)]
                sum_w = sum(weights)
                amounts = [round((w / sum_w) * total, 2) for w in weights]
                # Fix rounding errors on the last order
                diff = round(total - sum(amounts), 2)
                amounts[-1] = round(amounts[-1] + diff, 2)
            
            # Last purchase order must be on last_purchase_date
            # Other orders must be at or before last_purchase_date
            last_date_dt = datetime.combine(customer.last_purchase_date, datetime.min.time())
            
            for i, amt in enumerate(amounts):
                if i == n - 1:
                    # Last purchase
                    order_date = last_date_dt + timedelta(hours=random.randint(9, 18))
                else:
                    # Previous purchases (up to 365 days before the last purchase)
                    days_prior = random.randint(1, 365)
                    order_date = last_date_dt - timedelta(days=days_prior) + timedelta(hours=random.randint(9, 18))
                
                # Order category: 70% chance it's preferred category, 30% chance other
                if random.random() < 0.70:
                    cat = customer.preferred_category
                else:
                    cat = random.choice(categories)
                    
                order = Order(
                    customer_id=customer.id,
                    amount=Decimal(amt),
                    category=cat,
                    order_date=order_date
                )
                db.add(order)
        
        db.commit()
        print("Database seeded successfully with 700 customers and 3500 orders!")
        
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}", file=sys.stderr)
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
