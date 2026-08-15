# -*- coding: utf-8 -*-
"""查看扩充日志中的指定城市（避免命令行中文编码问题）"""
import io
import sys

kws = ["南昌", "九江", "赣州", "宜春", "上饶", "景德镇", "新余", "鹰潭",
       "眉山", "海宁", "太仓", "滁州", "六安", "资阳", "遂宁", "广安"]

lines = io.open("_expand_log.txt", encoding="utf-16").read().splitlines()
for l in lines:
    if any(k in l for k in kws):
        print(l)
