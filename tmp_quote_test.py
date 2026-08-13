import requests, json
s = requests.Session()
r = s.post("http://localhost:8001/api/auth/login", json={"email":"testcustomer@example.com","password":"CustomerTest12345!"})
print("login:", r.status_code, "cookies:", list(s.cookies.keys()))
tok = s.cookies.get("cargoone_session")
h = {"Content-Type":"application/json", "Authorization": f"Bearer {tok}", "X-CSRF-Token": s.cookies.get("cargoone_csrf","")}
for label,payload in [
  ("LWB 25mi", {"pickup_lat":51.507,"pickup_lng":-0.128,"dropoff_lat":51.155,"dropoff_lng":-0.570,"requested_vehicle_key":"lwb_van","service_type":"transport","urgency":"asap"}),
  ("Recovery 25mi", {"pickup_lat":51.507,"pickup_lng":-0.128,"dropoff_lat":51.155,"dropoff_lng":-0.570,"requested_vehicle_key":"recovery_3_5t","service_type":"breakdown_recovery","urgency":"asap"})
]:
  r = s.post("http://localhost:8001/api/asap/quote", json=payload, headers=h)
  print(label, r.status_code, r.text[:500])
