"""Build the derived office furniture pack (offline, Python standard library only).

    python3 tools/build-furniture-pack.py

Reads the Kenney Furniture Kit (CC0) GLB files listed in tools/furniture-pack.json
and writes ONE GLB plus a manifest:

- one binary buffer, one scene; each source model becomes a top-level node
  named after its file stem (its original node hierarchy preserved below it);
- materials de-duplicated by (name, colour, flags): ~12 shared materials
  instead of one copy per file;
- the KHR_materials_unlit extension is removed so the furniture can be lit and
  shadowed (colours are kept);
- the manifest records, per model: source SHA-256, axis-aligned bounds after
  node transforms, primitive count; plus pack-level totals.

The original Kenney files are only read, never modified.
"""
import hashlib
import json
import math
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "tools", "furniture-pack.json")


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2:
        raise ValueError("not a GLB v2: %s" % path)
    jlen, jtype = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + jlen].decode("utf-8"))
    off = 20 + jlen
    binary = b""
    if off < len(data):
        blen, btype = struct.unpack_from("<II", data, off)
        binary = data[off + 8: off + 8 + blen]
    return gltf, binary, hashlib.sha256(data).hexdigest()


# ---- small matrix helpers (column-major 4x4 like glTF) -------------------

def mat_identity():
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def mat_mul(a, b):
    out = [0.0] * 16
    for c in range(4):
        for r in range(4):
            out[c * 4 + r] = sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
    return out


def trs_matrix(node):
    if "matrix" in node:
        return list(node["matrix"])
    tx, ty, tz = node.get("translation", [0, 0, 0])
    qx, qy, qz, qw = node.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = node.get("scale", [1, 1, 1])
    xx, yy, zz = qx * qx, qy * qy, qz * qz
    xy, xz, yz = qx * qy, qx * qz, qy * qz
    wx, wy, wz = qw * qx, qw * qy, qw * qz
    return [(1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
            2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
            2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
            tx, ty, tz, 1]


def transform_point(m, p):
    x, y, z = p
    return (m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14])


def model_bounds(gltf, scene_nodes):
    """AABB of all mesh POSITION accessor boxes after node transforms."""
    lo, hi = [math.inf] * 3, [-math.inf] * 3
    prims = 0

    def visit(idx, parent):
        nonlocal prims
        node = gltf["nodes"][idx]
        m = mat_mul(parent, trs_matrix(node))
        if "mesh" in node:
            for prim in gltf["meshes"][node["mesh"]]["primitives"]:
                prims += 1
                acc = gltf["accessors"][prim["attributes"]["POSITION"]]
                amin, amax = acc["min"], acc["max"]
                for cx in (amin[0], amax[0]):
                    for cy in (amin[1], amax[1]):
                        for cz in (amin[2], amax[2]):
                            p = transform_point(m, (cx, cy, cz))
                            for i in range(3):
                                lo[i] = min(lo[i], p[i])
                                hi[i] = max(hi[i], p[i])
        for c in node.get("children", []):
            visit(c, m)

    for n in scene_nodes:
        visit(n, mat_identity())
    return [round(v, 5) for v in lo], [round(v, 5) for v in hi], prims


def build(config_path=CONFIG):
    cfg = json.load(open(config_path))
    src_dir = os.path.join(ROOT, cfg["source_dir"])
    out = {"asset": {"version": "2.0", "generator": "URM build-furniture-pack.py (from Kenney Furniture Kit, CC0)"},
           "scene": 0, "scenes": [{"name": "office-furniture", "nodes": []}], "nodes": [], "meshes": [],
           "materials": [], "accessors": [], "bufferViews": [], "buffers": []}
    blob = bytearray()
    mat_index = {}
    manifest = {"source_pack": "Kenney Furniture Kit 2.0 (CC0 1.0)", "licence": "CC0 1.0 — see public/vendor/kenney-furniture-kit/License.txt",
                "unit": "native Kenney units (pre-scale)", "models": {}}
    for name in cfg["models"]:
        path = os.path.join(src_dir, name + ".glb")
        g, binary, sha = read_glb(path)
        if g.get("images") or g.get("textures") or g.get("skins") or g.get("animations"):
            raise ValueError("unsupported content (textures/skins/animations) in %s" % name)
        # buffer views -> append binary with 4-byte alignment
        bv_map = {}
        for i, bv in enumerate(g["bufferViews"]):
            while len(blob) % 4:
                blob.append(0)
            start = bv.get("byteOffset", 0)
            chunk = binary[start:start + bv["byteLength"]]
            nbv = {"buffer": 0, "byteOffset": len(blob), "byteLength": bv["byteLength"]}
            for k in ("byteStride", "target"):
                if k in bv:
                    nbv[k] = bv[k]
            blob.extend(chunk)
            bv_map[i] = len(out["bufferViews"])
            out["bufferViews"].append(nbv)
        acc_map = {}
        for i, a in enumerate(g["accessors"]):
            na = dict(a)
            na["bufferView"] = bv_map[a["bufferView"]]
            acc_map[i] = len(out["accessors"])
            out["accessors"].append(na)
        m_map = {}
        for i, m in enumerate(g.get("materials", [])):
            nm = {k: v for k, v in m.items() if k != "extensions"}
            key = json.dumps(nm, sort_keys=True)
            if key not in mat_index:
                mat_index[key] = len(out["materials"])
                out["materials"].append(nm)
            m_map[i] = mat_index[key]
        mesh_map = {}
        for i, mesh in enumerate(g["meshes"]):
            prims = []
            for p in mesh["primitives"]:
                np_ = {"attributes": {k: acc_map[v] for k, v in p["attributes"].items()}, "mode": p.get("mode", 4)}
                if "indices" in p:
                    np_["indices"] = acc_map[p["indices"]]
                if "material" in p:
                    np_["material"] = m_map[p["material"]]
                prims.append(np_)
            mesh_map[i] = len(out["meshes"])
            out["meshes"].append({"name": "%s/%s" % (name, mesh.get("name", i)), "primitives": prims})
        node_map = {}
        base = len(out["nodes"])
        for i in range(len(g["nodes"])):
            node_map[i] = base + i
        for i, n in enumerate(g["nodes"]):
            nn = {k: v for k, v in n.items() if k not in ("mesh", "children", "extensions", "extras")}
            if "mesh" in n:
                nn["mesh"] = mesh_map[n["mesh"]]
            if n.get("children"):
                nn["children"] = [node_map[c] for c in n["children"]]
            out["nodes"].append(nn)
        roots = [node_map[n] for n in g["scenes"][g.get("scene", 0)]["nodes"]]
        wrapper = len(out["nodes"])
        out["nodes"].append({"name": name, "children": roots})
        out["scenes"][0]["nodes"].append(wrapper)
        lo, hi, prims = model_bounds(g, g["scenes"][g.get("scene", 0)]["nodes"])
        manifest["models"][name] = {"source_file": os.path.relpath(path, ROOT), "source_sha256": sha,
                                    "min": lo, "max": hi, "primitives": prims}
    while len(blob) % 4:
        blob.append(0)
    out["buffers"].append({"byteLength": len(blob)})
    jbytes = json.dumps(out, separators=(",", ":")).encode("utf-8")
    while len(jbytes) % 4:
        jbytes += b" "
    total = 12 + 8 + len(jbytes) + 8 + len(blob)
    glb = struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(jbytes), 0x4E4F534A) + jbytes \
        + struct.pack("<II", len(blob), 0x004E4942) + bytes(blob)
    out_path = os.path.join(ROOT, cfg["output"])
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as fh:
        fh.write(glb)
    manifest.update({
        "output_file": cfg["output"], "output_sha256": hashlib.sha256(glb).hexdigest(), "output_bytes": len(glb),
        "model_count": len(cfg["models"]), "material_count": len(out["materials"]),
        "material_names": sorted({m.get("name", "") for m in out["materials"]}),
        "primitive_count": sum(m["primitives"] for m in manifest["models"].values()),
        "source_bytes_total": sum(os.path.getsize(os.path.join(src_dir, n + ".glb")) for n in cfg["models"]),
    })
    with open(os.path.join(ROOT, cfg["manifest"]), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, sort_keys=True)
    return manifest


if __name__ == "__main__":
    m = build()
    print("models %d · materials %d (%s) · primitives %d · %d bytes (sources %d bytes)"
          % (m["model_count"], m["material_count"], ", ".join(m["material_names"]), m["primitive_count"],
             m["output_bytes"], m["source_bytes_total"]))
    print("output sha256", m["output_sha256"])
    sys.exit(0)
