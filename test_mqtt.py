import paho.mqtt.client as mqtt
import json
import time
import datetime

def on_connect(client, userdata, flags, rc):
    print("Connected with result code "+str(rc))
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    payload = {
        "timestamp": now_iso,
        "deviceId": "123e4567-e89b-12d3-a456-426614174000",
        "siteId": "123e4567-e89b-12d3-a456-426614174000",
        "deviceType": "EDGE_CAMERA",
        "event": "person_detected",
        "payload": {
            "personCount": 1,
            "inferenceMsec": 100.0,
            "processingMsec": 105.0,
            "detections": [
                {
                    "track_id": 1,
                    "x1": 0.1,
                    "y1": 0.1,
                    "x2": 0.9,
                    "y2": 0.9,
                    "confidence": 0.95,
                    "class_id": 0,
                    "label": "person",
                    "estimated_age": 25,
                    "age_group": "young_adult",
                    "gender": "male"
                }
            ]
        }
    }
    client.publish("smartvision/edge/detections", json.dumps(payload), qos=1)
    
    demo_payload = {
        "timestamp": now_iso,
        "deviceId": "123e4567-e89b-12d3-a456-426614174000",
        "siteId": "123e4567-e89b-12d3-a456-426614174000",
        "deviceType": "EDGE_CAMERA",
        "event": "demographics_update",
        "payload": {
            "personCount": 1,
            "demographics": [
                {
                    "track_id": 1,
                    "x1": 0.1,
                    "y1": 0.1,
                    "x2": 0.9,
                    "y2": 0.9,
                    "confidence": 0.95,
                    "class_id": 0,
                    "label": "person",
                    "estimated_age": 25,
                    "age_group": "young_adult",
                    "gender": "male"
                }
            ]
        }
    }
    client.publish("smartvision/edge/demographics", json.dumps(demo_payload), qos=1)

client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION1)
client.username_pw_set("iad_mqtt_user", "IadSecurePass2026!")
client.on_connect = on_connect
client.connect("localhost", 1883, 60)
client.loop_start()
time.sleep(1)
client.loop_stop()
print("Published.")
