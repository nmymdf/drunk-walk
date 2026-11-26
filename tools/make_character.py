"""產生醉漢人物（MakeHuman / MPFB），算預覽圖。
用法：python make_character.py -- <素材目錄> <輸出目錄>
"""
import bpy, addon_utils, importlib, math, sys, os, glob, json
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
ASSETS, OUT = args[0], args[1]
os.makedirs(OUT, exist_ok=True)
CFG = json.load(open(os.path.join(os.path.dirname(__file__), "character.json"), encoding="utf-8"))

addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
M = "bl_ext.user_default.mpfb.services."
HS = importlib.import_module(M + "humanservice").HumanService

log = open(os.path.join(OUT, "make_log.txt"), "w", encoding="utf-8")
def L(*a):
    print(*a); print(*a, file=log); log.flush()

def find(pattern_list, ext):
    """依序用關鍵字找素材檔，回傳第一個符合的。"""
    files = sorted(glob.glob(os.path.join(ASSETS, "**", "*" + ext), recursive=True))
    for pat in pattern_list:
        words = pat.lower().split()
        for f in files:
            name = f.lower()
            if all((w[1:] not in name) if w.startswith("!") else (w in name) for w in words):
                return f
    return None

# 素材清單寫進 log，方便挑選
for ext in (".mhclo", ".mhmat"):
    for f in sorted(glob.glob(os.path.join(ASSETS, "**", "*" + ext), recursive=True)):
        L("ASSET", os.path.relpath(f, ASSETS))

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)

h = HS.create_human(macro_detail_dict=CFG["macro"])
rig = HS.add_builtin_rig(h, "default")

skin = find(CFG["skin"], ".mhmat")
L("SKIN", skin)
try:
    HS.set_character_skin(skin, h, skin_type="ENHANCED_SSS")
except Exception as e:
    L("skin fail", e)

for kind, key in (("Eyes", "eyes"), ("Eyebrows", "eyebrows"), ("Eyelashes", "eyelashes"),
                  ("Hair", "hair"), ("Clothes", "suit"), ("Clothes", "shoes")):
    f = find(CFG[key], ".mhclo")
    L("PICK", key, f)
    if not f:
        continue
    try:
        mt = "PROCEDURAL_EYES" if kind == "Eyes" else "MAKESKIN"
        HS.add_mhclo_asset(f, h, asset_type=kind, subdiv_levels=0, material_type=mt)
    except Exception as e:
        L("asset fail", key, e)

# 眼睛換成指定顏色、頭髮調暗
def objs_with(word):
    return [o for o in bpy.data.objects if o.type == 'MESH' and word in o.name.lower()]
# 眼睛：程序材質，改成深棕色、眼白微紅（喝醉）
for o in [o for o in bpy.data.objects if o.type == 'MESH' and ("high-poly" in o.name or "low-poly" in o.name)]:
    for m in o.data.materials:
        for n in m.node_tree.nodes:
            if n.type == 'GROUP':
                for k, v in (("IrisMajorColor", (0.10, 0.05, 0.025, 1)), ("IrisMinorColor", (0.04, 0.02, 0.01, 1)),
                             ("IrisSection4Color", (0.015, 0.008, 0.004, 1)), ("EyeWhiteColor", (1.0, 0.86, 0.83, 1))):
                    if k in n.inputs: n.inputs[k].default_value = v
                L("eye color set", o.name)
def darken(o, value):
    for m in o.data.materials:
        if not m or not m.node_tree: continue
        nt = m.node_tree
        for n in list(nt.nodes):
            if n.type == 'BSDF_PRINCIPLED':
                inp = n.inputs["Base Color"]
                if inp.links:
                    src = inp.links[0].from_socket
                    hsv = nt.nodes.new("ShaderNodeHueSaturation")
                    hsv.inputs["Saturation"].default_value = 0.55
                    hsv.inputs["Value"].default_value = value
                    nt.links.new(src, hsv.inputs["Color"]); nt.links.new(hsv.outputs["Color"], inp)
                else:
                    c = inp.default_value; inp.default_value = (c[0]*value, c[1]*value, c[2]*value, 1)
for o in bpy.data.objects:
    if o.type == 'MESH' and any(k in o.name.lower() for k in ("short", "hair")):
        L("darken hair", o.name); darken(o, CFG.get("hair_darken", 0.35))

# 縮圖（挑素材用）
import shutil
os.makedirs(os.path.join(OUT, "thumbs"), exist_ok=True)
for pat in ("clothes/shoes0*/*.thumb", "hair/short0*/*.thumb", "hair/cortu_short_messy_hair/*.thumb", "hair/culturalibre_hair_0*/*.thumb"):
    for f in glob.glob(os.path.join(ASSETS, pat)):
        shutil.copy(f, os.path.join(OUT, "thumbs", os.path.basename(f).replace(".thumb", ".png")))
L("OBJECTS", [o.name for o in bpy.data.objects])

# 姿勢：手放下、站姿；--drunk 時加上醉態
pb = rig.pose.bones
def rot(n, x=0, y=0, z=0):
    if n in pb:
        b = pb[n]; b.rotation_mode = 'XYZ'
        b.rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
for n, v in CFG["pose"].items():
    rot(n, *v)
bpy.context.view_layer.update()

# ---------- 場景 ----------
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = CFG.get("samples", 64)
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1000, 1400
try:
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass
sc.view_settings.exposure = CFG.get("exposure", -0.3)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.06, 0.09, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.5
bpy.ops.mesh.primitive_plane_add(size=30)
fl = bpy.context.active_object
fm = bpy.data.materials.new("floor"); fm.use_nodes = True
fm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.08, 0.08, 0.09, 1)
fm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.6
fl.data.materials.append(fm)

def light(loc, energy, size, color=(1, 1, 1), target=(0, 0, 1.0)):
    ld = bpy.data.lights.new("l", 'AREA'); ld.energy = energy; ld.size = size; ld.color = color
    lo = bpy.data.objects.new("l", ld); sc.collection.objects.link(lo); lo.location = loc
    d = Vector(target) - Vector(loc)
    lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
light((2.0, -2.6, 2.8), 420, 1.6, (1.0, 0.86, 0.68))      # 路燈暖光（主光）
light((-2.6, -1.2, 1.6), 120, 2.5, (0.55, 0.65, 1.0))     # 夜色冷光（補光）
light((0.5, 2.8, 2.4), 350, 1.2, (0.8, 0.85, 1.0))        # 背後輪廓光

cd = bpy.data.cameras.new("c")
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
hz = max((h.matrix_world @ v.co).z for v in h.data.vertices)
L("HEIGHT", hz)

def shot(name, ang, dist, tz, lens):
    cd.lens = lens
    a = math.radians(ang)
    cam.location = (math.sin(a) * dist, -math.cos(a) * dist, tz + 0.05)
    d = Vector((0, 0, tz)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    L("SHOT", name)

for s in CFG["shots"]:
    if s.get("drunk"):
        for n, v in CFG["drunk_pose"].items():
            rot(n, *v)
        bpy.context.view_layer.update()
        shot(s["name"], s["angle"], 5.2, hz * 0.5, 60)
    elif s.get("face"):
        shot(s["name"], s["angle"], 1.25, hz - 0.12, 85)
    else:
        shot(s["name"], s["angle"], 5.2, hz * 0.5, 60)

for v in CFG.get("face_variants", []):
    f = find([v], ".mhmat")
    if not f: continue
    try:
        HS.set_character_skin(f, h, skin_type="ENHANCED_SSS")
        shot("5_臉_" + v, 15, 1.25, hz - 0.12, 85)
    except Exception as e:
        L("variant fail", v, e)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "drunk_man.blend"))
L("DONE")
