import * as THREE from 'three'

/**
 * 相机动画映射器 - 将GLB文件中的相机轨迹应用到Three.js相机
 * 
 * 功能：
 * 1. 提取GLB文件中的相机动画轨迹
 * 2. 将轨迹应用到现有的Three.js相机
 * 3. 与电影级相机系统协调工作
 * 4. 支持相机模式切换和平滑过渡
 */
export class CameraAnimationMapper {
    constructor(camera, scene) {
        this.camera = camera
        this.scene = scene
        
        // 相机轨迹数据
        this.customCameraTracks = null
        this.isUsingCustomCamera = false
        this.customCameraTime = 0
        
        // 原始状态保存
        this.originalCameraState = {
            position: camera.position.clone(),
            rotation: camera.rotation.clone(),
            quaternion: camera.quaternion.clone(),
            fov: camera.fov,
            near: camera.near,
            far: camera.far
        }
        
        // 动画状态
        this.animationSpeed = 1.0
        this.isPaused = false
        this.currentAnimationIndex = 0
        
        console.log('🎥 相机动画映射器初始化完成')
    }

    /**
     * 从GLB文件提取相机动画轨迹
     * @param {string} filePath GLB文件路径
     */
    async extractCameraTracks(filePath) {
        try {
            console.log(`🎬 开始提取相机轨迹: ${filePath}`)
            
            // 使用现有的AnimationTrackExtractor逻辑，但专门处理相机
            const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
            const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js')
            
            const dracoLoader = new DRACOLoader()
            dracoLoader.setDecoderPath('/draco/')
            
            const loader = new GLTFLoader()
            loader.setDRACOLoader(dracoLoader)
            
            const gltf = await new Promise((resolve, reject) => {
                loader.load(filePath, resolve, undefined, reject)
            })

            const cameraTrackData = {
                filePath,
                hasAnimations: gltf.animations && gltf.animations.length > 0,
                animations: [],
                staticCamera: null
            }

            // 查找相机对象
            gltf.scene.traverse((child) => {
                if (child.isCamera || child.type.includes('Camera')) {
                    cameraTrackData.staticCamera = {
                        name: child.name,
                        type: child.type,
                        position: child.position.clone(),
                        rotation: child.rotation.clone(),
                        quaternion: child.quaternion.clone(),
                        fov: child.fov,
                        near: child.near,
                        far: child.far
                    }
                    console.log(`✅ 找到相机对象: ${child.name} (${child.type})`)
                }
            })

            // 提取动画轨迹
            if (gltf.animations && gltf.animations.length > 0) {
                gltf.animations.forEach((animation) => {
                    const animData = this.processCameraAnimation(animation)
                    if (animData) {
                        cameraTrackData.animations.push(animData)
                        console.log(`✅ 提取相机动画: ${animData.name} (${animData.duration.toFixed(2)}s)`)
                    }
                })
            }

            this.customCameraTracks = cameraTrackData
            
            console.log(`🎉 相机轨迹提取完成:`, {
                hasAnimations: cameraTrackData.hasAnimations,
                animationCount: cameraTrackData.animations.length,
                hasStaticCamera: !!cameraTrackData.staticCamera
            })

            return cameraTrackData

        } catch (error) {
            console.error(`❌ 提取相机轨迹失败:`, error)
            return null
        }
    }

    /**
     * 处理单个相机动画，提取相机相关的轨迹
     */
    processCameraAnimation(animation) {
        const animData = {
            name: animation.name,
            duration: animation.duration,
            tracks: {
                position: null,
                rotation: null,
                quaternion: null,
                scale: null,
                fov: null
            }
        }

        animation.tracks.forEach(track => {
            const trackInfo = this.parseTrackName(track.name)
            if (!trackInfo || !this.isCameraTrack(trackInfo.objectName)) {
                return
            }

            const trackType = trackInfo.property
            if (animData.tracks.hasOwnProperty(trackType)) {
                animData.tracks[trackType] = {
                    times: Array.from(track.times),
                    values: Array.from(track.values),
                    interpolation: track.getInterpolation(),
                    valueSize: track.getValueSize(),
                    type: track.constructor.name
                }
                console.log(`  📈 相机轨迹: ${trackInfo.objectName}.${trackType} (${track.times.length}帧)`)
            }
        })

        // 只返回包含有效轨迹的动画
        const hasValidTracks = Object.values(animData.tracks).some(track => track !== null)
        return hasValidTracks ? animData : null
    }

    /**
     * 解析轨迹名称
     */
    parseTrackName(trackName) {
        const parts = trackName.split('.')
        if (parts.length < 2) return null
        
        return {
            objectName: parts[0],
            property: parts[parts.length - 1]
        }
    }

    /**
     * 判断是否为相机轨迹
     */
    isCameraTrack(objectName) {
        return objectName.toLowerCase().includes('cam') || 
               objectName.toLowerCase().includes('camera') ||
               (this.customCameraTracks?.staticCamera?.name === objectName)
    }

    /**
     * 应用自定义相机轨迹
     */
    applyCustomCameraTracks() {
        if (!this.customCameraTracks || this.customCameraTracks.animations.length === 0) {
            console.warn('⚠️ 没有有效的相机轨迹数据')
            return false
        }

        this.isUsingCustomCamera = true
        this.customCameraTime = 0
        
        console.log('🎬 开始使用自定义相机轨迹')
        return true
    }

    /**
     * 更新自定义相机动画（在主循环中调用）
     * @param {number} deltaTime 时间增量
     */
    updateCustomCamera(deltaTime) {
        if (!this.isUsingCustomCamera || !this.customCameraTracks || this.isPaused) {
            return
        }

        // 更新动画时间
        this.customCameraTime += deltaTime * this.animationSpeed

        const animation = this.customCameraTracks.animations[this.currentAnimationIndex]
        if (!animation) return

        const duration = animation.duration
        const loopTime = this.customCameraTime % duration

        // 应用位置轨迹
        if (animation.tracks.position) {
            const position = this.interpolateTrack(animation.tracks.position, loopTime)
            if (position) {
                this.camera.position.set(position.x, position.y, position.z)
            }
        }

        // 应用四元数旋转轨迹（优先）
        if (animation.tracks.quaternion) {
            const quaternion = this.interpolateQuaternionTrack(animation.tracks.quaternion, loopTime)
            if (quaternion) {
                this.camera.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
            }
        } else if (animation.tracks.rotation) {
            // 如果没有四元数，使用欧拉角
            const rotation = this.interpolateTrack(animation.tracks.rotation, loopTime)
            if (rotation) {
                this.camera.rotation.set(rotation.x, rotation.y, rotation.z)
            }
        }

        // 应用FOV轨迹（如果有）
        if (animation.tracks.fov) {
            const fovValue = this.interpolateScalarTrack(animation.tracks.fov, loopTime)
            if (fovValue !== null) {
                this.camera.fov = fovValue
                this.camera.updateProjectionMatrix()
            }
        }
    }

    /**
     * 插值计算轨迹值（向量类型）
     */
    interpolateTrack(track, time) {
        if (!track || !track.times || !track.values) {
            return null
        }

        const times = track.times
        const values = track.values
        const valueSize = track.valueSize || 3
        
        // 找到时间区间
        let i = 0
        while (i < times.length - 1 && times[i + 1] <= time) {
            i++
        }

        // 边界情况处理
        if (i >= times.length - 1) {
            const lastIndex = (times.length - 1) * valueSize
            return {
                x: values[lastIndex],
                y: values[lastIndex + 1], 
                z: values[lastIndex + 2]
            }
        }

        // 线性插值
        const t0 = times[i]
        const t1 = times[i + 1]
        const alpha = (time - t0) / (t1 - t0)

        const i0 = i * valueSize
        const i1 = (i + 1) * valueSize

        return {
            x: THREE.MathUtils.lerp(values[i0], values[i1], alpha),
            y: THREE.MathUtils.lerp(values[i0 + 1], values[i1 + 1], alpha),
            z: THREE.MathUtils.lerp(values[i0 + 2], values[i1 + 2], alpha)
        }
    }

    /**
     * 插值计算四元数轨迹值
     */
    interpolateQuaternionTrack(track, time) {
        if (!track || !track.times || !track.values) {
            return null
        }

        const times = track.times
        const values = track.values
        
        // 找到时间区间
        let i = 0
        while (i < times.length - 1 && times[i + 1] <= time) {
            i++
        }

        // 边界情况处理
        if (i >= times.length - 1) {
            const lastIndex = (times.length - 1) * 4
            return {
                x: values[lastIndex],
                y: values[lastIndex + 1],
                z: values[lastIndex + 2],
                w: values[lastIndex + 3]
            }
        }

        // 四元数球面线性插值
        const t0 = times[i]
        const t1 = times[i + 1]
        const alpha = (time - t0) / (t1 - t0)

        const i0 = i * 4
        const i1 = (i + 1) * 4

        const q0 = new THREE.Quaternion(values[i0], values[i0 + 1], values[i0 + 2], values[i0 + 3])
        const q1 = new THREE.Quaternion(values[i1], values[i1 + 1], values[i1 + 2], values[i1 + 3])
        
        const result = new THREE.Quaternion().slerpQuaternions(q0, q1, alpha)
        
        return {
            x: result.x,
            y: result.y,
            z: result.z,
            w: result.w
        }
    }

    /**
     * 插值计算标量轨迹值（如FOV）
     */
    interpolateScalarTrack(track, time) {
        if (!track || !track.times || !track.values) {
            return null
        }

        const times = track.times
        const values = track.values
        
        // 找到时间区间
        let i = 0
        while (i < times.length - 1 && times[i + 1] <= time) {
            i++
        }

        // 边界情况处理
        if (i >= times.length - 1) {
            return values[times.length - 1]
        }

        // 线性插值
        const t0 = times[i]
        const t1 = times[i + 1]
        const alpha = (time - t0) / (t1 - t0)

        return THREE.MathUtils.lerp(values[i], values[i + 1], alpha)
    }

    /**
     * 恢复到原始相机状态
     */
    restoreOriginalCamera() {
        this.isUsingCustomCamera = false
        this.customCameraTime = 0
        
        // 恢复原始相机状态
        this.camera.position.copy(this.originalCameraState.position)
        this.camera.rotation.copy(this.originalCameraState.rotation)
        this.camera.quaternion.copy(this.originalCameraState.quaternion)
        this.camera.fov = this.originalCameraState.fov
        this.camera.near = this.originalCameraState.near
        this.camera.far = this.originalCameraState.far
        this.camera.updateProjectionMatrix()
        
        console.log('🔄 已恢复到原始相机状态')
    }

    /**
     * 切换相机动画
     * @param {number} animationIndex 动画索引
     */
    switchCameraAnimation(animationIndex) {
        if (!this.customCameraTracks || animationIndex >= this.customCameraTracks.animations.length) {
            console.warn(`⚠️ 相机动画索引超出范围: ${animationIndex}`)
            return false
        }

        this.currentAnimationIndex = animationIndex
        this.customCameraTime = 0
        console.log(`🎬 切换到相机动画 ${animationIndex}: ${this.customCameraTracks.animations[animationIndex].name}`)
        return true
    }

    /**
     * 设置动画播放速度
     */
    setAnimationSpeed(speed) {
        this.animationSpeed = Math.max(0.1, Math.min(3.0, speed))
        console.log(`⚡ 相机动画速度设置为: ${this.animationSpeed}x`)
    }

    /**
     * 暂停/恢复动画
     */
    togglePause() {
        this.isPaused = !this.isPaused
        console.log(`${this.isPaused ? '⏸️ ' : '▶️ '} 相机动画${this.isPaused ? '暂停' : '恢复'}`)
        return this.isPaused
    }

    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            isUsingCustomCamera: this.isUsingCustomCamera,
            currentTime: this.customCameraTime,
            currentAnimation: this.currentAnimationIndex,
            animationSpeed: this.animationSpeed,
            isPaused: this.isPaused,
            hasCustomTracks: !!this.customCameraTracks,
            availableAnimations: this.customCameraTracks ? this.customCameraTracks.animations.length : 0
        }
    }

    /**
     * 清理资源
     */
    dispose() {
        this.customCameraTracks = null
        this.isUsingCustomCamera = false
        this.restoreOriginalCamera()
    }
}