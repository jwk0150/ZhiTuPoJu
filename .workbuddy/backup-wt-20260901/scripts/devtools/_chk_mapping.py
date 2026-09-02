# -*- coding: utf-8 -*-
"""检查 CITY_TO_PROVINCE 映射完整性（临时脚本）"""
from backend.mappings import CITY_TO_PROVINCE

need = ["周口", "驻马店", "商丘", "开平", "澄迈", "崇左", "许昌", "漯河", "三门峡",
        "济源", "海宁", "昆山", "太仓", "张家港", "常熟", "滁州", "淮北", "聊城",
        "朝阳", "营口", "眉山", "仙桃", "潜江", "天门", "神农架", "南昌", "九江",
        "赣州", "广州", "深圳", "佛山", "郑州", "洛阳"]
missing = [c for c in need if c not in CITY_TO_PROVINCE]
print("total cities:", len(CITY_TO_PROVINCE))
print("still missing:", missing)
for c in ["周口", "郑州", "洛阳", "南昌", "九江", "赣州", "广州", "深圳", "佛山"]:
    print(c, "->", CITY_TO_PROVINCE.get(c))
