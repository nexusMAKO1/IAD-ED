"""Verify that cooldown/budget suppression has been removed from anomaly.py.

Strategy: use three DIFFERENT service_types, each with its own clean window,
so each outlier produces z_score > 3.0 independently.
"""
import asyncio
from app.services.anomaly import anomaly_detector
from app.core.mqtt_client import mqtt_client

async def test_anomalies():
    mqtt_client.start()

    service_types = ["retrait", "depot", "info"]
    alerts = []

    for st in service_types:
        # Fill the window with 10 normal values
        for i in range(10):
            anomaly_detector.check_anomaly(st, 60.0)
        # Trigger one outlier per service_type
        print(f"Triggering anomaly for {st}...")
        alert = anomaly_detector.check_anomaly(st, 100.0)
        print(f"  Alert: {alert}")
        alerts.append(alert)

    # Also test same service_type with massive outlier to prove no cooldown
    print("\nTriggering second anomaly for retrait with huge outlier...")
    alert_huge = anomaly_detector.check_anomaly("retrait", 10000.0)
    print(f"  Alert: {alert_huge}")
    alerts.append(alert_huge)

    recent = anomaly_detector.get_recent_anomalies()
    print(f"\nRecent Anomalies count: {len(recent)}")
    for i, a in enumerate(recent):
        print(f"  [{i}] alert_id={a.alert_id} service_type={a.service_type} severity={a.severity} z_score={a.z_score}")

    # Verify none are None
    non_none = [a for a in alerts if a is not None]
    print(f"\nTotal alerts generated: {len(non_none)} / {len(alerts)} expected")
    assert len(non_none) == len(alerts), f"Expected {len(alerts)} alerts, got {len(non_none)}"
    print("PASS: No suppression — all anomalies generated alerts.")

    mqtt_client.stop()

if __name__ == "__main__":
    asyncio.run(test_anomalies())
