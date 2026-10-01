import shutil
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
assets_dir = os.path.join(base_dir, "frontend-src", "src", "assets")

dst_hero = os.path.join(assets_dir, "telemedicine_hero.png")
dst_bg = os.path.join(assets_dir, "medicare_sector_bg.png")

src_hero = os.environ.get("SRC_HERO_IMAGE", "")
src_bg = os.environ.get("SRC_BG_IMAGE", "")

# Verify or copy Hero Image
if os.path.exists(dst_hero):
    print(f"[OK] Hero image already exists at: {dst_hero}")
elif src_hero and os.path.exists(src_hero):
    try:
        shutil.copy(src_hero, dst_hero)
        print("SUCCESS: Hero image copied to assets!")
    except Exception as e:
        print(f"Error copying hero image: {e}")
else:
    print(f"[INFO] Hero image target path: {dst_hero}")

# Verify or copy Background Image
if os.path.exists(dst_bg):
    print(f"[OK] Background image already exists at: {dst_bg}")
elif src_bg and os.path.exists(src_bg):
    try:
        shutil.copy(src_bg, dst_bg)
        print("SUCCESS: Background image copied to assets!")
    except Exception as e:
        print(f"Error copying background image: {e}")
else:
    print(f"[INFO] Background image target path: {dst_bg}")
