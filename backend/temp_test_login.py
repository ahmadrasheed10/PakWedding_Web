import urllib.request
import urllib.parse
import traceback

url = 'http://127.0.0.1:8001/api/auth/login'
data = urllib.parse.urlencode({'username':'admin@pakwedding.com','password':'admin123'}).encode('utf-8')
req = urllib.request.Request(url, data=data)
try:
    with urllib.request.urlopen(req, timeout=10) as res:
        print(res.status)
        print(res.read().decode('utf-8'))
except Exception as e:
    print('EXC', type(e).__name__, e)
    traceback.print_exc()
