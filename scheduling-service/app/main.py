import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException

from .models import GenerateScheduleRequest, GenerateScheduleResponse
from .solver import solve

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("medishift-scheduling")

API_KEY = os.getenv("SCHEDULING_SERVICE_API_KEY", "")

app = FastAPI(title="MediShift Scheduling Service", version="1.0.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/generate", response_model=GenerateScheduleResponse)
def generate_schedule(
    request: GenerateScheduleRequest, x_api_key: str | None = Header(default=None, alias="X-API-Key")
) -> GenerateScheduleResponse:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    logger.info(
        "Generating schedule %s: %d shifts, %d employees",
        request.scheduleId,
        len(request.shifts),
        len(request.employees),
    )

    try:
        result = solve(request)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Solver failed")
        raise HTTPException(status_code=500, detail=f"Solver error: {exc}") from exc

    logger.info("Schedule %s solved: %s", request.scheduleId, result.status)
    return result
