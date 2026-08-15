# -*- coding: utf-8 -*-
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.city_profile import get_city_codes

codes = get_city_codes("南昌")
print("codes:", codes)

try:
    from backend.seed_city_jobs import PROVINCE_INDUSTRIES
    print("prov industries 南昌:", PROVINCE_INDUSTRIES.get(codes["province"], "MISSING"))
except Exception as e:
    print("import err:", repr(e))
