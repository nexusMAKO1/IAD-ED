"""Verify that z-scores drop below threshold on repeated outliers.
This is a math verification, not a test of suppression."""
import math

window = [60.0] * 10

for i in range(3):
    window.append(100.0)
    if len(window) > 100:
        window.pop(0)

    mean = sum(window) / len(window)
    variance = sum((x - mean) ** 2 for x in window) / len(window)
    std_dev = math.sqrt(variance)
    if std_dev == 0:
        std_dev = 1.0
    z_score = (100.0 - mean) / std_dev

    print(f"After insert {i+1}: len={len(window)} mean={mean:.2f} std_dev={std_dev:.2f} z_score={z_score:.4f} exceeds_3.0={z_score >= 3.0}")
