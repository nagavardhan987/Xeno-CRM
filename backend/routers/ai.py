import os
import httpx
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from database import get_db
from models import Customer, Campaign, Segment, Communication, Order
from routers.segments import get_matching_customers_query, get_vip_threshold, humanize_filters

router = APIRouter(prefix="/api/ai", tags=["ai"])


class CopilotPromptSchema(BaseModel):
    prompt: str

class SegmentPromptSchema(BaseModel):
    description: str

class MessagePromptSchema(BaseModel):
    segment_description: Optional[str] = None
    campaign_goal: Optional[str] = None
    channel: str = "whatsapp"
    goal: Optional[str] = "re-engagement"
    segment_name: Optional[str] = None
    customer_count: Optional[int] = 0

class ChatMessageSchema(BaseModel):
    role: str
    content: str

class ChatPromptSchema(BaseModel):
    message: str
    history: List[ChatMessageSchema] = []


def get_groq_headers():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set")
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


async def call_groq(messages: List[Dict[str, str]], json_mode: bool = False) -> str:
    headers = get_groq_headers()
    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": messages,
        "temperature": 0.3
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=headers, timeout=30.0)
            if resp.status_code != 200:
                print(f"Groq error: {resp.text}")
                raise HTTPException(status_code=502, detail=f"Groq API error: {resp.status_code}")
            return resp.json()["choices"][0]["message"]["content"]
        except HTTPException:
            raise
        except Exception as e:
            print(f"Groq call error: {e}")
            raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

def parse_llm_json(response_text: str) -> dict:
    """Safely parse JSON from LLM, stripping markdown code blocks if present."""
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return json.loads(text)


# ── /api/ai/segment ──────────────────────────────────────────────────────────

@router.post("/segment")
async def ai_segment(payload: SegmentPromptSchema, db: Session = Depends(get_db)):
    """Translate natural language audience description into CRM segment filters."""

    # Compute dynamic thresholds to give AI accurate context
    vip_threshold = get_vip_threshold(db)
    total_customers = db.query(Customer).count()
    avg_spend = float(db.query(func.avg(Customer.total_spend)).scalar() or 0)
    cutoff_60 = datetime.now().date() - timedelta(days=60)
    inactive_count = db.query(Customer).filter(Customer.last_purchase_date <= cutoff_60).count()

    system_prompt = (
        "You are a CRM segmentation engine for an Indian retail brand. "
        "Convert the user's natural language audience description into a JSON filter object. "
        "Return ONLY a valid JSON object with no markdown or explanation.\n\n"
        "AVAILABLE FILTER KEYS:\n"
        "- min_spend (number): Minimum total spend in ₹\n"
        "- max_spend (number): Maximum total spend in ₹\n"
        "- inactive_days (integer): Customers who haven't bought in this many days\n"
        "- min_orders (integer): Minimum number of past orders\n"
        "- city (string): One of: Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Pune, Kolkata\n"
        "- category (string): One of: Apparel, Footwear, Accessories, Beauty, Electronics\n"
        "- vip (boolean true): Top 10%% spenders\n"
        "- new_customers (boolean true): Customers who purchased in last 30 days\n\n"
        "BUSINESS RULES TO MAP (VERY IMPORTANT - USE EXACTLY THESE):\n"
        f"- 'Bring back inactive customers' → {{\"inactive_days\": 60, \"min_spend\": 3000}}\n"
        f"- 'Win back churned customers' → {{\"inactive_days\": 90, \"min_orders\": 2}}\n"
        f"- 'Upsell VIP shoppers' → {{\"min_spend\": 15000, \"min_orders\": 5}}\n"
        f"- 'Reward frequent buyers' → {{\"min_orders\": 5}}\n"
        f"- 'Increase repeat purchases' → {{\"min_orders\": 1, \"new_customers\": true}}\n"
        f"- 'VIP customers' or 'top customers' → {{\"vip\": true}}\n"
        f"- 'High value' or 'big spenders' → {{\"min_spend\": {int(vip_threshold)}}}\n"
        "- 'Inactive' or 'lapsed' → {\"inactive_days\": 60}\n"
        "- 'New customers' or 'recent buyers' → {\"new_customers\": true}\n\n"
        "NOTE: Target audience size should be 5% - 40% of the customer base. Do NOT return empty filters unless absolutely necessary."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Audience description: {payload.description}"}
    ]

    response_text = await call_groq(messages, json_mode=True)

    try:
        parsed_filters = parse_llm_json(response_text)
        # Strip any non-filter keys AI might hallucinate
        valid_keys = {"min_spend", "max_spend", "inactive_days", "min_orders",
                      "city", "category", "vip", "new_customers"}
        parsed_filters = {k: v for k, v in parsed_filters.items() if k in valid_keys}

        count = get_matching_customers_query(db, parsed_filters).count()
        tags = humanize_filters(parsed_filters)

        # Build explanation
        parts = []
        if parsed_filters.get("vip"):
            parts.append(f"are VIP customers (top 10% spenders, spend ≥ ₹{int(vip_threshold):,})")
        if parsed_filters.get("new_customers"):
            parts.append("have purchased within the last 30 days")
        if parsed_filters.get("min_spend"):
            parts.append(f"have spent at least ₹{int(parsed_filters['min_spend']):,}")
        if parsed_filters.get("inactive_days"):
            parts.append(f"haven't purchased in {parsed_filters['inactive_days']}+ days")
        if parsed_filters.get("min_orders"):
            parts.append(f"have placed {parsed_filters['min_orders']}+ orders")
        if parsed_filters.get("city"):
            parts.append(f"are located in {parsed_filters['city']}")
        if parsed_filters.get("category"):
            parts.append(f"prefer {parsed_filters['category']}")

        # Build bullet points for reasoning panel
        reasoning = []
        if parsed_filters.get("vip"): reasoning.append(f"Top 10% spenders (Spend > ₹{int(vip_threshold):,})")
        if parsed_filters.get("new_customers"): reasoning.append("Purchased within the last 30 days")
        if parsed_filters.get("min_spend"): reasoning.append(f"Average spend > ₹{int(parsed_filters['min_spend']):,}")
        if parsed_filters.get("inactive_days"): reasoning.append(f"Last purchase > {parsed_filters['inactive_days']} days ago")
        if parsed_filters.get("min_orders"): reasoning.append(f"High engagement ({parsed_filters['min_orders']}+ past orders)")
        if parsed_filters.get("city"): reasoning.append(f"Located in {parsed_filters['city']}")
        if parsed_filters.get("category"): reasoning.append(f"Shopped for {parsed_filters['category']}")
        if not reasoning: reasoning.append("Broad audience criteria applied")
        reasoning.append("High likelihood of converting based on historical patterns")

        explanation = ("Customers who " + ", ".join(parts) + ".") if parts else "All customers."

        return {
            "filters": parsed_filters,
            "filter_tags": tags,
            "customer_count": count,
            "explanation": explanation,
            "reasoning": reasoning
        }
    except Exception as e:
        print(f"Segment parse error: {e}. Raw: {response_text}")
        raise HTTPException(status_code=500, detail="AI returned invalid format. Try rephrasing.")


# ── /api/ai/message ───────────────────────────────────────────────────────────

@router.post("/message")
async def ai_message(payload: MessagePromptSchema):
    """Generate personalized campaign message copy."""
    seg_desc = payload.segment_description or payload.segment_name or "valued customers"
    goal_text = payload.campaign_goal or payload.goal or "re-engagement"

    char_limit = "160 characters" if payload.channel in ("whatsapp", "sms") else "300 characters"

    system_prompt = (
        f"You are a marketing copywriter for an Indian retail brand. "
        f"Write a personalized {payload.channel.upper()} campaign message. "
        f"Keep it under {char_limit}. "
        f"Use {{name}} as placeholder for the customer's first name. "
        f"Be warm, professional, and include a clear call-to-action. "
        f"Use relevant emojis. Do NOT use markdown. "
        f"Return JSON with keys: 'message' (the copy text) and 'explanation' (one sentence rationale)."
    )
    user_prompt = (
        f"Target audience: {seg_desc}\n"
        f"Campaign goal: {goal_text}\n"
        f"Channel: {payload.channel}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    response_text = await call_groq(messages, json_mode=True)
    try:
        data = parse_llm_json(response_text)
        return {
            "message": data.get("message", "").strip(),
            "explanation": data.get("explanation", "AI-generated campaign message.")
        }
    except Exception as e:
        print(f"Message parse error: {e}. Raw: {response_text}")
        return {"message": response_text.strip(), "explanation": "AI-generated message."}


# ── /api/ai/copilot/build ────────────────────────────────────────────────────────
@router.post("/copilot/build")
async def ai_copilot_build(payload: CopilotPromptSchema, db: Session = Depends(get_db)):
    """Full natural language campaign builder (7-step workflow)."""
    vip_threshold = get_vip_threshold(db)
    
    # 1. First LLM Call: Extract Intent & Filters
    system_prompt_1 = (
        "You are an AI Marketing Assistant. Analyze the user's campaign prompt. "
        "Extract the audience, conditions, objective, and goal. "
        "Also generate a strict JSON object of CRM filters.\n\n"
        "AVAILABLE FILTER KEYS:\n"
        "- min_spend (number): Minimum total spend in ₹\n"
        "- max_spend (number): Maximum total spend in ₹\n"
        "- inactive_days (integer): Customers who haven't bought in this many days\n"
        "- min_orders (integer): Minimum number of past orders\n"
        "- city (string): Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Pune, Kolkata\n"
        "- category (string): Apparel, Footwear, Accessories, Beauty, Electronics\n"
        "- vip (boolean true): Top 10% spenders\n"
        "- new_customers (boolean true): Customers who purchased in last 30 days\n\n"
        "Return ONLY valid JSON with this structure:\n"
        "{\n"
        "  \"intent\": {\"audience\": \"...\", \"conditions\": \"...\", \"objective\": \"...\", \"goal\": \"...\"},\n"
        "  \"filters\": { /* strict keys above */ }\n"
        "}"
    )
    
    res1_text = await call_groq([
        {"role": "system", "content": system_prompt_1},
        {"role": "user", "content": payload.prompt}
    ], json_mode=True)
    
    try:
        data1 = parse_llm_json(res1_text)
        intent = data1.get("intent", {})
        filters = data1.get("filters", {})
    except:
        intent = {"audience": "All customers", "conditions": "None", "objective": "General engagement", "goal": "Awareness"}
        filters = {}

    # 2. Database Query: Estimate Audience Size & Revenue
    valid_keys = {"min_spend", "max_spend", "inactive_days", "min_orders", "city", "category", "vip", "new_customers"}
    clean_filters = {k: v for k, v in filters.items() if k in valid_keys}
    
    q = get_matching_customers_query(db, clean_filters)
    audience_size = q.count()
    
    if audience_size > 0:
        avg_spend_res = db.query(func.avg(Customer.total_spend)).filter(Customer.id.in_([c.id for c in q.limit(1000).all()])).scalar()
        avg_spend = float(avg_spend_res or 0)
    else:
        avg_spend = 0.0

    # Assume 15% open rate and 8% conversion on average for baseline
    est_open_rate = 15.0 if "vip" not in clean_filters else 25.0
    est_conversion = 8.0 if "inactive_days" not in clean_filters else 4.0
    potential_revenue = audience_size * avg_spend * (est_conversion / 100)

    # 3. Second LLM Call: Generate Channel, Message & Reasoning
    system_prompt_2 = (
        "You are an AI Marketing Strategist. Based on the target audience stats, "
        "recommend the best channel (whatsapp, sms, or email), write a highly personalized message, "
        "and provide 5 bullet points of reasoning.\n\n"
        "Return ONLY valid JSON with this structure:\n"
        "{\n"
        "  \"channel\": {\"recommended\": \"whatsapp|sms|email\", \"reason\": \"...\"},\n"
        "  \"message\": \"Hi {name}, ...\",\n"
        "  \"metrics\": {\"est_open_rate\": 22.5, \"est_conversion\": 8.0},\n"
        "  \"reasoning\": [\"5 bullet points\", \"explaining why\", \"this campaign\", \"will work\", \"...\"]\n"
        "}"
    )
    user_prompt_2 = (
        f"Campaign Goal: {intent.get('goal', 'Marketing')}\n"
        f"Audience: {intent.get('audience', 'Customers')}\n"
        f"Audience Size: {audience_size}\n"
        f"Avg Spend: ₹{int(avg_spend):,}\n"
        f"Potential Recoverable Revenue: ₹{int(potential_revenue):,}\n"
    )
    
    res2_text = await call_groq([
        {"role": "system", "content": system_prompt_2},
        {"role": "user", "content": user_prompt_2}
    ], json_mode=True)
    
    try:
        data2 = parse_llm_json(res2_text)
    except:
        data2 = {
            "channel": {"recommended": "whatsapp", "reason": "High engagement"},
            "message": "Hi {name}, we have a special offer for you!",
            "metrics": {"est_open_rate": est_open_rate, "est_conversion": est_conversion},
            "reasoning": [f"{audience_size} customers match the criteria.", f"Average spend ₹{int(avg_spend):,}.", f"Estimated open rate {est_open_rate}%.", f"Estimated conversion {est_conversion}%.", f"Potential recoverable revenue ₹{int(potential_revenue):,}."]
        }

    # Final payload assembly
    return {
        "intent": intent,
        "filters": clean_filters,
        "filter_tags": humanize_filters(clean_filters),
        "metrics": {
            "audience_size": audience_size,
            "avg_spend": int(avg_spend),
            "potential_revenue": int(potential_revenue),
            "est_open_rate": data2.get("metrics", {}).get("est_open_rate", est_open_rate),
            "est_conversion": data2.get("metrics", {}).get("est_conversion", est_conversion)
        },
        "channel": data2.get("channel", {"recommended": "whatsapp", "reason": "Standard"}),
        "message": data2.get("message", "Hi {name}, we have an offer for you!"),
        "reasoning": data2.get("reasoning", [f"{audience_size} targeted customers."])
    }


# ── /api/ai/suggest ───────────────────────────────────────────────────────────


@router.post("/suggest")
async def ai_suggest(db: Session = Depends(get_db)):
    """Generate 3 proactive campaign suggestions based on current customer data."""
    try:
        total_customers = db.query(Customer).count()
        avg_spend = float(db.query(func.avg(Customer.total_spend)).scalar() or 0)
        vip_threshold = get_vip_threshold(db)

        cutoff_60 = datetime.now().date() - timedelta(days=60)
        cutoff_90 = datetime.now().date() - timedelta(days=90)
        inactive_60 = db.query(Customer).filter(Customer.last_purchase_date <= cutoff_60).count()
        inactive_90 = db.query(Customer).filter(Customer.last_purchase_date <= cutoff_90).count()
        vip_count = db.query(Customer).filter(Customer.total_spend >= min(vip_threshold, 15000)).count()

        city_stats = db.query(Customer.city, func.count(Customer.id)).group_by(Customer.city).order_by(func.count(Customer.id).desc()).limit(3).all()
        cat_stats = db.query(Customer.preferred_category, func.count(Customer.id)).group_by(Customer.preferred_category).order_by(func.count(Customer.id).desc()).limit(3).all()
        top_cities = ", ".join([f"{c} ({n})" for c, n in city_stats])
        top_cats = ", ".join([f"{c} ({n})" for c, n in cat_stats])

        system_prompt = (
            "You are a growth marketing copilot for an Indian retail brand. "
            "Analyze the customer data and suggest exactly 3 high-impact campaigns. "
            "Return a JSON object with key 'suggestions' containing an array of 3 objects, each with:\n"
            "- title: Short catchy campaign name\n"
            "- audience: One-line description of who this targets\n"
            "- reason: Specific data-backed rationale (mention the actual numbers)\n"
            "- channel: 'whatsapp', 'email', or 'sms'\n"
            "- message_template: A ready-to-send message using {name} placeholder\n"
            "- filters: Valid segment filter object. Keys: min_spend, max_spend, inactive_days, "
            "min_orders, city, category, vip (bool), new_customers (bool)\n\n"
            "Make campaigns diverse: one re-engagement, one upsell, one loyalty/VIP."
        )
        user_prompt = (
            f"Customer Base Stats:\n"
            f"- Total customers: {total_customers}\n"
            f"- Average spend: ₹{avg_spend:,.0f}\n"
            f"- VIP customers (top 10%): {vip_count} (spend ≥ ₹{vip_threshold:,.0f})\n"
            f"- Inactive 60+ days: {inactive_60}\n"
            f"- Inactive 90+ days: {inactive_90}\n"
            f"- Top cities: {top_cities}\n"
            f"- Top categories: {top_cats}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response_text = await call_groq(messages, json_mode=True)
        data = parse_llm_json(response_text)
        suggestions = data.get("suggestions", [])

        for sug in suggestions:
            filters = sug.get("filters", {})
            # Sanitize filter keys
            valid_keys = {"min_spend", "max_spend", "inactive_days", "min_orders",
                          "city", "category", "vip", "new_customers"}
            filters = {k: v for k, v in filters.items() if k in valid_keys}
            sug["filters"] = filters
            try:
                sug["estimated_reach"] = get_matching_customers_query(db, filters).count()
            except Exception:
                sug["estimated_reach"] = 0
            sug["filter_tags"] = humanize_filters(filters)

        return suggestions

    except Exception as e:
        print(f"Suggest error: {e}")
        return [
            {
                "title": "Win Back Inactive Shoppers",
                "audience": "Customers inactive for 90+ days",
                "reason": f"{inactive_60} customers haven't shopped in 60+ days. A targeted offer can revive them.",
                "channel": "whatsapp",
                "message_template": "Hey {name}! 👋 We miss you! Come back and enjoy 20% off your next order. Use code COMEBACK20 🛍️",
                "filters": {"inactive_days": 90},
                "estimated_reach": inactive_60,
                "filter_tags": ["Inactive 90+ days"]
            },
            {
                "title": "VIP Exclusive Preview",
                "audience": "Top 10% spenders",
                "reason": f"{vip_count} VIP customers haven't received a personalized touch recently.",
                "channel": "email",
                "message_template": "Hello {name}, as one of our most valued customers, you get early access to our new collection! 🌟 Shop now with code VIP15.",
                "filters": {"vip": True},
                "estimated_reach": vip_count,
                "filter_tags": ["VIP Customers (top spenders)"]
            }
        ]


# ── /api/ai/insights/{campaign_id} ────────────────────────────────────────────

@router.post("/insights/{campaign_id}")
async def ai_insights(campaign_id: int, db: Session = Depends(get_db)):
    """Generate AI analysis of campaign performance."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    try:
        total_sent = campaign.total_sent or 0
        total_delivered = campaign.total_delivered or 0
        total_opened = campaign.total_opened or 0
        total_clicked = campaign.total_clicked or 0
        total_failed = campaign.total_failed or 0

        deliver_rate = (total_delivered / total_sent * 100) if total_sent > 0 else 0
        open_rate = (total_opened / total_delivered * 100) if total_delivered > 0 else 0
        click_rate = (total_clicked / total_opened * 100) if total_opened > 0 else 0

        # Get segment info
        segment = db.query(Segment).filter(Segment.id == campaign.segment_id).first()
        seg_description = ", ".join(humanize_filters(segment.filters or {})) if segment else "general audience"

        system_prompt = (
            "You are a senior marketing analyst for an Indian retail brand. "
            "Analyze the campaign performance data and return a JSON object with:\n"
            "- summary: 2-3 sentences on overall performance with specific numbers\n"
            "- performance_score: integer 1-10 rating of the campaign\n"
            "- observations: list of 2-3 specific insights on the metrics\n"
            "- recommendations: list of 2-3 concrete next steps to improve future campaigns\n"
            "- highlight: one standout positive or concern in one sentence\n"
            "Be specific, data-driven, and actionable. Reference the actual numbers."
        )
        user_prompt = (
            f"Campaign: {campaign.name}\n"
            f"Channel: {campaign.channel}\n"
            f"Target segment: {seg_description}\n"
            f"Goal: {campaign.goal or 'Not specified'}\n"
            f"Message: {campaign.message_template[:200]}\n\n"
            f"Results:\n"
            f"- Sent: {total_sent}\n"
            f"- Delivered: {total_delivered} ({deliver_rate:.1f}%)\n"
            f"- Opened: {total_opened} ({open_rate:.1f}%)\n"
            f"- Clicked: {total_clicked} ({click_rate:.1f}%)\n"
            f"- Failed: {total_failed}\n"
            f"- Status: {campaign.status}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response_text = await call_groq(messages, json_mode=True)
        data = parse_llm_json(response_text)
        return data

    except Exception as e:
        print(f"Insights error: {e}")
        return {
            "summary": "Campaign analytics are being gathered. Check back once delivery is complete.",
            "performance_score": 0,
            "reasons": ["Metrics are still being collected as messages are delivered."],
            "recommendations": ["Wait for campaign completion before analyzing results."],
            "highlight": "Campaign is still in progress."
        }


# ── /api/ai/chat ──────────────────────────────────────────────────────────────

@router.post("/chat")
async def ai_chat(payload: ChatPromptSchema, db: Session = Depends(get_db)):
    """Conversational AI copilot endpoint."""
    try:
        total_customers = db.query(Customer).count()
        avg_spend = float(db.query(func.avg(Customer.total_spend)).scalar() or 0)
        vip_threshold = get_vip_threshold(db)
        cutoff_60 = datetime.now().date() - timedelta(days=60)
        inactive_count = db.query(Customer).filter(Customer.last_purchase_date <= cutoff_60).count()

        system_prompt = (
            "You are Xeno CRM Copilot, an AI marketing assistant for an Indian retail brand. "
            "Help the marketer achieve their business goal step by step.\n\n"
            f"Current customer data context:\n"
            f"- Total customers: {total_customers}\n"
            f"- Average spend: ₹{avg_spend:,.0f}\n"
            f"- VIP threshold: ₹{vip_threshold:,.0f}\n"
            f"- Inactive 60+ days: {inactive_count}\n\n"
            "Return a JSON object with:\n"
            "1. 'reply': Your conversational response (plain text, no markdown)\n"
            "2. 'action': One of these objects (or null):\n"
            "   - {\"type\": \"suggest_segment\", \"filters\": {...}, \"explanation\": \"...\"}\n"
            "   - {\"type\": \"suggest_message\", \"channel\": \"whatsapp\", \"message\": \"...\"}\n"
            "   - {\"type\": \"ready_to_launch\", \"summary\": \"...\"}\n"
            "   - null (for general conversation)\n\n"
            "Available filter keys: min_spend, max_spend, inactive_days, min_orders, "
            "city, category, vip (bool), new_customers (bool).\n"
            "Be conversational, concise, and focus on helping them launch a campaign."
        )

        messages = [{"role": "system", "content": system_prompt}]
        for msg in payload.history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": payload.message})

        response_text = await call_groq(messages, json_mode=True)
        data = parse_llm_json(response_text)
        return data

    except Exception as e:
        print(f"Chat error: {e}")
        return {
            "reply": "I'm having trouble right now. Please try again.",
            "action": None
        }
