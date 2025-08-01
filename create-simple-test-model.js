// 创建一个简化的测试模型来验证系统兼容性

import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { writeFileSync } from 'fs'

function createSimpleTestModel() {
    console.log('🔧 创建简化测试模型...')
    
    const scene = new THREE.Scene()
    
    // 创建三个环形几何体来模拟你的模型
    const rings = [
        { name: '網格.001', radius: 2, tube: 0.1, segments: 32, color: 0x4488ff },
        { name: '網格.002', radius: 3, tube: 0.15, segments: 32, color: 0x44ff88 },
        { name: '網格.003', radius: 4, tube: 0.2, segments: 32, color: 0xff4488 }
    ]
    
    const meshes = []
    
    rings.forEach((ringConfig, index) => {
        // 创建环形几何体
        const geometry = new THREE.TorusGeometry(
            ringConfig.radius, 
            ringConfig.tube, 
            8,  // 低面数
            ringConfig.segments
        )
        
        const material = new THREE.MeshBasicMaterial({ 
            color: ringConfig.color,
            wireframe: false
        })
        
        const mesh = new THREE.Mesh(geometry, material)
        mesh.name = ringConfig.name
        
        // 设置位置
        mesh.position.set(0, index * 0.5, 0)
        mesh.rotation.x = Math.PI / 2
        
        scene.add(mesh)
        meshes.push(mesh)
        
        console.log(`✅ 创建环 ${index + 1}: ${geometry.attributes.position.count} 顶点`)
    })
    
    // 创建简单的关键帧动画
    const tracks = []
    
    meshes.forEach((mesh, index) => {
        // Y轴旋转动画
        const rotationTrack = new THREE.QuaternionKeyframeTrack(
            `${mesh.name}.quaternion`,
            [0, 2, 4, 6], // 时间关键帧
            [
                ...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0).toArray(),
                ...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).toArray(),
                ...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).toArray(),
                ...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 1.5).toArray()
            ]
        )
        
        tracks.push(rotationTrack)
    })
    
    // 创建动画剪辑
    const animations = [
        new THREE.AnimationClip('Scenes_B_00100Action', 6, [tracks[0]]),
        new THREE.AnimationClip('Scenes_B_0023动作', 6, [tracks[1]]),
        new THREE.AnimationClip('Scenes_B_00100.001Action', 6, [tracks[2]])
    ]
    
    // 统计顶点数
    let totalVertices = 0
    scene.traverse((child) => {
        if (child.isMesh && child.geometry) {
            totalVertices += child.geometry.attributes.position.count
        }
    })
    
    console.log(`📊 测试模型总顶点数: ${totalVertices}`)
    
    // 导出模型
    const exporter = new GLTFExporter()
    
    return new Promise((resolve, reject) => {
        exporter.parse(
            scene,
            (result) => {
                try {
                    const outputBuffer = Buffer.from(result)
                    writeFileSync('./v5-test-simple.glb', outputBuffer)
                    console.log('✅ 简化测试模型已创建: v5-test-simple.glb')
                    console.log(`📦 文件大小: ${(outputBuffer.length / 1024).toFixed(1)} KB`)
                    resolve({ totalVertices, fileSize: outputBuffer.length })
                } catch (error) {
                    reject(error)
                }
            },
            (error) => reject(error),
            {
                binary: true,
                animations: animations
            }
        )
    })
}

// 创建测试模型
createSimpleTestModel()
    .then((stats) => {
        console.log('\n🎉 测试模型创建完成！')
        console.log(`顶点数: ${stats.totalVertices} (远低于120,000限制)`)
        console.log('你现在可以用这个模型测试粒子系统是否正常工作')
        console.log('\n🔄 使用方法:')
        console.log('1. 在main.js中将 \'/v5-transformed.glb\' 改为 \'/v5-test-simple.glb\'')
        console.log('2. 测试粒子系统功能')
        console.log('3. 确认一切正常后再处理复杂模型')
    })
    .catch(console.error)