# Xeno CRM Copilot 🚀

An AI-native mini CRM for retail brands to segment customers, run personalized marketing campaigns, and track performance in real time.

---

## Architecture

```
xeno-crm/
├── backend/          # FastAPI + SQLAlchemy backend (port 8000)
│   ├── main.py       # App entry point + startup seeding
│   ├── models.py     # SQLAlchemy ORM models
│   ├── database.py   # Database connection setup
│   ├── seed_data.py  # 700-customer seeder with Indian locale
│   ├── init_db.py    # Table creation script
│   └── routers/
│       ├── customers.py    # GET /api/customers, /api/customers/stats
│       ├── segments.py     # CRUD /api/segments
│       ├── campaigns.py    # CRUD + launch /api/campaigns
│       ├── receipt.py      # POST /receipt (delivery callback from channel)
│       └── ai.py           # /api/ai/segment, /api/ai/message, /api/ai/suggest
│
├── channel-service/  # Delivery stub FastAPI app (port 8001)
│   └── main.py       # POST /send → simulate delivery → POST /receipt
│
└── frontend/         # Next.js 16 + TailwindCSS 4 (port 3000)
    └── app/
        ├── page.tsx            # Dashboard
        ├── customers/page.tsx  # Customers with search & filter
        ├── segments/page.tsx   # Segments with Rule Builder + AI Builder
        └── campaigns/
            ├── page.tsx        # Campaign list + create with AI message gen
            └── [id]/page.tsx   # Campaign detail with live polling
```

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+

### Step 1: Start the Backend

```powershell
cd backend
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

The backend starts at **http://localhost:8003**. On first launch:
- Tables are created automatically on Supabase
- 700 customers + 3,500 orders are seeded automatically

### Step 2: Start the Channel Service

```powershell
cd channel-service
.venv\Scripts\activate       # or create a new venv
pip install -r requirements.txt
python main.py
```

The channel stub runs at **http://localhost:8001**.

### Step 3: Start the Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**.

---

## Features

| Feature | Description |
|---|---|
| 🏠 **Dashboard** | KPI cards + AI campaign suggestions + recent campaigns |
| 👥 **Customers** | Browse 700+ customers with search, city/category/status filters, paginated |
| 🎯 **Segments** | Create segments via Rule Builder (filters) or AI Builder (natural language) |
| 📢 **Campaigns** | Create campaigns manually or with AI-generated messages, save as draft or launch instantly |
| 📊 **Campaign Analytics** | Live-polling delivery/open/click metrics, communications log with status filter |
| 🤖 **Groq AI** | AI-powered segment creation, message generation, and proactive campaign suggestions |
| 📬 **Channel Stub** | Simulates WhatsApp/Email/SMS delivery with realistic async delivery receipts |

---

## API Reference

```
GET  /health                              # Health check
GET  /api/customers                       # List customers (search, filter, paginate)
GET  /api/customers/stats                 # Customer statistics
GET  /api/segments                        # List segments
POST /api/segments                        # Create segment
GET  /api/campaigns                       # List campaigns
POST /api/campaigns                       # Create campaign (pass launch=true to auto-launch)
GET  /api/campaigns/{id}                  # Campaign detail with rates
POST /api/campaigns/{id}/launch           # Launch a draft campaign
GET  /api/campaigns/{id}/communications   # Live delivery log
POST /api/ai/segment                      # Translate natural language → filters
POST /api/ai/message                      # Generate campaign message copy
POST /api/ai/suggest                      # Get 3 AI campaign suggestions
POST /receipt                             # Webhook for channel delivery callbacks
```

---

## Environment Variables

### backend/.env
Copy `backend/.env.example` to `backend/.env` and update the keys if necessary (a live `.env.example` is provided for grading convenience):
```
DATABASE_URL=<your-supabase-postgresql-url>
CHANNEL_SERVICE_URL=http://localhost:8001
GROQ_API_KEY=<your-groq-api-key>
CRM_BASE_URL=http://localhost:8003
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### frontend/.env.local
Copy `frontend/.env.local.example` to `frontend/.env.local` and update the keys if necessary:
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
NEXT_PUBLIC_API_URL=http://localhost:8003
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TailwindCSS 4, TypeScript |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL on Supabase |
| AI | Groq (llama-3.1-8b-instant) |
| Channel Stub | FastAPI, httpx |
| Styling | Dark glassmorphism theme, Inter font |
