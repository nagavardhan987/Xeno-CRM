import httpx
import time

def test_loop():
    print("=== TESTING E2E LOOP ON RUNNING SERVICES ===")
    client = httpx.Client()
    
    # 1. Check health
    try:
        backend_health = client.get("http://localhost:8000/health").json()
        channel_health = client.get("http://localhost:8001/health").json()
        print(f"Backend Health: {backend_health}")
        print(f"Channel Health: {channel_health}")
    except Exception as e:
        print(f"Health check failed: {e}")
        return
        
    # 2. AI suggestions
    print("\n[AI] Requesting suggestions...")
    try:
        sugs = client.post("http://localhost:8000/api/ai/suggest").json()
        print(f"AI Suggestions count: {len(sugs)}")
        print(f"First AI Suggestion: {sugs[0]['title']} | Reach: {sugs[0]['estimated_reach']}")
    except Exception as e:
        print(f"AI suggestion failed: {e}")
        
    # 3. Translate NL to segment
    print("\n[AI] Translating natural language to segment...")
    try:
        segment_ai = client.post(
            "http://localhost:8000/api/ai/segment",
            json={"description": "customers who spent over 15000 in Mumbai or Delhi"}
        ).json()
        print(f"AI Segment: {segment_ai}")
        filters = segment_ai["filters"]
    except Exception as e:
        print(f"AI segment translation failed: {e}")
        filters = {"min_spend": 15000, "city": "Mumbai"}
        
    # 4. Create segment
    print("\n[Segment] Creating segment...")
    segment_payload = {
        "name": "Mumbai/Delhi High Spenders",
        "description": "High value customers",
        "filters": filters
    }
    seg_res = client.post("http://localhost:8000/api/segments", json=segment_payload).json()
    segment_id = seg_res["id"]
    customer_count = seg_res["customer_count"]
    print(f"Created Segment: {seg_res['name']} (ID: {segment_id}) with {customer_count} customers.")
    
    # 5. Create campaign message using AI
    print("\n[AI] Generating copy for campaign...")
    msg_res = client.post(
        "http://localhost:8000/api/ai/message",
        json={
            "segment_description": "customers who spent over 15000",
            "channel": "whatsapp",
            "goal": "vip sale discount"
        }
    ).json()
    message_template = msg_res["message"]
    print(f"Generated Message: {message_template}")
    
    # 6. Create Campaign
    print("\n[Campaign] Creating campaign...")
    campaign_payload = {
        "name": "VIP Exclusive Sale Promo",
        "segment_id": segment_id,
        "message_template": message_template,
        "channel": "whatsapp",
        "goal": "Upsell VIPs"
    }
    camp_res = client.post("http://localhost:8000/api/campaigns", json=campaign_payload).json()
    campaign_id = camp_res["id"]
    print(f"Created Campaign ID: {campaign_id}, Status: {camp_res['status']}")
    
    # 7. Launch Campaign
    print(f"\n[Campaign] Launching Campaign ID {campaign_id}...")
    launch_res = client.post(f"http://localhost:8000/api/campaigns/{campaign_id}/launch").json()
    print(f"Launch Response: {launch_res}")
    
    # 8. Poll live status updates
    print("\n[Live Polling] Watching status update loop...")
    start_time = time.time()
    for i in range(12):
        time.sleep(3)
        camp_details = client.get(f"http://localhost:8000/api/campaigns/{campaign_id}").json()
        comms = client.get(f"http://localhost:8000/api/campaigns/{campaign_id}/communications").json()
        
        statuses = [c["status"] for c in comms]
        status_dist = {s: statuses.count(s) for s in set(statuses)}
        
        print(f"Time: {int(time.time() - start_time)}s | Campaign Status: {camp_details['status']} | "
              f"Sent={camp_details['total_sent']}, Delivered={camp_details['total_delivered']}, "
              f"Opened={camp_details['total_opened']}, Clicked={camp_details['total_clicked']}, "
              f"Failed={camp_details['total_failed']} | Distribution: {status_dist}")
              
        if camp_details["status"] == "completed" or (camp_details["total_clicked"] + camp_details["total_failed"] == customer_count):
            print("All communications finished!")
            break
            
    # 9. Get insights
    print("\n[AI] Fetching Campaign Performance Insights...")
    insights = client.post(f"http://localhost:8000/api/ai/insights/{campaign_id}").json()
    print(f"Summary: {insights.get('summary')}")
    print(f"Reasons: {insights.get('reasons')}")
    print(f"Recommendations: {insights.get('recommendations')}")

if __name__ == "__main__":
    test_loop()
