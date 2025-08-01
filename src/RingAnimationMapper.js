import * as THREE from 'three'

/**
 * 圆环动画映射器 - 将新的动画轨迹映射到现有粒子系统
 * 
 * 功能：
 * 1. 识别现有场景中的三个圆环对象
 * 2. 将提取的动画轨迹映射到对应圆环
 * 3. 实现实时轨迹替换和切换
 * 4. 保持粒子系统跟随新轨迹运动
 */
export class RingAnimationMapper {
    constructor(scene, model) {
        this.scene = scene
        this.model = model
        
        // 圆环对象引用
        this.ringObjects = {
            mainRing: null,      // Scenes_B_00100
            middleRing: null,    // Scenes_B_0023  
            smallRing: null      // Scenes_B_00100001
        }
        
        // 动画状态管理
        this.animationMixer = null
        this.currentActions = new Map()
        this.isUsingCustomTracks = false
        this.customAnimationTime = 0

        // Animation completion state
        this.isAnimationComplete = false
        this.animationDuration = 0
        this.onAnimationComplete = null // Callback function
        
        // 轨迹数据存储
        this.customTracks = new Map()
        this.originalTransforms = new Map()
        
        // 初始化时自动识别圆环
        this.identifyRingObjects()
    }

    /**
     * 自动识别场景中的圆环对象
     */
    identifyRingObjects() {
        console.log('🔍 正在识别场景中的圆环对象...')
        
        if (!this.model) {
            console.warn('⚠️ 模型未加载，无法识别圆环对象')
            return
        }

        const foundRings = {}
        
        this.model.traverse((child) => {
            const name = child.name
            
            // 根据名称模式识别圆环
            if (name.includes('Scenes_B_00100') && !name.includes('001')) {
                foundRings.mainRing = child
                console.log(`✅ 找到主环: ${name}`)
            } else if (name.includes('Scenes_B_0023')) {
                foundRings.middleRing = child
                console.log(`✅ 找到中环: ${name}`)
            } else if (name.includes('Scenes_B_00100001') || name.includes('00100.001')) {
                foundRings.smallRing = child
                console.log(`✅ 找到小环: ${name}`)
            }
        })

        // 更新圆环对象引用
        Object.assign(this.ringObjects, foundRings)
        
        // 保存原始变换状态
        this.saveOriginalTransforms()
        
        const foundCount = Object.values(foundRings).filter(ring => ring !== null).length
        console.log(`🎯 圆环识别完成，找到 ${foundCount}/3 个圆环对象`)
        
        return foundRings
    }

    /**
     * 保存原始变换状态，用于恢复
     */
    saveOriginalTransforms() {
        Object.entries(this.ringObjects).forEach(([ringType, ringObject]) => {
            if (ringObject) {
                this.originalTransforms.set(ringType, {
                    position: ringObject.position.clone(),
                    rotation: ringObject.rotation.clone(),
                    quaternion: ringObject.quaternion.clone(),
                    scale: ringObject.scale.clone()
                })
            }
        })
        console.log('💾 原始变换状态已保存')
    }

    /**
     * 应用自定义动画轨迹到圆环
     * @param {Map} extractedTracks 从AnimationTrackExtractor获取的轨迹数据
     */
    applyCustomTracks(extractedTracks) {
        console.log('🎬 开始应用自定义动画轨迹...')
        
        this.customTracks.clear()
        let appliedCount = 0
        
        extractedTracks.forEach((trackData, ringType) => {
            const ringObject = this.ringObjects[ringType]
            if (!ringObject) {
                console.warn(`⚠️ 找不到 ${ringType} 对象，跳过轨迹应用`)
                return
            }

            if (!trackData.hasAnimations || trackData.animations.length === 0) {
                console.warn(`⚠️ ${ringType} 没有有效的动画轨迹`)
                return
            }

            // 存储轨迹数据以供实时播放使用
            this.customTracks.set(ringType, {
                ringObject,
                trackData,
                currentAnimation: 0 // 默认使用第一个动画
            })
            
            appliedCount++
            console.log(`✅ ${ringType} 轨迹应用成功`)
        })

        this.isUsingCustomTracks = appliedCount > 0
        this.customAnimationTime = 0
        this.isAnimationComplete = false

        // Calculate total animation duration (use the longest animation)
        if (appliedCount > 0) {
            let maxDuration = 0
            this.customTracks.forEach((trackInfo) => {
                if (trackInfo.trackData.animations && trackInfo.trackData.animations.length > 0) {
                    const duration = trackInfo.trackData.animations[trackInfo.currentAnimation].duration
                    maxDuration = Math.max(maxDuration, duration)
                }
            })
            this.animationDuration = maxDuration
            console.log(`📏 圆环动画总时长: ${this.animationDuration.toFixed(2)}秒`)
        }

        console.log(`🎉 自定义轨迹应用完成，${appliedCount} 个圆环将使用新轨迹`)
        return appliedCount > 0
    }

    /**
     * 更新自定义动画（在主循环中调用）
     * @param {number} deltaTime 时间增量
     */
    updateCustomAnimation(deltaTime) {
        if (!this.isUsingCustomTracks || this.customTracks.size === 0 || this.isAnimationComplete) {
            return
        }

        // 更新动画时间
        this.customAnimationTime += deltaTime

        // Check if animation is complete
        if (this.animationDuration > 0 && this.customAnimationTime >= this.animationDuration) {
            this.customAnimationTime = this.animationDuration
            this.isAnimationComplete = true
            console.log('🎬 圆环动画播放完成')

            // Trigger completion callback
            if (this.onAnimationComplete) {
                this.onAnimationComplete()
            }
        }

        // 应用每个圆环的动画
        this.customTracks.forEach((trackInfo, ringType) => {
            this.applyTrackToRing(trackInfo, this.customAnimationTime)
        })
    }

    /**
     * 将轨迹数据应用到具体的圆环对象
     */
    applyTrackToRing(trackInfo, currentTime) {
        const { ringObject, trackData, currentAnimation } = trackInfo
        
        if (!trackData.animations[currentAnimation]) {
            return
        }

        const animation = trackData.animations[currentAnimation]
        const duration = animation.duration

        // 使用当前时间，不循环播放
        const animationTime = Math.min(currentTime, duration)
        
        // 应用位置轨迹
        if (animation.tracks.position) {
            const position = this.interpolateTrack(animation.tracks.position, animationTime)
            if (position) {
                ringObject.position.set(position.x, position.y, position.z)
            }
        }

        // 应用四元数旋转轨迹
        if (animation.tracks.quaternion) {
            const quaternion = this.interpolateQuaternionTrack(animation.tracks.quaternion, animationTime)
            if (quaternion) {
                ringObject.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
            }
        }

        // 应用欧拉角旋转轨迹（如果没有四元数轨迹）
        if (!animation.tracks.quaternion && animation.tracks.rotation) {
            const rotation = this.interpolateTrack(animation.tracks.rotation, animationTime)
            if (rotation) {
                ringObject.rotation.set(rotation.x, rotation.y, rotation.z)
            }
        }

        // 应用缩放轨迹
        if (animation.tracks.scale) {
            const scale = this.interpolateTrack(animation.tracks.scale, animationTime)
            if (scale) {
                ringObject.scale.set(scale.x, scale.y, scale.z)
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
     * 恢复到原始动画轨迹
     */
    restoreOriginalAnimation() {
        console.log('🔄 恢复原始动画轨迹...')
        
        this.isUsingCustomTracks = false
        this.customTracks.clear()
        this.customAnimationTime = 0
        
        // 恢复原始变换状态
        this.originalTransforms.forEach((transform, ringType) => {
            const ringObject = this.ringObjects[ringType]
            if (ringObject && transform) {
                ringObject.position.copy(transform.position)
                ringObject.rotation.copy(transform.rotation)
                ringObject.quaternion.copy(transform.quaternion)
                ringObject.scale.copy(transform.scale)
            }
        })
        
        console.log('✅ 已恢复到原始动画轨迹')
    }

    /**
     * 切换指定圆环的动画
     * @param {string} ringType 圆环类型
     * @param {number} animationIndex 动画索引
     */
    switchRingAnimation(ringType, animationIndex) {
        const trackInfo = this.customTracks.get(ringType)
        if (!trackInfo) {
            console.warn(`⚠️ 找不到 ${ringType} 的轨迹数据`)
            return false
        }

        if (animationIndex >= trackInfo.trackData.animations.length) {
            console.warn(`⚠️ ${ringType} 动画索引超出范围: ${animationIndex}`)
            return false
        }

        trackInfo.currentAnimation = animationIndex
        console.log(`🔄 ${ringType} 切换到动画 ${animationIndex}`)
        return true
    }

    /**
     * 获取当前状态信息
     */
    getStatus() {
        return {
            isUsingCustomTracks: this.isUsingCustomTracks,
            currentTime: this.customAnimationTime,
            activeTracks: this.customTracks.size,
            identifiedRings: Object.values(this.ringObjects).filter(ring => ring !== null).length,
            ringObjects: Object.fromEntries(
                Object.entries(this.ringObjects).map(([key, obj]) => [key, !!obj])
            )
        }
    }

    /**
     * 设置动画播放速度
     * @param {number} speed 播放速度倍数
     */
    setAnimationSpeed(speed) {
        this.animationSpeed = Math.max(0.1, Math.min(3.0, speed))
    }

    /**
     * 暂停/恢复动画
     */
    togglePause() {
        this.isPaused = !this.isPaused
        return this.isPaused
    }

    /**
     * Set callback function to be called when animation completes
     */
    setOnAnimationComplete(callback) {
        this.onAnimationComplete = callback
    }

    /**
     * Check if animation is complete
     */
    isComplete() {
        return this.isAnimationComplete
    }

    /**
     * Reset animation to start from beginning
     */
    resetAnimation() {
        this.customAnimationTime = 0
        this.isAnimationComplete = false
        console.log('🔄 圆环动画已重置')
    }

    /**
     * Start ring animation (used for sequencing)
     */
    startAnimation() {
        if (!this.isUsingCustomTracks) {
            console.warn('⚠️ 没有自定义轨迹可播放')
            return false
        }

        this.resetAnimation()
        console.log('🎬 开始播放圆环动画')
        return true
    }

    /**
     * 清理资源
     */
    dispose() {
        this.customTracks.clear()
        this.originalTransforms.clear()
        this.isUsingCustomTracks = false
        
        if (this.animationMixer) {
            this.animationMixer.stopAllAction()
            this.animationMixer = null
        }
    }
}