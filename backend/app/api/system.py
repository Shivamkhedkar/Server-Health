import platform
import socket

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.schemas.system import SystemInfoResponse

router = APIRouter(prefix="/system", tags=["System"], dependencies=[Depends(get_current_user)])


@router.get("/info", response_model=SystemInfoResponse)
def get_system_info():
    """Real backend host identity - replaces any hardcoded 'Node: ...' label
    on the frontend with the actual hostname the FastAPI process is running
    on (container hostname when running under Docker)."""
    return SystemInfoResponse(
        hostname=socket.gethostname(),
        platform=platform.system(),
    )
