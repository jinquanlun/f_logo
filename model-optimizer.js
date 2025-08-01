import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class ModelOptimizer {
    constructor() {
        this.setupLoaders()
        this.simplifyModifier = new SimplifyModifier()
    }

    setupLoaders() {
        const dracoLoader = new DRACOLoader()
        dracoLoader.setDecoderPath('./public/draco/')
        
        this.loader = new GLTFLoader()
        this.loader.setDRACOLoader(dracoLoader)
        
        this.exporter = new GLTFExporter()
    }

    async optimizeModel(inputPath, outputPath, options = {}) {
        const {
            targetVertexCount = 120000,      // 目标顶点数
            preserveAnimations = true,       // 保持动画
            removeLights = true,             // 移除灯光
            removeHelpers = true,            // 移除辅助对象
            simplifyRatio = 0.1,            // 简化比例
            preserveUVs = true,             // 保持UV坐标
            preserveNormals = true          // 保持法线
        } = options

        try {
            console.log('🔄 开始加载模型:', inputPath)
            
            // 读取GLB文件
            const absolutePath = resolve(__dirname, inputPath)
            const fileBuffer = readFileSync(absolutePath)
            
            const gltf = await new Promise((resolve, reject) => {
                this.loader.parse(fileBuffer.buffer, '', resolve, reject)
            })

            console.log('✅ 模型加载完成')
            
            // 分析原始模型
            const originalStats = this.analyzeModel(gltf.scene)
            console.log('📊 原始模型统计:', originalStats)

            // 优化模型
            const optimizedScene = await this.optimizeScene(gltf.scene, {
                targetVertexCount,
                removeLights,
                removeHelpers,
                simplifyRatio,
                preserveUVs,
                preserveNormals
            })

            // 保持动画数据
            const optimizedGLTF = {
                scene: optimizedScene,
                animations: preserveAnimations ? gltf.animations : [],
                asset: gltf.asset || {}
            }

            // 分析优化后的模型
            const optimizedStats = this.analyzeModel(optimizedScene)
            console.log('📊 优化后模型统计:', optimizedStats)

            // 导出优化后的模型
            await this.exportModel(optimizedGLTF, outputPath)

            // 显示优化结果
            this.showOptimizationResults(originalStats, optimizedStats)

            return {
                success: true,
                originalStats,
                optimizedStats,
                reductionRatio: (originalStats.totalVertices - optimizedStats.totalVertices) / originalStats.totalVertices
            }

        } catch (error) {
            console.error('❌ 模型优化失败:', error)
            return { success: false, error: error.message }
        }
    }

    async optimizeScene(scene, options) {
        const optimizedScene = scene.clone()
        let totalVerticesRemoved = 0
        let meshesProcessed = 0

        console.log('🔧 开始优化场景...')

        optimizedScene.traverse((child) => {
            // 移除灯光
            if (options.removeLights && (child.isLight || child.isDirectionalLight || child.isPointLight || child.isSpotLight)) {
                console.log('💡 移除灯光:', child.name)
                child.parent?.remove(child)
                return
            }

            // 移除辅助对象
            if (options.removeHelpers && (child.isHelper || child.name?.includes('Helper') || child.name?.includes('helper'))) {
                console.log('🔧 移除辅助对象:', child.name)
                child.parent?.remove(child)
                return
            }

            // 简化网格
            if (child.isMesh && child.geometry) {
                const originalVertices = child.geometry.attributes.position?.count || 0
                
                console.log(`🔄 简化网格: ${child.name} (原始顶点: ${originalVertices})`)
                
                // 应用几何简化
                const simplifiedGeometry = this.simplifyGeometry(child.geometry, options.simplifyRatio, {
                    preserveUVs: options.preserveUVs,
                    preserveNormals: options.preserveNormals
                })

                const newVertices = simplifiedGeometry.attributes.position?.count || 0
                const verticesRemoved = originalVertices - newVertices
                
                totalVerticesRemoved += verticesRemoved
                meshesProcessed++

                child.geometry.dispose() // 清理原始几何
                child.geometry = simplifiedGeometry

                console.log(`  ✅ 简化完成: ${newVertices} 顶点 (减少 ${verticesRemoved})`)
            }
        })

        console.log(`✅ 场景优化完成: 处理了 ${meshesProcessed} 个网格，总共减少 ${totalVerticesRemoved} 个顶点`)
        return optimizedScene
    }

    simplifyGeometry(geometry, ratio, options = {}) {
        try {
            // 使用Three.js SimplifyModifier
            const simplifiedGeometry = this.simplifyModifier.modify(geometry, Math.floor(geometry.attributes.position.count * ratio))
            
            // 如果简化失败，尝试手动减面
            if (!simplifiedGeometry || simplifiedGeometry.attributes.position.count === 0) {
                console.warn('⚠️ SimplifyModifier失败，尝试手动减面...')
                return this.manualSimplify(geometry, ratio)
            }

            return simplifiedGeometry
        } catch (error) {
            console.warn('⚠️ 几何简化失败，使用手动方法:', error.message)
            return this.manualSimplify(geometry, ratio)
        }
    }

    manualSimplify(geometry, ratio) {
        // 手动减面：每隔几个顶点取一个
        const positions = geometry.attributes.position.array
        const normals = geometry.attributes.normal?.array
        const uvs = geometry.attributes.uv?.array
        const indices = geometry.index?.array

        const step = Math.max(1, Math.floor(1 / ratio))
        const newPositions = []
        const newNormals = normals ? [] : null
        const newUVs = uvs ? [] : null

        for (let i = 0; i < positions.length; i += step * 3) {
            if (i + 2 < positions.length) {
                newPositions.push(positions[i], positions[i + 1], positions[i + 2])
                
                if (newNormals && i + 2 < normals.length) {
                    newNormals.push(normals[i], normals[i + 1], normals[i + 2])
                }
            }
        }

        if (uvs && newUVs) {
            for (let i = 0; i < uvs.length; i += step * 2) {
                if (i + 1 < uvs.length) {
                    newUVs.push(uvs[i], uvs[i + 1])
                }
            }
        }

        const newGeometry = new THREE.BufferGeometry()
        newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
        
        if (newNormals) {
            newGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3))
        } else {
            newGeometry.computeVertexNormals()
        }
        
        if (newUVs) {
            newGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(newUVs, 2))
        }

        return newGeometry
    }

    analyzeModel(scene) {
        let totalVertices = 0
        let totalFaces = 0
        let meshCount = 0
        let lightCount = 0
        let helperCount = 0
        const meshDetails = []

        scene.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const vertices = child.geometry.attributes.position?.count || 0
                const faces = child.geometry.index ? child.geometry.index.count / 3 : vertices / 3
                
                totalVertices += vertices
                totalFaces += faces
                meshCount++
                
                meshDetails.push({
                    name: child.name || 'Unnamed',
                    vertices: vertices,
                    faces: Math.floor(faces)
                })
            } else if (child.isLight) {
                lightCount++
            } else if (child.isHelper || child.name?.includes('Helper')) {
                helperCount++
            }
        })

        return {
            totalVertices,
            totalFaces: Math.floor(totalFaces),
            meshCount,
            lightCount,
            helperCount,
            meshDetails
        }
    }

    async exportModel(gltf, outputPath) {
        console.log('📦 导出优化后的模型...')
        
        return new Promise((resolve, reject) => {
            this.exporter.parse(
                gltf.scene,
                (result) => {
                    try {
                        const outputBuffer = Buffer.from(result)
                        const absoluteOutputPath = resolve(__dirname, outputPath)
                        writeFileSync(absoluteOutputPath, outputBuffer)
                        console.log('✅ 模型导出完成:', outputPath)
                        resolve()
                    } catch (error) {
                        reject(error)
                    }
                },
                (error) => {
                    reject(error)
                },
                {
                    binary: true,
                    animations: gltf.animations || []
                }
            )
        })
    }

    showOptimizationResults(original, optimized) {
        console.log('\n📊 优化结果总结:')
        console.log('='.repeat(50))
        console.log(`顶点数量: ${original.totalVertices.toLocaleString()} → ${optimized.totalVertices.toLocaleString()}`)
        console.log(`面数: ${original.totalFaces.toLocaleString()} → ${optimized.totalFaces.toLocaleString()}`)
        console.log(`网格数量: ${original.meshCount} → ${optimized.meshCount}`)
        console.log(`灯光数量: ${original.lightCount} → ${optimized.lightCount}`)
        
        const vertexReduction = ((original.totalVertices - optimized.totalVertices) / original.totalVertices * 100).toFixed(1)
        const faceReduction = ((original.totalFaces - optimized.totalFaces) / original.totalFaces * 100).toFixed(1)
        
        console.log(`\n📉 减少比例:`)
        console.log(`顶点减少: ${vertexReduction}%`)
        console.log(`面数减少: ${faceReduction}%`)
        
        if (optimized.totalVertices <= 120000) {
            console.log('\n✅ 优化成功！顶点数量符合粒子系统要求 (≤120,000)')
        } else {
            console.log('\n⚠️ 警告：顶点数量仍然超出限制，建议进一步优化')
        }
    }
}

// 使用示例
async function optimizeNewModel() {
    const optimizer = new ModelOptimizer()
    
    console.log('🚀 开始优化新模型...')
    
    const result = await optimizer.optimizeModel(
        './LOST_cut2_v5-transformed.glb',     // 输入文件
        './v5-optimized.glb',                 // 输出文件
        {
            targetVertexCount: 120000,         // 目标顶点数
            simplifyRatio: 0.01,              // 激进简化（保留1%顶点）
            removeLights: true,                // 移除灯光
            removeHelpers: true,               // 移除辅助对象
            preserveAnimations: true,          // 保持动画
            preserveUVs: true,                // 保持UV
            preserveNormals: false            // 重新计算法线
        }
    )
    
    if (result.success) {
        console.log('\n🎉 模型优化完成！')
        console.log(`顶点减少了 ${(result.reductionRatio * 100).toFixed(1)}%`)
        console.log('✅ 优化后的模型保存为: v5-optimized.glb')
    } else {
        console.error('❌ 优化失败:', result.error)
    }
}

// 执行优化
optimizeNewModel().catch(console.error)