import urllib.request
import re
import json

req = urllib.request.Request('https://motor-dealer-hwa.preview.emergentagent.com/static/js/bundle.js', headers={'User-Agent': 'Mozilla/5.0'})
try:
    content = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
    apis = set(re.findall(r'[\'\"`](/(?:api|admin)/[a-zA-Z0-9_\-/]+)[\'\"`]', content))
    print('Endpoints:', apis)
    
    # Check for routes
    routes = set(re.findall(r'path:\s*[\'\"]([^\'\"]+)[\'\"]', content))
    print('Routes:', routes)
    
    # Check for text in quotes
    headlines = set(re.findall(r'[\'\"]([A-Z][a-zA-Z0-9\s]{5,40}(?:Motor|Honda|Dealer|Promo|Kredit|Terbaik|Resmi|Beli))[\'\"]', content))
    print('Headlines:', headlines)

    # Search for default data or mock data
    names = set(re.findall(r'[\'\"](Beat\s+[A-Za-z0-9]+|Vario\s+[A-Za-z0-9]+|PCX\s+[A-Za-z0-9]+|Scoopy\s+[A-Za-z0-9]+|ADV\s+[A-Za-z0-9]+|CBR\s+[A-Za-z0-9]+|CRF\s+[A-Za-z0-9]+)[\'\"]', content))
    print('Motorcycle Names:', names)
except Exception as e:
    print('Error:', e)
