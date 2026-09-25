import asyncio, json, os, httpx, websockets

API = os.environ.get("API", "http://localhost:8001/api")
WS = API.replace("http", "ws") + "/ws"


async def main():
    async with httpx.AsyncClient(timeout=20) as c:
        ents = (await c.get(f"{API}/entities", params={"type": "alarm_zone"})).json()
        zone = next(z for z in ents if not (z.get("state") or {}).get("bypass"))
        print("zona:", zone["name"], zone["id"])
        print("arm:", (await c.post(f"{API}/alarm/set/away", json={})).json())
        async with websockets.connect(WS) as ws:
            await c.post(f"{API}/cameras/{zone['id']}/simulate-motion")
            got = None
            for _ in range(12):
                m = json.loads(await asyncio.wait_for(ws.recv(), timeout=8))
                if m.get("type") == "alarm":
                    got = m
                    break
            print("ALARM WS:", got)
        r = await c.post(f"{API}/alarm/set/disarmed", json={"pin": "0000"})
        print("wrong pin disarm status:", r.status_code, r.text[:120])
        s = (await c.get(f"{API}/settings")).json()
        print("alarm_armed dopo pin errato:", s.get("alarm_armed"))
        r = await c.post(f"{API}/alarm/set/disarmed", json={"pin": "1234"})
        print("right pin disarm:", r.status_code, r.text[:120])
        s = (await c.get(f"{API}/settings")).json()
        print("alarm_armed finale:", s.get("alarm_armed"))
        assert got and got.get("state") == "triggered"


asyncio.run(main())
