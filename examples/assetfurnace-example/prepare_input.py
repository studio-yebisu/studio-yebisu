"""Pack the unchanged Poly Haven glTF (with its external .bin and textures) into one GLB.

Input preparation only, separate from AssetFurnace. Runs inside Blender:

    blender --background --factory-startup --threads 4 --python-exit-code 1 \
        --python prepare_input.py -- SOURCE.gltf PACKED.glb PREPARATION.json

Starts from an empty factory scene, imports the glTF, checks that the expected meshes and
triangles arrived, and exports every imported mesh node to GLB with Blender's own glTF
exporter. Nothing is joined, decimated, remeshed, retextured, applied or rendered. Any
failure raises, so `--python-exit-code 1` makes Blender exit non-zero and no record is
written.
"""

import hashlib
import json
import os
import sys

import bpy
from mathutils import Vector

EXPECTED_MESH_OBJECTS = 3
EXPECTED_TRIANGLES = 6576

# Pinned explicitly so a changed Blender default cannot alter the geometry on import.
IMPORT_OPTIONS = {
    "merge_vertices": False,
    "import_shading": "NORMALS",
}

# Every imported mesh node, one GLB, textures embedded in the formats they arrived in.
EXPORT_OPTIONS = {
    "export_format": "GLB",
    "use_selection": False,
    "export_image_format": "AUTO",
    "export_materials": "EXPORT",
    "export_texcoords": True,
    "export_normals": True,
    "export_tangents": False,
    "export_apply": False,
    "export_yup": True,
    "export_cameras": False,
    "export_lights": False,
    "export_animations": False,
    "export_extras": False,
    "export_draco_mesh_compression_enable": False,
}

NOT_PERFORMED = ["join", "decimate", "remesh", "retopology", "retexture", "bake",
                 "modifier_apply", "render"]


def arguments():
    if "--" not in sys.argv:
        raise RuntimeError("usage: ... --python prepare_input.py -- SOURCE.gltf PACKED.glb "
                           "PREPARATION.json")
    rest = sys.argv[sys.argv.index("--") + 1:]
    if len(rest) != 3:
        raise RuntimeError(f"expected 3 arguments after --, got {len(rest)}")
    source, packed, record = rest
    if not source.lower().endswith(".gltf") or not os.path.isfile(source):
        raise RuntimeError(f"source glTF not found: {public_path(source)}")
    if not packed.lower().endswith(".glb"):
        raise RuntimeError("packed output must end in .glb")
    for path in (packed, record):
        if os.path.exists(path):
            raise RuntimeError(f"output already exists, refusing to overwrite: {public_path(path)}")
        parent = os.path.dirname(os.path.abspath(path))
        if not os.path.isdir(parent):
            raise RuntimeError(f"output folder does not exist: {public_path(path)}")
    return source, packed, record


def public_path(path):
    """Relative paths are recorded as given; an absolute one is reduced to its file name."""
    return os.path.basename(path) if os.path.isabs(path) else path.replace("\\", "/")


def checked_options(operator, wanted):
    """Refuse to run with an option this Blender's operator does not define."""
    known = set(operator.get_rna_type().properties.keys())
    missing = sorted(set(wanted) - known)
    if missing:
        raise RuntimeError(f"{operator.idname_py()} has no option(s) {missing} in "
                           f"Blender {bpy.app.version_string}")
    return dict(wanted)


def triangle_count(mesh):
    if hasattr(mesh, "calc_loop_triangles"):
        mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def corners(obj, world):
    points = [Vector(corner) for corner in obj.bound_box]
    if world:
        points = [obj.matrix_world @ point for point in points]
    return {
        "min": [min(p[axis] for p in points) for axis in range(3)],
        "max": [max(p[axis] for p in points) for axis in range(3)],
    }


def describe(obj):
    mesh = obj.data
    return {
        "object": obj.name,
        "mesh": mesh.name,
        "parent": obj.parent.name if obj.parent else None,
        "vertices": len(mesh.vertices),
        "polygons": len(mesh.polygons),
        "loops": len(mesh.loops),
        "triangles": triangle_count(mesh),
        "uv_layers": [layer.name for layer in mesh.uv_layers],
        "materials": [slot.material.name if slot.material else None
                      for slot in obj.material_slots],
        "location": list(obj.location),
        "rotation_mode": obj.rotation_mode,
        "rotation_quaternion": list(obj.rotation_quaternion),
        "rotation_euler": list(obj.rotation_euler),
        "scale": list(obj.scale),
        "matrix_world": [list(row) for row in obj.matrix_world],
        "bounds_local": corners(obj, world=False),
        "bounds_world": corners(obj, world=True),
    }


def gltf_addon_version():
    module = sys.modules.get("io_scene_gltf2")
    version = getattr(module, "bl_info", {}).get("version") if module else None
    return list(version) if version else None


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def main():
    source, packed, record = arguments()

    bpy.ops.wm.read_factory_settings(use_empty=True)
    if bpy.data.objects or bpy.data.meshes or bpy.data.images:
        raise RuntimeError("factory scene is not empty")

    import_options = checked_options(bpy.ops.import_scene.gltf, IMPORT_OPTIONS)
    result = bpy.ops.import_scene.gltf(filepath=os.path.abspath(source), **import_options)
    if result != {"FINISHED"}:
        raise RuntimeError(f"glTF import returned {sorted(result)}")

    scene = bpy.context.scene
    mesh_objects = sorted((o for o in scene.objects if o.type == "MESH"), key=lambda o: o.name)
    meshes = [describe(obj) for obj in mesh_objects]
    triangles = sum(item["triangles"] for item in meshes)
    if len(meshes) != EXPECTED_MESH_OBJECTS or triangles != EXPECTED_TRIANGLES:
        raise RuntimeError(f"imported {len(meshes)} mesh objects / {triangles} triangles; "
                           f"expected {EXPECTED_MESH_OBJECTS} / {EXPECTED_TRIANGLES}")

    imported = {
        "objects_by_type": {kind: sum(1 for o in scene.objects if o.type == kind)
                            for kind in sorted({o.type for o in scene.objects})},
        "mesh_objects": len(meshes),
        "triangles": triangles,
        "materials": sorted(m.name for m in bpy.data.materials),
        "images": [{"name": image.name,
                    "file": os.path.basename(image.filepath_raw) or None,
                    "packed": image.packed_file is not None,
                    "size": list(image.size)}
                   for image in sorted(bpy.data.images, key=lambda i: i.name)],
        "meshes": meshes,
        "space": "Blender Z-up after the importer's conversion from glTF Y-up",
    }

    export_options = checked_options(bpy.ops.export_scene.gltf, EXPORT_OPTIONS)
    result = bpy.ops.export_scene.gltf(filepath=os.path.abspath(packed), **export_options)
    if result != {"FINISHED"}:
        raise RuntimeError(f"GLB export returned {sorted(result)}")
    if not os.path.isfile(packed):
        raise RuntimeError("exporter reported success but wrote no GLB")
    with open(packed, "rb") as handle:
        if handle.read(4) != b"glTF":
            raise RuntimeError("exported file is not a GLB")

    preparation = {
        "role": "input preparation (Blender), separate from AssetFurnace",
        "script": "prepare_input.py",
        "blender": {
            "version_string": bpy.app.version_string,
            "version": list(bpy.app.version),
            "version_cycle": getattr(bpy.app, "version_cycle", None),
            "build_hash": bpy.app.build_hash.decode("ascii", "replace"),
            "build_date": bpy.app.build_date.decode("ascii", "replace"),
            "gltf_addon_version": gltf_addon_version(),
            "background": bpy.app.background,
            "factory_startup": bpy.app.factory_startup,
            "scene_render_threads": scene.render.threads,
        },
        "source": {"gltf": public_path(source)},
        "import_options": import_options,
        "imported": imported,
        "export_options": export_options,
        "packed": {"glb": public_path(packed), "bytes": os.path.getsize(packed),
                   "sha256": sha256(packed)},
        "not_performed": NOT_PERFORMED,
    }
    with open(record, "x", encoding="utf-8", newline="\n") as handle:
        json.dump(preparation, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"packed {len(meshes)} meshes / {triangles} triangles -> {public_path(packed)}")


main()
