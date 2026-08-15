# -*- coding: utf-8 -*-
"""临时验证：技能增强后的生成质量"""
import io
import sys
import random

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

import backend.seed_city_jobs as seed
from backend.services import _infer_capabilities

rng = random.Random(seed.stable_seed("南昌"))
jobs = seed.generate_jobs_for_city("南昌", "江西", set(), 20, rng)
print("总条数:", len(jobs), "唯一:", len(set(j["job_title"] for j in jobs)))
for j in jobs:
    print(f"{j['job_title']:<18} {j['salary_min']:.0f}-{j['salary_max']:.0f}元 {j['education']:<4} {j['experience']:<6} tags={j['industry_tags']:<8} skills={','.join(j['skills'][:5])}")
