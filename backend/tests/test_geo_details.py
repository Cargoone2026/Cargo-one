"""Tests for GET /api/geo/details (Maps Phase 1 B1).

Runs OFFLINE — we monkey-patch httpx.AsyncClient inside the server module
so the tests never actually contact Google. Uses the FastAPI TestClient so
we don't require a live backend or a valid GOOGLE_MAPS_API_KEY.
"""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _FakeAsyncClient:
    """Drop-in async httpx.AsyncClient replacement returning a scripted body."""

    def __init__(self, *, status_code: int = 200, payload: dict | None = None):
        self._status_code = status_code
        self._payload = payload or {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, params=None):
        return _FakeResponse(self._status_code, self._payload)


def _patch_key_and_client(monkeypatch, *, status_code=200, payload=None):
    """Set a fake key in env and patch httpx.AsyncClient inside server module."""
    import server

    # Force a non-placeholder key so the endpoint reaches the httpx call path.
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "TEST_KEY_UNIT_ONLY")
    # httpx is imported *inside* geo_details (local import); patch the top-level
    # httpx module so the local `import httpx` inside the handler picks it up.
    import httpx
    monkeypatch.setattr(
        httpx, "AsyncClient",
        lambda *a, **kw: _FakeAsyncClient(status_code=status_code, payload=payload),
    )
    return server


@pytest.fixture()
def client():
    import server
    return TestClient(server.app)


def test_details_rejects_empty_place_id(client, monkeypatch):
    _patch_key_and_client(monkeypatch, payload={"status": "OK", "result": {}})
    r = client.get("/api/geo/details?place_id=")
    assert r.status_code == 400
    assert r.json()["detail"] == "place_id required"


def test_details_returns_manual_when_key_missing(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "")
    r = client.get("/api/geo/details?place_id=ChIJXYZ")
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "manual"
    assert body["place_id"] == "ChIJXYZ"
    assert body["lat"] == 0
    assert body["lng"] == 0


def test_details_returns_manual_when_key_is_placeholder(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "placeholder-set-me-later")
    r = client.get("/api/geo/details?place_id=ChIJXYZ")
    assert r.status_code == 200
    assert r.json()["source"] == "manual"


def test_details_uk_place_parses_all_fields(client, monkeypatch):
    """Simulated Google response for SW1A 1AA — resolves to lat/lng + postcode."""
    payload = {
        "status": "OK",
        "result": {
            "place_id": "ChIJ1bidZScFdkgRqR6QyLtkTest",
            "formatted_address": "London SW1A 1AA, UK",
            "geometry": {"location": {"lat": 51.5010, "lng": -0.1416}},
            "address_components": [
                {"long_name": "10", "short_name": "10", "types": ["street_number"]},
                {"long_name": "Downing Street", "short_name": "Downing St", "types": ["route"]},
                {"long_name": "London", "short_name": "London", "types": ["postal_town"]},
                {"long_name": "Greater London", "short_name": "Greater London",
                 "types": ["administrative_area_level_2"]},
                {"long_name": "England", "short_name": "England",
                 "types": ["administrative_area_level_1"]},
                {"long_name": "United Kingdom", "short_name": "GB", "types": ["country"]},
                {"long_name": "SW1A 1AA", "short_name": "SW1A 1AA", "types": ["postal_code"]},
            ],
        },
    }
    _patch_key_and_client(monkeypatch, payload=payload)
    r = client.get("/api/geo/details?place_id=ChIJ1bidZScFdkgRqR6QyLtkTest")
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "google"
    assert body["lat"] == 51.5010
    assert body["lng"] == -0.1416
    assert body["postcode"] == "SW1A 1AA"
    assert body["town"] == "London"
    assert body["region"] == "England"
    assert body["country"] == "United Kingdom"
    assert body["country_code"] == "GB"
    assert body["formatted_address"] == "London SW1A 1AA, UK"
    assert body["address_line"] == "10 Downing Street"


def test_details_ireland_eircode(client, monkeypatch):
    payload = {
        "status": "OK",
        "result": {
            "formatted_address": "Saint Kevin's, Dublin, D02 X285, Ireland",
            "geometry": {"location": {"lat": 53.3339, "lng": -6.2617}},
            "address_components": [
                {"long_name": "Dublin", "short_name": "Dublin", "types": ["locality"]},
                {"long_name": "Ireland", "short_name": "IE", "types": ["country"]},
                {"long_name": "D02 X285", "short_name": "D02 X285", "types": ["postal_code"]},
            ],
        },
    }
    _patch_key_and_client(monkeypatch, payload=payload)
    r = client.get("/api/geo/details?place_id=ChIJIrelandTest")
    body = r.json()
    assert body["source"] == "google"
    assert body["country_code"] == "IE"
    assert body["postcode"] == "D02 X285"
    assert body["town"] == "Dublin"
    assert body["lat"] == 53.3339


def test_details_france(client, monkeypatch):
    payload = {
        "status": "OK",
        "result": {
            "formatted_address": "75001 Paris, France",
            "geometry": {"location": {"lat": 48.8630, "lng": 2.3363}},
            "address_components": [
                {"long_name": "Paris", "short_name": "Paris", "types": ["locality"]},
                {"long_name": "France", "short_name": "FR", "types": ["country"]},
                {"long_name": "75001", "short_name": "75001", "types": ["postal_code"]},
            ],
        },
    }
    _patch_key_and_client(monkeypatch, payload=payload)
    r = client.get("/api/geo/details?place_id=ChIJParisTest")
    body = r.json()
    assert body["source"] == "google"
    assert body["country_code"] == "FR"
    assert body["postcode"] == "75001"
    assert body["lat"] == 48.8630


def test_details_google_non_ok_status(client, monkeypatch):
    _patch_key_and_client(monkeypatch, payload={"status": "INVALID_REQUEST"})
    r = client.get("/api/geo/details?place_id=ChIJBrokenPlace")
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "google_error"
    assert body["lat"] == 0 and body["lng"] == 0


def test_details_google_http_5xx(client, monkeypatch):
    _patch_key_and_client(monkeypatch, status_code=500, payload={})
    r = client.get("/api/geo/details?place_id=ChIJHttpFail")
    assert r.status_code == 200
    assert r.json()["source"] == "google_error"


def test_details_missing_geometry_returns_zero_coords_without_crash(client, monkeypatch):
    payload = {
        "status": "OK",
        "result": {
            "formatted_address": "Somewhere",
            "address_components": [
                {"long_name": "United Kingdom", "short_name": "GB", "types": ["country"]}
            ],
        },
    }
    _patch_key_and_client(monkeypatch, payload=payload)
    r = client.get("/api/geo/details?place_id=ChIJNoGeom")
    body = r.json()
    assert body["source"] == "google"
    assert body["lat"] == 0.0
    assert body["lng"] == 0.0
    assert body["country_code"] == "GB"
