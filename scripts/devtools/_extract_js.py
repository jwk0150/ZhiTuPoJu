# -*- coding: utf-8 -*-
"""提取 index.html 内嵌 <script> 内容（跳过 importmap/json）用于 node 语法检查"""
import re

html = open(r"d:/Learning_test/newtest/ZhiTuPoJu/frontend/index.html", encoding="utf-8").read()

blocks = re.findall(r"<script([^>]*)>(.*?)</script>", html, re.S)
out = []
for i, (attrs, b) in enumerate(blocks):
    if not b.strip():
        continue
    if "type=" in attrs and "javascript" not in attrs:
        continue  # 跳过 importmap / json 等
    out.append(f"// ===== block {i} =====\n" + b)
    out.append("")

open(r"d:/Learning_test/newtest/ZhiTuPoJu/_all_js.js", "w", encoding="utf-8").write("\n".join(out))
print(f"提取 {len(out)//2} 个 JS 块 -> _all_js.js")
