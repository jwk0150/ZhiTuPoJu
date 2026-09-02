"""
把原图（4 列 × 2 行 = 8 张）切成 8 张子图，对应简历生成的 8 个步骤。
每张大小约 1/4 宽 × 1/2 高。
"""
import os
import sys
from PIL import Image

# ---------- 配置 ----------
SRC = r"C:\Users\21857\AppData\Local\Temp\d2613aa4df72a47cfdc0002972bc8d0b.af0b605297.jpg"
DST_DIR = r"c:\Users\21857\Desktop\挑战杯(3)\挑战杯\frontend\images"

COLS = 4
ROWS = 2

# 步骤 -> (行, 列)
STEP_POSITIONS = {
    1: (0, 0),  # 01 基础信息   (左上行)
    2: (0, 1),  # 02 画像与方向
    3: (0, 2),  # 03 经历补充
    4: (0, 3),  # 04 STAR 结构化 (右上行)
    5: (1, 0),  # 05 软件信息   (左下行)
    6: (1, 1),  # 06 证件照
    7: (1, 2),  # 07 精简润色
    8: (1, 3),  # 08 生成你的简历 (右下行)
}

# ---------- 主流程 ----------
def main():
    if not os.path.exists(SRC):
        print("SRC NOT FOUND:", SRC, file=sys.stderr)
        sys.exit(1)

    os.makedirs(DST_DIR, exist_ok=True)

    img = Image.open(SRC)
    w, h = img.size
    print("Source size:", w, "x", h)

    cell_w = w // COLS
    cell_h = h // ROWS
    print("Cell size:", cell_w, "x", cell_h)

    for step, (r, c) in STEP_POSITIONS.items():
        left = c * cell_w
        top = r * cell_h
        right = left + cell_w
        bottom = top + cell_h
        crop = img.crop((left, top, right, bottom))
        out_path = os.path.join(DST_DIR, f"resume-step-{step}.jpg")
        crop.save(out_path, "JPEG", quality=92)
        print("Saved:", out_path, crop.size)

    print("Done. 8 files generated under", DST_DIR)

if __name__ == "__main__":
    main()
