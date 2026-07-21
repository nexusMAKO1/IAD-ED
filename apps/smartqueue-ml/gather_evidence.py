import requests
import time
import subprocess
import json

BASE_URL = "http://127.0.0.1:8000"

def gather():
    session = requests.Session()
    print("--- Health Response ---")
    try:
        r = session.get(f"{BASE_URL}/health")
        print(f"Status: {r.status_code}")
        print("Body:")
        print(json.dumps(r.json(), indent=2))
    except Exception as e:
        print(e)
        
    print("\n--- 404 Ack Test ---")
    try:
        r = session.post(
            f"{BASE_URL}/api/v1/alerts/nonexistent-fake-id/ack",
            json={},
            headers={"X-Operator-Id": "audit-test-operator"}
        )
        print(f"Status: {r.status_code}")
        print("Body:")
        print(r.text)
    except Exception as e:
        print(e)

    print("\n--- Triggering Alert for 200 Test ---")
    try:
        for _ in range(10):
            session.get(f"{BASE_URL}/api/v1/queue/predict?service_type=virement&queue_length=1")
        session.get(f"{BASE_URL}/api/v1/queue/predict?service_type=virement&queue_length=100")
        time.sleep(1)
        r = session.get(f"{BASE_URL}/api/v1/queue/anomalies")
        anomalies = r.json()
        if anomalies:
            alert_id = anomalies[0]["alert_id"]
            print(f"\n--- 200 Ack Test (alert_id: {alert_id}) ---")
            r = session.post(
                f"{BASE_URL}/api/v1/alerts/{alert_id}/ack",
                json={},
                headers={"X-Operator-Id": "audit-test-operator"}
            )
            print(f"Status: {r.status_code}")
            print("Body:")
            print(r.text)
        else:
            print("No anomalies found!")
    except Exception as e:
        print(e)

if __name__ == "__main__":
    gather()
