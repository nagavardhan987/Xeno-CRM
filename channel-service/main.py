import os
import random
import asyncio
import httpx
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

CRM_BASE_URL = os.getenv("CRM_BASE_URL", "http://127.0.0.1:8003")

app = FastAPI(
    title="Xeno Channel Stub Service",
    description="Simulates messaging channel delivery with realistic async callbacks",
    version="2.0.0"
)

class SendRequest(BaseModel):
    communication_id: int
    customer_name: str
    message: str
    channel: str

# Realistic probabilities per channel
CHANNEL_CONFIG = {
    "whatsapp": {
        "fail_rate": 0.08,          # 8% fail
        "open_rate": 0.72,          # 72% of delivered are opened
        "click_rate": 0.38,         # 38% of opened are clicked
        "delivery_delay": (0.5, 2), # seconds
        "open_delay": (2, 8),
        "click_delay": (3, 10),
    },
    "email": {
        "fail_rate": 0.05,
        "open_rate": 0.45,
        "click_rate": 0.22,
        "delivery_delay": (1, 3),
        "open_delay": (5, 15),
        "click_delay": (5, 12),
    },
    "sms": {
        "fail_rate": 0.10,
        "open_rate": 0.85,
        "click_rate": 0.15,
        "delivery_delay": (0.3, 1.5),
        "open_delay": (1, 5),
        "click_delay": (2, 8),
    },
}

DEFAULT_CONFIG = CHANNEL_CONFIG["whatsapp"]

async def post_receipt(communication_id: int, event: str) -> bool:
    url = f"{CRM_BASE_URL}/api/receipt"
    payload = {"communication_id": communication_id, "event": event}
    for attempt in range(3):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=5.0)
                if resp.status_code == 200:
                    print(f"[CH] comm={communication_id} event={event} ✓")
                    return True
                print(f"[CH] comm={communication_id} event={event} HTTP {resp.status_code}")
        except Exception as e:
            print(f"[CH] comm={communication_id} event={event} attempt {attempt+1} error: {e}")
        await asyncio.sleep(2 ** attempt)
    print(f"[CH] FAILED to deliver event={event} for comm={communication_id}")
    return False

async def simulate_delivery(communication_id: int, channel: str = "whatsapp"):
    cfg = CHANNEL_CONFIG.get(channel.lower(), DEFAULT_CONFIG)

    # Step 1: Random failure before even sending
    if random.random() < cfg["fail_rate"]:
        await asyncio.sleep(random.uniform(*cfg["delivery_delay"]))
        await post_receipt(communication_id, "failed")
        return

    # Step 2: Sent immediately
    await post_receipt(communication_id, "sent")

    # Step 3: Delivered after short delay
    await asyncio.sleep(random.uniform(*cfg["delivery_delay"]))
    await post_receipt(communication_id, "delivered")

    # Step 4: Maybe opened
    await asyncio.sleep(random.uniform(*cfg["open_delay"]))
    if random.random() < cfg["open_rate"]:
        await post_receipt(communication_id, "opened")

        # Step 5: Maybe clicked (only if opened)
        await asyncio.sleep(random.uniform(*cfg["click_delay"]))
        if random.random() < cfg["click_rate"]:
            await post_receipt(communication_id, "clicked")


@app.post("/send")
def send_message(payload: SendRequest, background_tasks: BackgroundTasks):
    print(f"[CH] Received: customer={payload.customer_name} comm={payload.communication_id} channel={payload.channel}")
    background_tasks.add_task(simulate_delivery, payload.communication_id, payload.channel)
    return {"status": "accepted", "communication_id": payload.communication_id}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "channel-service", "version": "2.0"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
