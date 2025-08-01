# Blender优化脚本
# 在Blender中运行此脚本来优化模型

import bpy
import bmesh
import os

def optimize_model():
    print("🚀 开始优化模型...")
    
    # 清除默认场景
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    
    # 导入GLB模型
    input_path = "/Users/quan/cursor/fellou_hero_try0/LOST_cut2_v5-transformed.glb"
    bpy.ops.import_scene.gltf(filepath=input_path)
    
    # 统计原始数据
    original_vertices = 0
    original_faces = 0
    
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            original_vertices += len(obj.data.vertices)
            original_faces += len(obj.data.polygons)
    
    print(f"📊 原始统计: {original_vertices:,} 顶点, {original_faces:,} 面")
    
    # 优化每个网格
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            print(f"🔄 优化网格: {obj.name}")
            
            # 选择对象
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            
            # 进入编辑模式
            bpy.ops.object.mode_set(mode='EDIT')
            
            # 获取bmesh
            bm = bmesh.from_mesh(obj.data)
            
            # 1. 移除重复顶点
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
            
            # 2. 限制溶解（减少不必要的细节）
            bmesh.ops.dissolve_limit(bm, angle_limit=0.1, verts=bm.verts, edges=bm.edges)
            
            # 3. 简化（减面）- 激进简化到1%
            if len(bm.faces) > 1000:  # 只对复杂网格进行简化
                target_faces = max(100, len(bm.faces) * 0.01)  # 保留1%或最少100个面
                bmesh.ops.unsubdivide(bm, verts=bm.verts, iterations=3)
            
            # 4. 三角化（确保一致性）
            bmesh.ops.triangulate(bm, faces=bm.faces)
            
            # 更新网格
            bm.to_mesh(obj.data)
            bm.free()
            
            # 返回对象模式
            bpy.ops.object.mode_set(mode='OBJECT')
            
            # 重新计算法线
            bpy.ops.object.shade_smooth()
            
            print(f"  ✅ {obj.name} 优化完成")
        
        elif obj.type == 'LIGHT':
            # 移除灯光
            print(f"💡 移除灯光: {obj.name}")
            bpy.data.objects.remove(obj, do_unlink=True)
        
        elif 'Helper' in obj.name or 'helper' in obj.name.lower():
            # 移除辅助对象
            print(f"🔧 移除辅助对象: {obj.name}")
            bpy.data.objects.remove(obj, do_unlink=True)
    
    # 统计优化后数据
    optimized_vertices = 0
    optimized_faces = 0
    
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            optimized_vertices += len(obj.data.vertices)
            optimized_faces += len(obj.data.polygons)
    
    print(f"📊 优化后统计: {optimized_vertices:,} 顶点, {optimized_faces:,} 面")
    
    # 计算减少比例
    vertex_reduction = (original_vertices - optimized_vertices) / original_vertices * 100
    face_reduction = (original_faces - optimized_faces) / original_faces * 100
    
    print(f"📉 减少比例: 顶点 {vertex_reduction:.1f}%, 面 {face_reduction:.1f}%")
    
    # 导出优化后的模型
    output_path = "/Users/quan/cursor/fellou_hero_try0/v5-optimized-blender.glb"
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_animations=True,
        export_lights=False,  # 不导出灯光
        export_cameras=False, # 不导出相机
        export_extras=False,  # 不导出额外数据
        export_draco_mesh_compression_enable=True,  # 启用DRACO压缩
        export_draco_mesh_compression_level=6  # 高压缩级别
    )
    
    print(f"✅ 优化完成！文件保存为: {output_path}")
    
    if optimized_vertices <= 120000:
        print("🎉 优化成功！顶点数量符合要求")
    else:
        print("⚠️  仍需进一步优化")

# 运行优化
optimize_model()