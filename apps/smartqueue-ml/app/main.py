from fastapi import FastAPI

app = FastAPI(
    title="IAD SmartQueue ML Service",
    description="Queue analysis and prediction ML service",
    version="1.0.0"
)

@app.get("/")
async def root():
    return {"message": "Welcome to the IAD SmartQueue ML Service API"}

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "smartqueue-ml"
    }
