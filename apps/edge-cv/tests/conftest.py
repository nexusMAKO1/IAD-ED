import os
import pytest
from fastapi.testclient import TestClient

# Set environment variables before importing app
os.environ["MODEL_SKIP_LOAD"] = "true"

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c
