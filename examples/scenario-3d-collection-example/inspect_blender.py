import bpy
import json
import math
import time
from mathutils import Vector
from pathlib import Path

DATA = Path(__file__).resolve().parent
ROOT = DATA / 'assets'
OUT = DATA / 'out' / ('blender-' + time.strftime('%Y%m%d-%H%M%S'))
OUT.mkdir(parents=True,exist_ok=False)
selected = json.loads((DATA / 'selected.json').read_text('utf-8'))
report = []
for sample in selected:
    (OUT / sample['key']).mkdir()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = ROOT / sample['key'] / 'model.glb'
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = list(bpy.context.scene.objects)
    meshes = [o for o in imported if o.type == 'MESH']
    assert meshes, 'GLB imported with no meshes'
    points = [o.matrix_world @ Vector(p) for o in meshes for p in o.bound_box]
    low = Vector([min(p[i] for p in points) for i in range(3)])
    high = Vector([max(p[i] for p in points) for i in range(3)])
    dimensions = high-low
    center = (high+low)/2
    factor = 2.7/max(dimensions)
    pivot = bpy.data.objects.new('Display normalization',None)
    bpy.context.collection.objects.link(pivot)
    for obj in imported:
        if obj.parent is None:
            obj.parent=pivot
    pivot.scale=(factor,)*3
    pivot.location=-center*factor
    texture_images=[image for image in bpy.data.images if image.source=='FILE' or image.packed_file]
    stats={'key':sample['key'],'label':sample['label'],'mesh_objects':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'triangles':sum(sum(max(0,len(p.vertices)-2) for p in o.data.polygons) for o in meshes),'materials':len(bpy.data.materials),'images':len(texture_images),'dimensions_in_imported_coordinates':[round(float(x),6) for x in dimensions],'display_scale':factor,'blender':bpy.app.version_string,'auto_execution_enabled':bpy.context.preferences.filepaths.use_scripts_auto_execute,'has_texture_images':len(texture_images)>0}
    assert not stats['auto_execution_enabled']
    world=bpy.data.worlds.new('Studio world');bpy.context.scene.world=world
    world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(0.7,0.75,0.8,1);world.node_tree.nodes['Background'].inputs[1].default_value=0.45
    for name,position,power,size in [('Key',(3,-4,5),700,5),('Fill',(-4,-2,2),400,4),('Rim',(2,4,4),900,3)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=position;obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
    camera_data=bpy.data.cameras.new('Camera');camera=bpy.data.objects.new('Camera',camera_data);bpy.context.collection.objects.link(camera)
    camera.location=(3.4,-5.5,2.7);camera.rotation_euler=(-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=3.8
    scene=bpy.context.scene;scene.camera=camera;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(OUT/sample['key']/'render.png');bpy.ops.render.render(write_still=True)
    (OUT/sample['key']/'inspection.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    report.append(stats)
    print('INSPECTION',json.dumps(stats,ensure_ascii=False),flush=True)
(OUT/'inspection-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
