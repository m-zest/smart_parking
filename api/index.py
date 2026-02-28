import sys
import os

# Add backend to Python path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from fastapi import FastAPI  # noqa: E402
from app.main import app as backend_app  # noqa: E402

# Vercel sends full path like /api/sessions/ to this function.
# Mount the backend app at /api so its routes (/sessions/, /zones/, etc.) match.
app = FastAPI()
app.mount("/api", backend_app)
