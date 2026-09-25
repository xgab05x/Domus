"""Suonerie MP3 personalizzate su Emergent Object Storage."""
import os
import uuid
from typing import Any, Dict, Tuple

import requests

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "domus"
MIME = {"mp3": "audio/mpeg", "wav": "audio/wav", "ogg": "audio/ogg", "m4a": "audio/mp4", "aac": "audio/aac"}

storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    key = os.environ.get("EMERGENT_LLM_KEY") or EMERGENT_KEY
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY non configurata")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": key}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> Dict[str, Any]:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> Tuple[bytes, str]:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "audio/mpeg")


def upload_sound(filename: str, data: bytes) -> Dict[str, Any]:
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "mp3").lower()
    if ext not in MIME:
        raise ValueError("Formato non supportato: usa MP3, WAV, OGG, M4A o AAC")
    sid = str(uuid.uuid4())
    res = put_object(f"{APP_NAME}/sounds/{sid}.{ext}", data, MIME[ext])
    name = filename.rsplit(".", 1)[0][:40] or "Suoneria"
    return {"id": sid, "name": name, "path": res["path"], "content_type": MIME[ext], "size": res.get("size", len(data))}
