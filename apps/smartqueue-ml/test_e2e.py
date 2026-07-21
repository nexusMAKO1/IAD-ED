import requests
import time

def run_trace():
    session = requests.Session()
    # 1. Fill window
    for i in range(10):
        session.get("http://127.0.0.1:8000/api/v1/queue/predict?service_type=virement&queue_length=1")
        
    # 2. Trigger anomaly
    print("Triggering outlier...")
    session.get("http://127.0.0.1:8000/api/v1/queue/predict?service_type=virement&queue_length=100")
    
    # 3. Get anomalies
    time.sleep(1) # wait for bg task
    res = session.get("http://127.0.0.1:8000/api/v1/queue/anomalies")
    anomalies = res.json()
    print("Anomalies:", anomalies)
    
    if anomalies:
        alert_id = anomalies[0]["alert_id"]
        print(f"Alert ID from anomalies API: {alert_id}")
        
        # 4. Ack via path-based endpoint with X-Operator-Id header
        ack_res = session.post(
            f"http://127.0.0.1:8000/api/v1/alerts/{alert_id}/ack",
            json={},
            headers={"X-Operator-Id": "audit-test-operator"}
        )
        print(f"Ack status: {ack_res.status_code}")
        print(f"Ack Response: {ack_res.json()}")
        
        # 5. Confirm 404 for nonexistent alert
        bad_res = session.post(
            "http://127.0.0.1:8000/api/v1/alerts/nonexistent-fake-id/ack",
            json={},
            headers={"X-Operator-Id": "audit-test-operator"}
        )
        print(f"404 test status: {bad_res.status_code}")
        print(f"404 test response: {bad_res.json()}")

if __name__ == "__main__":
    run_trace()
