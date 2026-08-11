import shutil
import os

src_hero = r"C:\Users\Niloy\.gemini\antigravity-ide\brain\745ba60c-b6b4-4124-b814-5a429df51cc1\telemedicine_hero_1780860621024.png"
dst_hero = r"d:\telehealth-bangladesh\telehealth-bangladesh\frontend-src\src\assets\telemedicine_hero.png"

src_bg = r"C:\Users\Niloy\.gemini\antigravity-ide\brain\745ba60c-b6b4-4124-b814-5a429df51cc1\medicare_sector_bg_1780866818528.png"
dst_bg = r"d:\telehealth-bangladesh\telehealth-bangladesh\frontend-src\src\assets\medicare_sector_bg.png"

# Copy Hero Image
if os.path.exists(src_hero):
    try:
        shutil.copy(src_hero, dst_hero)
        print("SUCCESS: Generated hero image copied to assets!")
    except Exception as e:
        print(f"Error copying hero image: {e}")
else:
    print(f"Source hero file not found at: {src_hero}")

# Copy Background Image
if os.path.exists(src_bg):
    try:
        shutil.copy(src_bg, dst_bg)
        print("SUCCESS: Generated background image copied to assets!")
    except Exception as e:
        print(f"Error copying background image: {e}")
else:
    print(f"Source background file not found at: {src_bg}")
