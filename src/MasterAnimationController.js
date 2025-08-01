import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

export class MasterAnimationController {
    constructor(camera, scene) {
        this.camera = camera
        this.scene = scene
        
        // 动画控制状态
        this.masterTime = 0
        this.isPlaying = false
        this.duration = 7.0  // 统一7秒时长
        this.hasCompleted = false
        
        // 主文件动画数据
        this.masterModel = null
        this.masterAnimationMixer = null
        this.masterAnimationActions = []
        
        // 相机动画数据
        this.cameraAction = null
        this.initialCameraPosition = null
        this.initialCameraTarget = null
        
        // 圆环动画数据
        this.ringActions = {}
        
        this.setupLoader()
    }
    
    setupLoader() {
        const dracoLoader = new DRACOLoader()
        dracoLoader.setDecoderPath('./public/draco/')
        
        this.loader = new GLTFLoader()
        this.loader.setDRACOLoader(dracoLoader)
    }
    
    async loadMasterFile() {
        try {
            console.log('🎬 开始加载主文件动画系统...')
            
            const gltf = await new Promise((resolve, reject) => {
                this.loader.load('/LOST_cut2_v31-transformed.glb', resolve, undefined, reject)
            })
            
            this.masterModel = gltf.scene
            console.log('✅ 主文件加载完成')
            
            // 将主文件模型添加到场景中（但设为不可见）
            // 我们需要它的变换信息来驱动粒子系统
            this.scene.add(this.masterModel)
            this.masterModel.visible = false  // 隐藏几何体，只使用动画数据
            
            // 分析动画数据
            await this.analyzeMasterAnimations(gltf.animations)
            
            // 提取相机起始位置
            await this.extractInitialCameraPosition()
            
            console.log('🎯 主文件动画系统初始化完成')
            return true
            
        } catch (error) {
            console.error('❌ 主文件加载失败:', error)
            return false
        }
    }
    
    async analyzeMasterAnimations(animations) {
        if (!animations || animations.length === 0) {
            console.warn('⚠️ 主文件中未找到动画数据')
            return
        }
        
        console.log(`🔍 发现 ${animations.length} 个动画轨迹`)
        
        // 创建动画混合器
        this.masterAnimationMixer = new THREE.AnimationMixer(this.masterModel)
        this.masterAnimationMixer.timeScale = 1.0
        
        animations.forEach((animation, index) => {
            console.log(`  📽️ 动画 ${index + 1}: ${animation.name} (时长: ${animation.duration.toFixed(2)}s)`)
            
            const action = this.masterAnimationMixer.clipAction(animation)
            
            // 配置动画播放模式
            action.setLoop(THREE.LoopOnce, 1)  // 只播放一次
            action.clampWhenFinished = true    // 停在最后一帧
            action.setEffectiveWeight(1.0)
            action.setEffectiveTimeScale(0)    // 禁用自动时间进度
            action.enabled = true
            
            // 分类存储动画
            if (animation.name.toLowerCase().includes('action') && 
                !animation.name.includes('Scenes_B')) {
                // 这是相机动画
                this.cameraAction = {
                    action: action,
                    duration: animation.duration,
                    name: animation.name,
                    animation: animation
                }
                console.log(`    🎥 识别为相机动画: ${animation.name}`)
            } else {
                // 这是圆环或其他对象动画
                this.ringActions[animation.name] = {
                    action: action,
                    duration: animation.duration,
                    name: animation.name
                }
                console.log(`    🔄 识别为圆环动画: ${animation.name}`)
            }
            
            // 存储所有动画action用于统一控制
            this.masterAnimationActions.push({
                action: action,
                duration: animation.duration,
                name: animation.name
            })
        })
        
        // 预播放所有动画以准备时间控制
        this.masterAnimationActions.forEach(({ action }) => {
            action.play()
        })
        
        console.log(`✅ 动画系统分析完成: ${Object.keys(this.ringActions).length} 个圆环动画, ${this.cameraAction ? 1 : 0} 个相机动画`)
        console.log('🎯 所有动画将在7秒内完全同步，圆环最终将呈现竖直排列状态')
    }
    
    async extractInitialCameraPosition() {
        if (!this.cameraAction) {
            console.warn('⚠️ 未找到相机动画，使用默认位置')
            this.initialCameraPosition = new THREE.Vector3(8, 6, 12)
            this.initialCameraTarget = new THREE.Vector3(0, 0, 0)
            return
        }
        
        console.log('🎯 提取相机动画起始位置...')
        
        try {
            // 获取相机动画的第一帧数据
            const animation = this.cameraAction.animation
            let initialPosition = new THREE.Vector3(8, 6, 12)  // 默认值
            let initialTarget = new THREE.Vector3(0, 0, 0)     // 默认值
            
            // 查找位置和旋转轨迹
            animation.tracks.forEach(track => {
                if (track.name.includes('.position') && track.times.length > 0) {
                    // 提取第一帧位置
                    initialPosition.set(
                        track.values[0] || 8,
                        track.values[1] || 6,
                        track.values[2] || 12
                    )
                    console.log(`  📍 找到起始位置: (${initialPosition.x.toFixed(2)}, ${initialPosition.y.toFixed(2)}, ${initialPosition.z.toFixed(2)})`)
                }
                
                if (track.name.includes('.quaternion') && track.times.length > 0) {
                    // 从第一帧四元数计算目标点
                    const quaternion = new THREE.Quaternion(
                        track.values[0] || 0,
                        track.values[1] || 0,
                        track.values[2] || 0,
                        track.values[3] || 1
                    )
                    
                    // 计算相机朝向
                    const forward = new THREE.Vector3(0, 0, -1)
                    forward.applyQuaternion(quaternion)
                    initialTarget = initialPosition.clone().add(forward.multiplyScalar(10))
                    
                    console.log(`  🎯 计算目标点: (${initialTarget.x.toFixed(2)}, ${initialTarget.y.toFixed(2)}, ${initialTarget.z.toFixed(2)})`)
                }
            })
            
            this.initialCameraPosition = initialPosition
            this.initialCameraTarget = initialTarget
            
            console.log('✅ 相机起始位置提取完成')
            
        } catch (error) {
            console.error('❌ 提取相机位置失败，使用默认值:', error)
            this.initialCameraPosition = new THREE.Vector3(8, 6, 12)
            this.initialCameraTarget = new THREE.Vector3(0, 0, 0)
        }
    }
    
    // 获取起始相机位置（供main.js使用）
    getInitialCameraPosition() {
        return {
            position: this.initialCameraPosition || new THREE.Vector3(8, 6, 12),
            target: this.initialCameraTarget || new THREE.Vector3(0, 0, 0)
        }
    }
    
    // 启动主文件动画序列
    startMasterAnimation() {
        if (this.hasCompleted) {
            console.log('🔄 动画已完成，不重复播放')
            return false
        }
        
        if (!this.masterAnimationMixer || this.masterAnimationActions.length === 0) {
            console.error('❌ 主文件动画系统未就绪')
            return false
        }
        
        console.log('🎬 启动主文件完整动画序列 (7秒)')
        this.isPlaying = true
        this.masterTime = 0
        
        return true
    }
    
    // 更新动画系统
    update(deltaTime) {
        if (!this.isPlaying || this.hasCompleted) {
            return
        }
        
        if (!this.masterAnimationMixer) {
            return
        }
        
        // 更新主时间轴
        this.masterTime += deltaTime
        
        // 确保不超过动画时长
        if (this.masterTime >= this.duration) {
            this.masterTime = this.duration
            this.isPlaying = false
            this.hasCompleted = true
            console.log('✅ 主文件动画序列播放完成，停在最后一帧')
        }
        
        // 同步所有动画到当前时间
        this.masterAnimationActions.forEach(({ action }) => {
            action.time = this.masterTime
        })
        
        // 应用动画变换（但不推进时间）
        this.masterAnimationMixer.update(0)
        
        // 确保主文件模型的变换已更新，以便粒子系统可以跟随
        if (this.masterModel) {
            this.masterModel.updateMatrixWorld(true)
        }
        
        // 显示进度（每秒输出一次）
        if (Math.floor(this.masterTime * 4) !== Math.floor((this.masterTime - deltaTime) * 4)) {
            const progress = ((this.masterTime / this.duration) * 100).toFixed(1)
            console.log(`🎬 动画进度: ${progress}% (${this.masterTime.toFixed(2)}s / ${this.duration}s)`)
        }
    }
    
    // 检查动画是否完成
    isAnimationComplete() {
        return this.hasCompleted
    }
    
    // 获取当前动画时间
    getCurrentTime() {
        return this.masterTime
    }
    
    // 获取动画进度 (0-1)
    getProgress() {
        return Math.min(this.masterTime / this.duration, 1.0)
    }
    
    // 重置动画系统
    reset() {
        this.masterTime = 0
        this.isPlaying = false
        this.hasCompleted = false
        
        if (this.masterAnimationActions) {
            this.masterAnimationActions.forEach(({ action }) => {
                action.time = 0
            })
            
            if (this.masterAnimationMixer) {
                this.masterAnimationMixer.update(0)
            }
        }
        
        console.log('🔄 主文件动画系统已重置')
    }
    
    // 获取主文件中的圆环对象（供粒子系统使用）
    getRingObjects() {
        if (!this.masterModel) return {}
        
        const ringObjects = {}
        
        this.masterModel.traverse((child) => {
            if (child.name.includes('Scenes_B_00100') && !child.name.includes('001')) {
                ringObjects.mainRing = child
            } else if (child.name.includes('Scenes_B_0023')) {
                ringObjects.middleRing = child
            } else if (child.name.includes('Scenes_B_00100.001') || child.name.includes('00100001')) {
                ringObjects.smallRing = child
            }
        })
        
        return ringObjects
    }
    
    // 清理资源
    dispose() {
        if (this.masterAnimationMixer) {
            this.masterAnimationMixer.stopAllAction()
        }
        
        if (this.masterModel && this.scene) {
            this.scene.remove(this.masterModel)
        }
        
        console.log('🧹 主文件动画系统资源已清理')
    }
}