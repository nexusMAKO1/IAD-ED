"""
Domain-level exceptions. Zero dependency on fastapi — this keeps predictor.py
callable from any context (HTTP router today; a future MQTT callback in T-015;
tests; batch scripts), not just from inside a request.
"""

class PredictionServiceError(Exception):
    def __init__(self, message: str, error_code: str = "QUEUE_001"):
        self.message = message
        self.error_code = error_code
        super().__init__(message)
