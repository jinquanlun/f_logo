import { readFileSync } from 'fs'

class SimpleGLBAnalyzer {
    analyzeGLBFile(filePath) {
        try {
            console.log(`📊 分析文件: ${filePath}`)
            
            const buffer = readFileSync(filePath)
            const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
            
            // GLB文件头解析
            const magic = dataView.getUint32(0, true)
            const version = dataView.getUint32(4, true)
            const length = dataView.getUint32(8, true)
            
            if (magic !== 0x46546C67) { // "glTF"
                throw new Error('不是有效的GLB文件')
            }
            
            console.log(`📦 文件信息:`)
            console.log(`  版本: ${version}`)
            console.log(`  文件大小: ${(length / 1024 / 1024).toFixed(2)} MB`)
            
            // 分析JSON块
            const jsonChunkLength = dataView.getUint32(12, true)
            const jsonChunkType = dataView.getUint32(16, true)
            
            if (jsonChunkType !== 0x4E4F534A) { // "JSON"
                throw new Error('找不到JSON块')
            }
            
            const jsonBytes = new Uint8Array(buffer.buffer, buffer.byteOffset + 20, jsonChunkLength)
            const jsonString = new TextDecoder().decode(jsonBytes)
            const gltfData = JSON.parse(jsonString)
            
            this.analyzeGLTFData(gltfData)
            
            return {
                fileSize: length,
                gltfData: gltfData
            }
            
        } catch (error) {
            console.error('❌ 分析失败:', error.message)
            return null
        }
    }
    
    analyzeGLTFData(gltf) {
        console.log('\n🔍 模型分析:')
        
        // 网格分析
        if (gltf.meshes) {
            console.log(`📐 网格数量: ${gltf.meshes.length}`)
            
            let totalVertices = 0
            gltf.meshes.forEach((mesh, index) => {
                console.log(`  网格 ${index}: ${mesh.name || 'Unnamed'}`)
                
                mesh.primitives?.forEach((primitive, pIndex) => {
                    if (primitive.attributes && primitive.attributes.POSITION !== undefined) {
                        const positionAccessor = gltf.accessors[primitive.attributes.POSITION]
                        if (positionAccessor) {
                            console.log(`    图元 ${pIndex}: ${positionAccessor.count.toLocaleString()} 顶点`)
                            totalVertices += positionAccessor.count
                        }
                    }
                })
            })
            
            console.log(`📊 总顶点数: ${totalVertices.toLocaleString()}`)
            
            if (totalVertices > 120000) {
                const excess = totalVertices - 120000
                const reductionNeeded = (excess / totalVertices * 100).toFixed(1)
                console.log(`⚠️  超出限制 ${excess.toLocaleString()} 个顶点`)
                console.log(`📉 需要减少 ${reductionNeeded}% 的顶点`)
            } else {
                console.log('✅ 顶点数量符合要求')
            }
        }
        
        // 动画分析
        if (gltf.animations) {
            console.log(`\n🎬 动画数量: ${gltf.animations.length}`)
            gltf.animations.forEach((animation, index) => {
                console.log(`  动画 ${index}: ${animation.name || 'Unnamed'}`)
                console.log(`    通道数: ${animation.channels?.length || 0}`)
                console.log(`    采样器数: ${animation.samplers?.length || 0}`)
            })
        }
        
        // 材质分析
        if (gltf.materials) {
            console.log(`\n🎨 材质数量: ${gltf.materials.length}`)
        }
        
        // 纹理分析
        if (gltf.textures) {
            console.log(`🖼️  纹理数量: ${gltf.textures.length}`)
        }
        
        // 灯光分析
        if (gltf.extensions?.KHR_lights_punctual?.lights) {
            const lights = gltf.extensions.KHR_lights_punctual.lights
            console.log(`\n💡 灯光数量: ${lights.length}`)
            lights.forEach((light, index) => {
                console.log(`  灯光 ${index}: ${light.type} (${light.name || 'Unnamed'})`)
            })
        }
        
        // 场景分析
        if (gltf.scenes) {
            console.log(`\n🏗️  场景数量: ${gltf.scenes.length}`)
        }
        
        // 节点分析
        if (gltf.nodes) {
            console.log(`🔗 节点数量: ${gltf.nodes.length}`)
        }
    }
    
    compareModels(file1, file2) {
        console.log('\n🔄 对比模型...')
        console.log('='.repeat(60))
        
        const analysis1 = this.analyzeGLBFile(file1)
        console.log('\n' + '='.repeat(60))
        const analysis2 = this.analyzeGLBFile(file2)
        
        if (analysis1 && analysis2) {
            console.log('\n📈 对比结果:')
            console.log('='.repeat(60))
            
            const size1 = analysis1.fileSize / 1024 / 1024
            const size2 = analysis2.fileSize / 1024 / 1024
            const sizeChange = ((size2 - size1) / size1 * 100).toFixed(1)
            
            console.log(`文件大小: ${size1.toFixed(2)}MB → ${size2.toFixed(2)}MB (${sizeChange > 0 ? '+' : ''}${sizeChange}%)`)
            
            // 更多对比...
        }
    }
}

// 分析新旧模型
const analyzer = new SimpleGLBAnalyzer()

console.log('🎯 分析原始模型 vs 新模型')
analyzer.compareModels('./v5-transformed.glb', './LOST_cut2_v5-transformed.glb')