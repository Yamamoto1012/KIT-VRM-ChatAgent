#!/usr/bin/env python3
"""
FastAPIのルート一覧を表示するスクリプト
"""
import sys
sys.path.insert(0, '/app')

from app import app

print("=" * 80)
print("FastAPI Routes:")
print("=" * 80)

for route in app.routes:
    if hasattr(route, 'path'):
        methods = getattr(route, 'methods', ['WebSocket'])
        print(f"{', '.join(methods):12} {route.path}")

print("=" * 80)
