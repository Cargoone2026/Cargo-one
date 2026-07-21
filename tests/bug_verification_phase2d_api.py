import json, time, urllib.request, urllib.error, http.cookiejar
BASE='https://cargo-repo-bridge.preview.emergentagent.com'
API=BASE+'/api'
OUT='/app/test_reports/bug_verification_phase2d_api_results.json'

def request(path, method='GET', data=None, cj=None, token=None):
    body=json.dumps(data).encode() if data is not None else None
    headers={'Accept':'application/json'}
    if data is not None: headers['Content-Type']='application/json'
    if token: headers['Authorization']='Bearer '+token
    req=urllib.request.Request(API+path, data=body, headers=headers, method=method)
    opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj)) if cj else urllib.request.build_opener()
    try:
        with opener.open(req, timeout=20) as r:
            txt=r.read().decode()
            return r.status, json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        txt=e.read().decode()
        try: payload=json.loads(txt) if txt else None
        except Exception: payload=txt
        return e.code, payload

res={}
# Disposable registration via POST /api/auth/register, with cookie jar proof.
email=f'e2e2d-delete-{int(time.time())}@example.com'
pw='E2E2dTest12345!'
cj=http.cookiejar.CookieJar()
st,payload=request('/auth/register','POST',{'email':email,'password':pw,'name':'E2E Delete User','phone':'+447700999999','role':'customer'},cj=cj)
res['register']={'status':st,'email':email,'payload_keys':list(payload.keys()) if isinstance(payload,dict) else payload,'cookies':[c.name for c in cj]}
st_me,me=request('/auth/me', cj=cj)
res['me_after_register']={'status':st_me,'email':me.get('email') if isinstance(me,dict) else None}
# API delete endpoint proof independent of UI session.
st_del,del_payload=request('/auth/me/delete','POST',cj=cj)
res['delete_api_direct']={'status':st_del,'payload':del_payload}
st_login_deleted,login_deleted=request('/auth/login','POST',{'email':email,'password':pw},cj=http.cookiejar.CookieJar())
res['login_after_delete']={'status':st_login_deleted,'payload':login_deleted}
# Get driver id and unauth profile API behavior.
st_d,d=request('/auth/login','POST',{'email':'testdriver@example.com','password':'DriverTest12345!'},cj=http.cookiejar.CookieJar())
driver_id=d['user']['id'] if st_d==200 else None
res['driver_login_for_id']={'status':st_d,'driver_id':driver_id}
st_public_unauth,pub_unauth=request(f'/users/{driver_id}/profile')
res['public_profile_unauth_api']={'status':st_public_unauth,'payload':pub_unauth}
# Auth profile endpoint for contrast
cj_driver=http.cookiejar.CookieJar(); request('/auth/login','POST',{'email':'testdriver@example.com','password':'DriverTest12345!'},cj=cj_driver)
st_public_auth,pub_auth=request(f'/users/{driver_id}/profile', cj=cj_driver)
res['public_profile_auth_api']={'status':st_public_auth,'name':pub_auth.get('name') if isinstance(pub_auth,dict) else None}
open(OUT,'w').write(json.dumps(res,indent=2))
print(json.dumps(res,indent=2))
