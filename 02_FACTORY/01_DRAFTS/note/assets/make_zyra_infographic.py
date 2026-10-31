import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

font_bold = r"C:\Windows\Fonts\meiryob.ttc"
font_reg = r"C:\Windows\Fonts\meiryo.ttc"

W, H = 1200, 675  # 16:9 横長インフォグラフィック

def create_card_base():
    # 上品なダークネイビー〜パープルのグラデーション背景
    base = Image.new("RGBA", (W, H), (18, 20, 30, 255))
    top = Image.new("RGBA", (W, H), (30, 15, 40, 255))
    mask = Image.new("L", (W, H))
    m_draw = ImageDraw.Draw(mask)
    for y in range(H):
        m_draw.line([(0, y), (W, y)], fill=int(255 * (y / H)))
    base.paste(top, (0, 0), mask)

    draw = ImageDraw.Draw(base)
    # ヘッダータイトル
    draw.rounded_rectangle([40, 30, W - 40, 95], radius=16, fill=(35, 25, 55, 240), outline=(130, 60, 200, 200), width=2)
    f_header = ImageFont.truetype(font_bold, 28)
    f_sub_h = ImageFont.truetype(font_bold, 16)
    draw.text((60, 42), "⚔️ ザイラJG オブジェクト攻略の真実（実戦ミクロ図解）", font=f_header, fill=(255, 255, 255, 255))
    draw.text((W - 320, 50), "勝率60.5%を支えた2大シークレット", font=f_sub_h, fill=(210, 180, 255, 255))

    return base

def draw_section_box(base, x0, y0, x1, y1, title, ribbon_color, border_color):
    draw = ImageDraw.Draw(base)
    # ボックス本体
    draw.rounded_rectangle([x0, y0, x1, y1], radius=20, fill=(255, 255, 255, 245), outline=border_color, width=3)
    # リボン
    draw.rounded_rectangle([x0 + 20, y0 + 18, x1 - 20, y0 + 64], radius=10, fill=ribbon_color)
    f_title = ImageFont.truetype(font_bold, 22)
    draw.text((x0 + 35, y0 + 26), title, font=f_title, fill=(255, 255, 255, 255))
    return base

def build_infographic():
    base = create_card_base()

    # 左パネル：ヴォイドグラブ (X: 50〜580)
    base = draw_section_box(base, 50, 120, 580, 630, "👾 ヴォイドグラブ優先の理由", (120, 40, 180, 255), (140, 60, 210, 220))
    # 右パネル：ドラゴン (X: 620〜1150)
    base = draw_section_box(base, 620, 120, 1150, 630, "🐉 ドラゴン戦のタゲ取りミクロ", (210, 40, 50, 255), (230, 60, 70, 220))

    draw = ImageDraw.Draw(base)
    f_b = ImageFont.truetype(font_bold, 18)
    f_r = ImageFont.truetype(font_reg, 15)
    f_step = ImageFont.truetype(font_bold, 16)
    f_warn = ImageFont.truetype(font_bold, 16)

    # -----------------
    # 左側：グラブ解説
    # -----------------
    gx0, gy0 = 70, 200
    draw.rounded_rectangle([gx0, gy0, gx0 + 490, gy0 + 48], radius=8, fill=(245, 235, 255, 255), outline=(180, 130, 240, 180), width=1)
    draw.text((gx0 + 15, gy0 + 12), "🔑 秘密：『小マイト討伐 ➔ Wクール短縮ループ』", font=f_b, fill=(100, 20, 160, 255))

    steps_g = [
        ("Step 1", "グラブが周囲に小さな虫（マイト）を召喚"),
        ("Step 2", "Qや植物の範囲攻撃で小マイトをまとめて撃破"),
        ("Step 3", "ザイラWのパッシブで種のクールダウンが即座に解消！"),
        ("Step 4", "次から次へと植物を無限乱立 ➔ 3体を爆速秒殺！")
    ]
    sy = gy0 + 65
    for st, text in steps_g:
        draw.rounded_rectangle([gx0, sy, gx0 + 80, sy + 30], radius=6, fill=(130, 40, 190, 240))
        draw.text((gx0 + 12, sy + 5), st, font=f_step, fill=(255, 255, 255, 255))
        draw.text((gx0 + 95, sy + 5), text, font=f_r, fill=(40, 30, 50, 255))
        sy += 48

    # グラブ結論
    draw.rounded_rectangle([gx0, sy + 10, gx0 + 490, sy + 65], radius=10, fill=(235, 255, 240, 255), outline=(60, 180, 100, 180), width=2)
    draw.text((gx0 + 15, sy + 22), "💡 結論：味方が寄らなくても一人で安全に完食可能！", font=f_b, fill=(20, 120, 50, 255))

    # -----------------
    # 右側：ドラゴン解説
    # -----------------
    dx0, dy0 = 640, 200
    draw.rounded_rectangle([dx0, dy0, dx0 + 490, dy0 + 48], radius=8, fill=(255, 240, 240, 255), outline=(240, 130, 140, 180), width=1)
    draw.text((dx0 + 15, dy0 + 12), "🔑 掟：『ドラゴンは一人で無茶せず、本体でタゲを引く』", font=f_b, fill=(180, 20, 30, 255))

    # ✕ やってはいけないこと
    draw.rounded_rectangle([dx0, dy0 + 65, dx0 + 490, dy0 + 150], radius=10, fill=(255, 245, 245, 255), outline=(230, 80, 80, 160), width=1)
    draw.text((dx0 + 15, dy0 + 75), "✕ 誤った行動：植物にタゲを吸わせる", font=f_warn, fill=(200, 30, 30, 255))
    draw.text((dx0 + 15, dy0 + 102), "➔ ドラゴンの範囲ブレスで、せっかく咲かせた植物が即消滅", font=f_r, fill=(80, 50, 50, 255))
    draw.text((dx0 + 15, dy0 + 124), "➔ DPSが出ず狩りが遅くなり、敵のカバーに捕まって全滅", font=f_r, fill=(80, 50, 50, 255))

    # ◯ 正しいミクロ
    draw.rounded_rectangle([dx0, dy0 + 165, dx0 + 490, dy0 + 265], radius=10, fill=(240, 255, 245, 255), outline=(50, 180, 90, 180), width=2)
    draw.text((dx0 + 15, dy0 + 175), "◯ 正しいミクロ：ザイラ本体が前に立ってタゲを受ける", font=f_b, fill=(20, 130, 50, 255))
    draw.text((dx0 + 15, dy0 + 205), "➔ 植物をドラゴンの横・背後に咲かせ、本体でブレスを被弾", font=f_r, fill=(30, 60, 40, 255))
    draw.text((dx0 + 15, dy0 + 230), "➔ 被弾ゼロの植物がフリーで最大DPSを叩き込み最速討伐！", font=f_b, fill=(20, 100, 40, 255))

    # ドラゴン結論
    draw.rounded_rectangle([dx0, dy0 + 280, dx0 + 490, dy0 + 335], radius=10, fill=(255, 250, 235, 255), outline=(220, 160, 40, 180), width=1)
    draw.text((dx0 + 15, dy0 + 293), "💡 結論：味方の寄りを確認してから触り、本体で植物を守る！", font=f_b, fill=(160, 90, 0, 255))

    out_p = r"d:\my_work\02_FACTORY\01_DRAFTS\note\assets\zyra_objectives_infographic.png"
    base.convert("RGB").save(out_p, quality=95)
    print("Created infographic:", out_p)

build_infographic()
