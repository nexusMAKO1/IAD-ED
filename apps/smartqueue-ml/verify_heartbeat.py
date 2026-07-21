import time
from unittest.mock import patch, MagicMock
from app.core.mqtt_client import mqtt_client
from app.core.config import settings

def test_heartbeat():
    # Patch settings to run faster
    settings.MQTT_HEALTH_INTERVAL_SECONDS = 1.0
    
    with patch.object(mqtt_client, '_publish') as mock_pub:
        # Start client to start daemon
        mqtt_client.start()
        
        print("Waiting for heartbeat daemon...")
        time.sleep(2.5) # Should fire at least twice
        
        mqtt_client.stop()
        
        print("\n--- Heartbeat Calls ---")
        for i, call in enumerate(mock_pub.call_args_list):
            args, kwargs = call
            if args[0] == "system/health":
                print(f"Call {i}: topic={args[0]} retain={kwargs.get('retain', False)}")
                print(f"Payload snippet: {args[1]['status']} / mqtt_connected={args[1]['mqtt_connected']}")

if __name__ == "__main__":
    test_heartbeat()
