import requests, cv2, numpy as np

# Create a blank image
img = np.zeros((100, 100, 3), dtype=np.uint8)
cv2.imwrite("test_img.jpg", img)

with open("test_img.jpg", "rb") as f:
    res = requests.post("http://localhost:8001/detect", files={"file": f})
print(res.json())
