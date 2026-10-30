import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

font_bold = r"C:\Windows\Fonts\meiryob.ttc"
font_reg = r"C:\Windows\Fonts\meiryo.ttc"

# ==========================================
# 共通カード描画ヘルパー
# ==========================================
def draw_frosted_card(base, card_x0, card_y0, card_x1, card_y1, radius=22, bg_color=(255, 255, 255, 238), border_color=(255, 140, 0, 200)):
    W, H = base.size
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle([card_x0+8, card_y0+10, card_x1+8, card_y1+10], radius=radius, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    base = Image.alpha_composite(base, shadow)

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    o_draw = ImageDraw.Draw(overlay)
    o_draw.rounded_rectangle([card_x0, card_y0, card_x1, card_y1], radius=radius, fill=bg_color, outline=border_color, width=3)
    base = Image.alpha_composite(base, overlay)
    return base

# ----------------------------------------------------
# 1. ザイラJG サムネイル (zyra_jg_thumb.jpg)
# ----------------------------------------------------
def build_zyra():
    src = r"C:\Users\PC_User\.gemini\antigravity\brain\b87c1b24-a2b2-4379-b780-13c1525109ad\zyra_illust_1793372903425.jpg"
    base = Image.open(src).convert("RGBA")
    W, H = base.size # 1376 x 768

    card_x0, card_y0 = int(W * 0.04), int(H * 0.07)
    card_x1, card_y1 = int(W * 0.55), int(H * 0.93)
    base = draw_frosted_card(base, card_x0, card_y0, card_x1, card_y1, radius=24, bg_color=(255, 255, 255, 240), border_color=(130, 30, 180, 200))
    draw = ImageDraw.Draw(base)

    f_ribbon = ImageFont.truetype(font_bold, 19)
    f_title = ImageFont.truetype(font_bold, 36)
    f_num = ImageFont.truetype(font_bold, 21)
    f_item = ImageFont.truetype(font_bold, 20)
    f_sub = ImageFont.truetype(font_reg, 15)
    f_badge = ImageFont.truetype(font_bold, 20)

    # リボン
    draw.rounded_rectangle([card_x0+24, card_y0+20, card_x0+400, card_y0+58], radius=10, fill=(130, 30, 180, 245))
    draw.text((card_x0+38, card_y0+26), "🌿 味方を捨てて一人で勝つ！", font=f_ribbon, fill=(255, 255, 255, 255))

    # タイトル
    draw.text((card_x0+24, card_y0+72), "ザイラJG 低ランク脱出攻略", font=f_title, fill=(25, 20, 35, 255))
    draw.line([(card_x0+24, card_y0+128), (card_x1-24, card_y0+128)], fill=(130, 30, 180, 160), width=2)

    # 3箇条（実戦仕様に刷新）
    items = [
        ("1", "青バフ始動 ＆ 2:55スカトル先行", "インベード相手はウルフ始動 / 敵青バフ襲撃"),
        ("2", "5:00グラブ優先！W解消で秒殺", "小マイト討伐で種クール解消➔植物乱立で消滅"),
        ("3", "ダークシール回収 ＆ 視界外集団戦", "安全第一でスタック育成 ＆ E-W-W-R即死トラップ")
    ]
    curr_y = card_y0 + 144
    for num, title, sub in items:
        draw.ellipse([card_x0+24, curr_y, card_x0+58, curr_y+34], fill=(130, 30, 180, 240))
        draw.text((card_x0+34, curr_y+4), num, font=f_num, fill=(255, 255, 255, 255))
        draw.text((card_x0+70, curr_y+4), title, font=f_item, fill=(30, 25, 40, 255))
        draw.text((card_x0+70, curr_y+34), sub, font=f_sub, fill=(90, 85, 100, 255))
        curr_y += 74

    # 最新パッチバフタグピル
    draw.rounded_rectangle([card_x0+24, card_y1-60, card_x0+320, card_y1-22], radius=8, fill=(245, 235, 255, 255), outline=(160, 100, 220, 200), width=1)
    draw.text((card_x0+36, card_y1-53), "⚡ 直近パッチW強化 ✕ 覇道・栄華", font=ImageFont.truetype(font_bold, 15), fill=(100, 30, 150, 255))

    # 右下バッジ「129戦 勝率60.5%」
    bw, bh = 260, 68
    bx0, by0 = W - bw - 24, H - bh - 24
    draw.rounded_rectangle([bx0, by0, bx0+bw, by0+bh], radius=16, fill=(255, 215, 0, 245), outline=(255, 140, 0, 255), width=3)
    draw.text((bx0+24, by0+10), "🏆 129戦 勝率60.5%", font=f_badge, fill=(40, 30, 0, 255))
    draw.text((bx0+36, by0+38), "ブロンズ ➔ プラチナ昇格！", font=ImageFont.truetype(font_bold, 15), fill=(160, 60, 0, 255))

    out_p = r"d:\my_work\02_FACTORY\01_DRAFTS\note\assets\zyra_jg_thumb.jpg"
    base.convert("RGB").save(out_p, quality=95)
    print("Built Zyra thumb:", out_p)

# ----------------------------------------------------
# 2. ウーコンJG サムネイル (wukong_jg_thumb.jpg)
# ----------------------------------------------------
def build_wukong():
    src = r"C:\Users\PC_User\.gemini\antigravity\brain\b87c1b24-a2b2-4379-b780-13c1525109ad\wukong_illust_1793372925757.jpg"
    base = Image.open(src).convert("RGBA")
    W, H = base.size

    card_x0, card_y0 = int(W * 0.04), int(H * 0.07)
    card_x1, card_y1 = int(W * 0.55), int(H * 0.93)
    base = draw_frosted_card(base, card_x0, card_y0, card_x1, card_y1, radius=24, bg_color=(255, 255, 255, 240), border_color=(230, 85, 0, 200))
    draw = ImageDraw.Draw(base)

    f_ribbon = ImageFont.truetype(font_bold, 19)
    f_title = ImageFont.truetype(font_bold, 36)
    f_num = ImageFont.truetype(font_bold, 21)
    f_item = ImageFont.truetype(font_bold, 20)
    f_sub = ImageFont.truetype(font_reg, 15)
    f_badge = ImageFont.truetype(font_bold, 20)

    draw.rounded_rectangle([card_x0+24, card_y0+20, card_x0+420, card_y0+58], radius=10, fill=(230, 85, 0, 245))
    draw.text((card_x0+38, card_y0+26), "🐒 味方がAP過多なら猿を出せ！", font=f_ribbon, fill=(255, 255, 255, 255))

    draw.text((card_x0+24, card_y0+72), "ウーコンJG 集団戦破壊論", font=f_title, fill=(35, 25, 20, 255))
    draw.line([(card_x0+24, card_y0+128), (card_x1-24, card_y0+128)], fill=(230, 85, 0, 160), width=2)

    items = [
        ("1", "Wデコイで敵スキルを空振りさせる", "ステルス接近から安全に敵キャリーの真横へ滑り込む"),
        ("2", "Rの「2回ノックアップ」という暴力", "1回目で跳ね上げ、Qを挟んで2回目で全員を完全機能停止"),
        ("3", "征服者 ✕ トリニティフォースAD型", "硬気功パッシブとサンダードスカイで殴り負けゼロ")
    ]
    curr_y = card_y0 + 144
    for num, title, sub in items:
        draw.ellipse([card_x0+24, curr_y, card_x0+58, curr_y+34], fill=(230, 85, 0, 240))
        draw.text((card_x0+34, curr_y+4), num, font=f_num, fill=(255, 255, 255, 255))
        draw.text((card_x0+70, curr_y+4), title, font=f_item, fill=(40, 30, 25, 255))
        draw.text((card_x0+70, curr_y+34), sub, font=f_sub, fill=(100, 90, 85, 255))
        curr_y += 74

    draw.rounded_rectangle([card_x0+24, card_y1-60, card_x0+320, card_y1-22], radius=8, fill=(255, 245, 235, 255), outline=(230, 120, 50, 200), width=1)
    draw.text((card_x0+36, card_y1-53), "⚡ 征服者 ✕ サンダードスカイAD", font=ImageFont.truetype(font_bold, 15), fill=(180, 60, 0, 255))

    bw, bh = 260, 68
    bx0, by0 = W - bw - 24, H - bh - 24
    draw.rounded_rectangle([bx0, by0, bx0+bw, by0+bh], radius=16, fill=(255, 215, 0, 245), outline=(255, 140, 0, 255), width=3)
    draw.text((bx0+24, by0+10), "🏆 34戦 勝率55.9%", font=f_badge, fill=(40, 30, 0, 255))
    draw.text((bx0+36, by0+38), "15分ゴールド差 GD@15 +267！", font=ImageFont.truetype(font_bold, 15), fill=(160, 60, 0, 255))

    out_p = r"d:\my_work\02_FACTORY\01_DRAFTS\note\assets\wukong_jg_thumb.jpg"
    base.convert("RGB").save(out_p, quality=95)
    print("Built Wukong thumb:", out_p)

# ----------------------------------------------------
# 3. シヴァーナJG サムネイル (shyvana_jg_thumb.jpg)
# ----------------------------------------------------
def build_shyvana():
    src = r"C:\Users\PC_User\.gemini\antigravity\brain\b87c1b24-a2b2-4379-b780-13c1525109ad\shyvana_illust_1793372946021.jpg"
    base = Image.open(src).convert("RGBA")
    W, H = base.size

    card_x0, card_y0 = int(W * 0.04), int(H * 0.07)
    card_x1, card_y1 = int(W * 0.55), int(H * 0.93)
    base = draw_frosted_card(base, card_x0, card_y0, card_x1, card_y1, radius=24, bg_color=(255, 255, 255, 240), border_color=(200, 25, 45, 200))
    draw = ImageDraw.Draw(base)

    f_ribbon = ImageFont.truetype(font_bold, 19)
    f_title = ImageFont.truetype(font_bold, 36)
    f_num = ImageFont.truetype(font_bold, 21)
    f_item = ImageFont.truetype(font_bold, 20)
    f_sub = ImageFont.truetype(font_reg, 15)
    f_badge = ImageFont.truetype(font_bold, 20)

    draw.rounded_rectangle([card_x0+24, card_y0+20, card_x0+440, card_y0+58], radius=10, fill=(200, 25, 45, 245))
    draw.text((card_x0+38, card_y0+26), "🐉 味方ガチャ拒絶のファーム王者！", font=f_ribbon, fill=(255, 255, 255, 255))

    draw.text((card_x0+24, card_y0+72), "シヴァーナJG ドラゴン独占論", font=f_title, fill=(35, 20, 25, 255))
    draw.line([(card_x0+24, card_y0+128), (card_x1-24, card_y0+128)], fill=(200, 25, 45, 160), width=2)

    items = [
        ("1", "パッシブ対ドラゴン+20%で秒殺", "5:00ジャストの湧きと同時に一人で安全に独占"),
        ("2", "驚異の周回力「CS毎分7.2」", "無駄なガンクを全カットし、敵JGをレベル差で轢殺"),
        ("3", "征服者 ✕ ADブルーザーの結論", "トリニティフォース＋ショウジンで近接殴り合いを圧倒")
    ]
    curr_y = card_y0 + 144
    for num, title, sub in items:
        draw.ellipse([card_x0+24, curr_y, card_x0+58, curr_y+34], fill=(200, 25, 45, 240))
        draw.text((card_x0+34, curr_y+4), num, font=f_num, fill=(255, 255, 255, 255))
        draw.text((card_x0+70, curr_y+4), title, font=f_item, fill=(40, 25, 30, 255))
        draw.text((card_x0+70, curr_y+34), sub, font=f_sub, fill=(100, 85, 90, 255))
        curr_y += 74

    draw.rounded_rectangle([card_x0+24, card_y1-60, card_x0+340, card_y1-22], radius=8, fill=(255, 235, 240, 255), outline=(210, 50, 70, 200), width=1)
    draw.text((card_x0+36, card_y1-53), "⚡ 征服者 ✕ トリニティ・ショウジンAD", font=ImageFont.truetype(font_bold, 15), fill=(170, 20, 40, 255))

    bw, bh = 260, 68
    bx0, by0 = W - bw - 24, H - bh - 24
    draw.rounded_rectangle([bx0, by0, bx0+bw, by0+bh], radius=16, fill=(255, 215, 0, 245), outline=(255, 140, 0, 255), width=3)
    draw.text((bx0+24, by0+10), "🏆 37戦 CS毎分7.2", font=f_badge, fill=(40, 30, 0, 255))
    draw.text((bx0+36, by0+38), "GD@15 +160・全ドラゴン独占！", font=ImageFont.truetype(font_bold, 15), fill=(160, 60, 0, 255))

    out_p = r"d:\my_work\02_FACTORY\01_DRAFTS\note\assets\shyvana_jg_thumb.jpg"
    base.convert("RGB").save(out_p, quality=95)
    print("Built Shyvana thumb:", out_p)

build_zyra()
build_wukong()
build_shyvana()
