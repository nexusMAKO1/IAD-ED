import requests
import sys
import os

BASE_URL = "http://127.0.0.1:8000"

def run_check(name: str, check_func, *args) -> bool:
    try:
        check_func(*args)
        print(f"[PASS] {name}")
        return True
    except AssertionError as e:
        print(f"[FAIL] {name} — {e}")
        return False
    except Exception as e:
        print(f"[FAIL] {name} — Unhandled Exception: {type(e).__name__}: {e}")
        return False

# Checks

def check_a_health(session: requests.Session):
    r = session.get(f"{BASE_URL}/health")
    assert r.status_code == 200, f"expected 200, got {r.status_code}"
    data = r.json()
    assert "status" in data, "missing 'status' key"
    assert "services" in data, "missing 'services' key"
    services = data["services"]
    for srv in ["model", "mqtt", "redis"]:
        assert srv in services, f"missing '{srv}' in services"

def check_b_valid_prediction(session: requests.Session, is_fallback_mode: bool):
    r = session.get(f"{BASE_URL}/api/v1/queue/predict?service_type=retrait&priority=standard&queue_length=5&active_agents=2")
    assert r.status_code == 200, f"expected 200, got {r.status_code} ({r.text})"
    data = r.json()
    
    expected_keys = ["predicted_wait_time_seconds", "congestion_level", "confidence_interval_percentage", "factors", "is_fallback", "timestamp"]
    for k in expected_keys:
        assert k in data, f"missing '{k}' key"
        
    wait_time = data["predicted_wait_time_seconds"]
    assert isinstance(wait_time, int), f"expected wait time to be int, got {type(wait_time).__name__}"
    assert 60 <= wait_time <= 2700, f"expected wait time between 60 and 2700, got {wait_time}"
    
    congestion = data["congestion_level"]
    assert congestion in ["low", "moderate", "high", "critical"], f"invalid congestion_level: {congestion}"
    
    is_fallback = data["is_fallback"]
    if is_fallback_mode:
        assert is_fallback is True, "expected is_fallback to be True in fallback mode"
        assert wait_time == 225, f"expected fallback wait_time 225, got {wait_time}"
        assert data["confidence_interval_percentage"] == 60.0, f"expected fallback confidence 60.0, got {data['confidence_interval_percentage']}"
    else:
        assert is_fallback is False, "expected is_fallback to be False in real-model mode"

def check_c_invalid_category(session: requests.Session):
    r = session.get(f"{BASE_URL}/api/v1/queue/predict?service_type=not_a_real_service")
    assert r.status_code == 422, f"expected 422, got {r.status_code} ({r.text})"
    data = r.json()
    error_code = data.get("detail", {}).get("error_code", "")
    assert str(error_code).startswith("QUEUE_"), f"expected error_code starting with QUEUE_, got '{error_code}'"

    r2 = session.get(f"{BASE_URL}/api/v1/queue/predict?service_type=retrait&priority=urgent")
    assert r2.status_code == 422, f"expected 422, got {r2.status_code} ({r2.text})"

def check_d_congestion_tiers(session: requests.Session, is_fallback_mode: bool):
    if is_fallback_mode:
        print("  (Skipping congestion tiers check in fallback mode)")
        return
        
    tiers = {
        3: "low",
        8: "moderate",
        15: "high",
        25: "critical"
    }
    
    for q_len, expected_tier in tiers.items():
        r = session.get(f"{BASE_URL}/api/v1/queue/predict?service_type=retrait&queue_length={q_len}")
        assert r.status_code == 200, f"expected 200 for length {q_len}, got {r.status_code}"
        data = r.json()
        assert data["congestion_level"] == expected_tier, f"expected tier '{expected_tier}' for length {q_len}, got '{data['congestion_level']}'"

def check_e_priority_discount(session: requests.Session, is_fallback_mode: bool):
    if is_fallback_mode:
        print("  (Skipping priority discount check in fallback mode)")
        return
        
    wait_times = {}
    for prio in ["vip", "priority", "standard"]:
        r = session.get(f"{BASE_URL}/api/v1/queue/predict?service_type=retrait&queue_length=15&priority={prio}")
        assert r.status_code == 200, f"expected 200 for priority {prio}, got {r.status_code}"
        wait_times[prio] = r.json()["predicted_wait_time_seconds"]
        
    v, p, s = wait_times["vip"], wait_times["priority"], wait_times["standard"]
    assert v <= p <= s, f"expected wait times ordered vip <= priority <= standard, got vip={v}, priority={p}, standard={s}"

def check_f_batch_valid(session: requests.Session):
    payload = {"items": [{"service_type": "retrait"}, {"service_type": "depot"}, {"service_type": "info"}]}
    r = session.post(f"{BASE_URL}/api/v1/queue/predict/batch", json=payload)
    assert r.status_code == 200, f"expected 200, got {r.status_code} ({r.text})"
    data = r.json()
    assert isinstance(data, list), "expected response to be a list"
    assert len(data) == 3, f"expected list of length 3, got {len(data)}"

def check_g_batch_oversized(session: requests.Session):
    payload = {"items": [{"service_type": "retrait"}] * 51}
    r = session.post(f"{BASE_URL}/api/v1/queue/predict/batch", json=payload)
    assert r.status_code == 422, f"expected 422, got {r.status_code} ({r.text})"

def check_h_queue_status(session: requests.Session):
    r = session.get(f"{BASE_URL}/api/v1/queue/status")
    assert r.status_code == 200, f"expected 200, got {r.status_code} ({r.text})"
    data = r.json()
    
    expected_keys = ["timestamp", "source", "status", "active_queue_length", "longest_wait_seconds", "average_wait_seconds", "queues_by_service_type"]
    for k in expected_keys:
        assert k in data, f"missing '{k}' key"
        
    source = data["source"]
    assert source in ["redis", "fallback"], f"expected source 'redis' or 'fallback', got '{source}'"
    print(f"  (Queue status returned source: '{source}')")

def check_i_anomalies_stub(session: requests.Session):
    r = session.get(f"{BASE_URL}/api/v1/queue/anomalies")
    assert r.status_code == 200, f"expected 200, got {r.status_code} ({r.text})"
    data = r.json()
    assert isinstance(data, list) and len(data) == 0, f"expected empty list [], got {data}"

def check_j_stats(session: requests.Session):
    r = session.get(f"{BASE_URL}/api/v1/queue/stats")
    assert r.status_code == 200, f"expected 200, got {r.status_code} ({r.text})"
    data = r.json()
    
    assert "total_predictions" in data, "missing 'total_predictions'"
    assert data["total_predictions"] >= 1, f"expected total_predictions >= 1, got {data['total_predictions']}"
    
    assert "congestion_distribution" in data, "missing 'congestion_distribution'"
    assert "fallback_predictions" in data, "missing 'fallback_predictions'"

def check_k_static_architecture():
    # Adjust path if script is run from root or from scripts/
    filepath = "apps/smartqueue-ml/app/services/predictor.py"
    if not os.path.exists(filepath):
        filepath = os.path.join("..", filepath)
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read().lower()
        
    banned_words = ["fastapi", "joblib", "sklearn", "estimators_", "named_steps"]
    for word in banned_words:
        assert word not in content, f"found banned substring '{word}' in predictor.py"

def main():
    print(f"Connecting to {BASE_URL}/health to determine mode...")
    
    session = requests.Session()
    try:
        h_res = session.get(f"{BASE_URL}/health", timeout=5)
    except requests.exceptions.RequestException as e:
        print(f"Could not connect to server at {BASE_URL}: {e}")
        sys.exit(1)
        
    if h_res.status_code != 200:
        print(f"Health endpoint returned {h_res.status_code}")
        print("Raw response:", h_res.text)
        sys.exit(1)
        
    health_data = h_res.json()
    print("Raw health response:", health_data)
    
    model_status = health_data.get("services", {}).get("model")
    if model_status == "loaded":
        is_fallback = False
        print("\n=== RUNNING IN REAL-MODEL MODE ===")
    else:
        is_fallback = True
        print("\n=== RUNNING IN FALLBACK MODE ===")

    print("-" * 50)
    
    checks = [
        ("A. Health check", lambda: check_a_health(session)),
        ("B. Valid single prediction", lambda: check_b_valid_prediction(session, is_fallback)),
        ("C. Invalid category -> 422", lambda: check_c_invalid_category(session)),
        ("D. Congestion tiers", lambda: check_d_congestion_tiers(session, is_fallback)),
        ("E. Priority discount ordering", lambda: check_e_priority_discount(session, is_fallback)),
        ("F. Batch endpoint - valid", lambda: check_f_batch_valid(session)),
        ("G. Batch endpoint - oversized", lambda: check_g_batch_oversized(session)),
        ("H. Queue status", lambda: check_h_queue_status(session)),
        ("I. Anomalies stub", lambda: check_i_anomalies_stub(session)),
        ("J. Stats", lambda: check_j_stats(session)),
        ("K. Static architecture check", lambda: check_k_static_architecture())
    ]
    
    passed = 0
    failed = 0
    
    for name, func in checks:
        if run_check(name, func):
            passed += 1
        else:
            failed += 1
            
    print("-" * 50)
    print(f"{passed} passed, {failed} failed")
    
    if failed > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
