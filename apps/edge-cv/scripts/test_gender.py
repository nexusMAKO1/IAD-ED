#!/usr/bin/env python3
"""
Test script for Gender Classification Model
Usage: python3 test_gender.py path/to/image.jpg
"""
import argparse
import sys
import time

import cv2
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.demographics.gender_estimation import GenderEstimator

def main():
    parser = argparse.ArgumentParser(description="Test GenderEstimator on an image.")
    parser.add_argument("image_path", help="Path to the test image")
    parser.add_argument("--model", default="models/gender_googlenet.onnx", help="Path to ONNX model")
    args = parser.parse_args()

    frame = cv2.imread(args.image_path)
    if frame is None:
        print(f"Error: Could not read image {args.image_path}")
        sys.exit(1)
        
    print(f"Loaded image {args.image_path} with shape {frame.shape}")

    estimator = GenderEstimator(model_path=args.model)

    h, w = frame.shape[:2]
    h_box = int(h / 0.35)
    detections = [{"bbox": [0, 0, w, h_box], "confidence": 1.0}]

    t0 = time.time()
    results = estimator.estimate(frame, detections)
    t1 = time.time()

    if not results:
        print("No results returned.")
    else:
        res = results[0]
        print("\n--- Results ---")
        print(f"Gender: {res.get('gender')}")
        print(f"Confidence: {res.get('gender_confidence')}")
        print(f"Inference Time: {(t1 - t0)*1000:.2f} ms")

if __name__ == "__main__":
    main()
