import * as THREE from 'three'
import { SkinnedModelProcessor } from './SkinnedModelProcessor.js'
import { particleVertexShader } from './shaders/particles.vert.js'
import { particleFragmentShader } from './shaders/particles.frag.js'

export class HeroParticleSystem {
    constructor(scene, model, animations) {
        this.scene = scene
        this.model = model
        this.animations = animations
        
        this.particleCount = 0
        this.textureWidth = 0
        this.textureHeight = 0
        this.boneCount = 0
        this.visible = true
        
        this.particles = null
        this.particleMaterial = null
        this.skinnedMesh = null
        this.animationMixer = null
        this.animationActions = []
        this.customAnimationTime = 0
        this.smallestRingObjects = [] // Store references to smallest ring objects

        // Enhanced animation control system
        this.animationSpeed = 1.0

        // Animation completion state
        this.isAnimationComplete = false
        this.animationDuration = 0
        this.onAnimationComplete = null // Callback function
        
        // Advanced particle behavior system
        this.mousePosition = new THREE.Vector3()
        this.mouseStrength = 0.0
        this.environmentalPhase = 0.0
        this.magneticField = {
            enabled: true,
            strength: 2.0,
            range: 8.0,
            falloff: 2.0
        }
        this.morphingState = {
            enabled: true,
            intensity: 0.5,
            frequency: 0.3,
            phase: 0.0
        }
        this.animationBlending = {
            enabled: true,
            primaryWeight: 1.0,
            secondaryWeight: 0.0,
            blendSpeed: 2.0,
            targetPrimary: 0,
            targetSecondary: 1
        }
        this.animationModes = {
            SINGLE: 'single',
            BLEND: 'blend',
            SEQUENCE: 'sequence',
            DYNAMIC: 'dynamic'
        }
        this.currentMode = this.animationModes.DYNAMIC
        
        // Performance optimization system
        this.performanceMonitor = {
            frameCount: 0,
            lastFPSCheck: 0,
            averageFPS: 60,
            targetFPS: 60,
            adaptiveQuality: true,
            currentQuality: 1.0, // 0.5 = half quality, 1.0 = full quality
            qualityLevels: {
                LOW: { particleSize: 4.0, opacity: 0.6, complexity: 0.5 },
                MEDIUM: { particleSize: 5.5, opacity: 0.75, complexity: 0.75 },
                HIGH: { particleSize: 6.5, opacity: 0.85, complexity: 1.0 }
            }
        }

        // Animation scene control - set to false to disable specific scenes
        // 支持新旧两种动画命名格式
        this.enabledScenes = {
            // 新模型动画名称 (Action.00X格式)
            'Action.002': true,               // Main ring animation (新格式)
            'Action.003': false,              // Second ring animation - DISABLED (新格式)
            'Action.004': false,              // Smallest ring - always disabled (新格式)
            'Action.005': false,              // VIP ring - always disabled (新格式)
            
            // 原始动画名称 (向后兼容)
            'Scenes_B_00100Action': true,     // Main ring animation (原格式)
            'Scenes_B_0023动作': false,        // Second ring animation - DISABLED (原格式)
            'Scenes_B_00100.001Action': false, // Smallest ring - always disabled (原格式)
            '素白艺术™_-_suby.cn/vipAction.001': false, // VIP ring - always disabled (原格式)
            'vipAction.001': false             // VIP ring fallback name
        }

        this.processor = new SkinnedModelProcessor()
    }
    
    async init() {
        console.log('🔍 HeroParticleSystem: 开始初始化...')

        // Find the first skinned mesh in the model
        this.skinnedMesh = this.findSkinnedMesh()

        if (!this.skinnedMesh) {
            console.log('⚠️ 未找到SkinnedMesh，使用静态网格创建粒子系统')
            this.createFromStaticMesh()
            return
        }

        console.log('✅ 找到SkinnedMesh:', this.skinnedMesh.name)
        
        // Process the skinned mesh data
        const processedData = this.processor.processSkinnedMesh(this.skinnedMesh)
        
        this.particleCount = processedData.particleCount
        this.textureWidth = processedData.textureWidth
        this.textureHeight = processedData.textureHeight
        this.boneCount = this.skinnedMesh.skeleton ? this.skinnedMesh.skeleton.bones.length : 0
        
        // Create particle system
        this.createParticleGeometry()
        this.createParticleMaterial(processedData)
        this.createParticleObject()
        


        // Find and store references to smallest ring objects
        this.findSmallestRingObjects()

        // Setup animation
        if (this.animations.length > 0) {
            this.setupAnimation()
        }
        

    }
    

    
    findSkinnedMesh() {
        let skinnedMesh = null

        this.model.traverse((child) => {
            if (child.isSkinnedMesh && !skinnedMesh) {
                skinnedMesh = child
            }
        })

        return skinnedMesh
    }

    findSmallestRingObjects() {
        this.smallestRingObjects = []

        this.model.traverse((child) => {
            // Look for objects that might be related to the smallest ring
            if (child.name.includes('00100001') ||
                child.name.includes('vip') ||
                child.name.includes('素白艺术')) {
                this.smallestRingObjects.push(child)
            }
        })
    }

    isAnimationEnabled(animationName) {
        // Check exact matches first
        if (this.enabledScenes.hasOwnProperty(animationName)) {
            return this.enabledScenes[animationName]
        }

        // Check partial matches for flexibility
        for (const [sceneName, enabled] of Object.entries(this.enabledScenes)) {
            if (animationName.includes(sceneName) || sceneName.includes(animationName)) {
                return enabled
            }
        }

        // Default to enabled if not found in the list
        return true
    }
    
    createFromStaticMesh() {
        // For now, find the first mesh with the most vertices
        let bestMesh = null
        let maxVertices = 0
        
        this.model.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const vertexCount = child.geometry.attributes.position.count
                if (vertexCount > maxVertices) {
                    maxVertices = vertexCount
                    bestMesh = child
                }
            }
        })
        
        if (bestMesh) {
            console.log('✅ 找到最佳网格:', bestMesh.name, '顶点数:', maxVertices)

            // Significantly increase particle count for much better visual clarity
            const maxParticles = 120000 // Much higher limit for crisp detail

            // Process as static mesh (simplified version)
            const positions = bestMesh.geometry.attributes.position.array
            this.particleCount = Math.min(positions.length / 3, maxParticles)

            console.log('🎨 创建粒子系统，粒子数量:', this.particleCount)
            
            // Calculate texture dimensions
            this.textureWidth = Math.ceil(Math.sqrt(this.particleCount))
            this.textureHeight = Math.ceil(this.particleCount / this.textureWidth)
            
            // Create base position texture
            const textureData = new Float32Array(this.textureWidth * this.textureHeight * 4)
            for (let i = 0; i < this.particleCount; i++) {
                const i3 = i * 3
                const i4 = i * 4
                textureData[i4] = positions[i3]     // x
                textureData[i4 + 1] = positions[i3 + 1] // y
                textureData[i4 + 2] = positions[i3 + 2] // z
                textureData[i4 + 3] = 1.0           // w
            }
            
            const basePositionTexture = new THREE.DataTexture(
                textureData,
                this.textureWidth,
                this.textureHeight,
                THREE.RGBAFormat,
                THREE.FloatType
            )
            basePositionTexture.needsUpdate = true
            
            const processedData = {
                particleCount: this.particleCount,
                textureWidth: this.textureWidth,
                textureHeight: this.textureHeight,
                basePositionTexture
            }
            
            this.createParticleGeometry()
            this.createParticleMaterial(processedData)
            this.createParticleObject()

            // Find and store references to smallest ring objects
            this.findSmallestRingObjects()

            // Setup animation even for static mesh
            if (this.animations.length > 0) {
                this.setupAnimation()
            }

            console.log('✅ 静态网格粒子系统创建完成')
        } else {
            console.error('❌ 未找到任何可用的网格来创建粒子系统')
        }
    }
    
    createParticleGeometry() {
        this.particleGeometry = new THREE.BufferGeometry()

        // Create UV coordinates for each particle to sample textures
        const uvs = new Float32Array(this.particleCount * 2)

        for (let i = 0; i < this.particleCount; i++) {
            const u = (i % this.textureWidth) / (this.textureWidth - 1)
            const v = Math.floor(i / this.textureWidth) / (this.textureHeight - 1)

            uvs[i * 2] = u
            uvs[i * 2 + 1] = v
        }

        this.particleGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    }
    
    createParticleMaterial(processedData) {
        try {
            this.particleMaterial = new THREE.ShaderMaterial({
                vertexShader: particleVertexShader,
                fragmentShader: particleFragmentShader,
                uniforms: {
                    uBasePositions: { value: processedData.basePositionTexture },
                    uPointSize: { value: 6.5 }, // 恢复原始尺寸
                    uOpacity: { value: 0.85 }, // 恢复原始透明度
                    uTime: { value: 0.0 },
                    uMousePosition: { value: new THREE.Vector3() },
                    uMouseStrength: { value: 0.0 },
                    uMagneticStrength: { value: 2.0 },
                    uMorphingIntensity: { value: 0.5 },
                    uFogNear: { value: 10.0 }, // 匹配主应用设置
                    uFogFar: { value: 100.0 }, // 匹配主应用设置
                    uAtmosphericColor: { value: new THREE.Color(0x94b9ff) }, // 更亮的大气色彩
                    uEnvironmentalShift: { value: 0.0 }
                },
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                vertexColors: false
            })

            // Check for compilation errors
            this.particleMaterial.needsUpdate = true

        } catch (error) {
            // Fallback to basic material
            this.particleMaterial = new THREE.PointsMaterial({
                color: 0x4488ff,
                size: 4.0,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending
            })
        }
    }
    
    createParticleObject() {
        console.log('🎨 创建粒子对象...')
        this.particles = new THREE.Points(this.particleGeometry, this.particleMaterial)
        this.particles.frustumCulled = false
        this.particles.visible = this.visible
        this.scene.add(this.particles)
        console.log('✅ 粒子对象已添加到场景，可见性:', this.visible)
    }
    
    setupAnimation() {
        if (!this.skinnedMesh) {
            if (this.animations.length > 0) {
                this.animationMixer = new THREE.AnimationMixer(this.model)

                // Set interpolation mode for smoother animations
                this.animationMixer.timeScale = 1.0

                this.animations.forEach((clip) => {
                    // Check if this animation scene is enabled
                    const isEnabled = this.isAnimationEnabled(clip.name)
                    if (!isEnabled) {
                        return
                    }

                    const action = this.animationMixer.clipAction(clip)

                    // Disable all automatic looping and time management
                    action.setLoop(THREE.LoopOnce, 1)
                    action.clampWhenFinished = false
                    action.setEffectiveWeight(1.0)
                    action.setEffectiveTimeScale(0) // Disable automatic time progression
                    action.enabled = true

                    // Store action for manual time control
                    this.animationActions.push({
                        action: action,
                        duration: clip.duration,
                        name: clip.name
                    })

                    action.play()
                })

                // Calculate total animation duration (use the longest clip)
                this.animationDuration = Math.max(...this.animationActions.map(a => a.duration))
            }
            return
        }

        this.animationMixer = new THREE.AnimationMixer(this.skinnedMesh)

        // Set interpolation mode for smoother animations
        this.animationMixer.timeScale = 1.0

        if (this.animations.length > 0) {
            this.animations.forEach((clip) => {
                // Check if this animation scene is enabled
                const isEnabled = this.isAnimationEnabled(clip.name)
                if (!isEnabled) {
                    return
                }

                const action = this.animationMixer.clipAction(clip)

                // Disable all automatic looping and time management
                action.setLoop(THREE.LoopOnce, 1)
                action.clampWhenFinished = false
                action.setEffectiveWeight(1.0)
                action.setEffectiveTimeScale(0) // Disable automatic time progression
                action.enabled = true

                // Store action for manual time control
                this.animationActions.push({
                    action: action,
                    duration: clip.duration,
                    name: clip.name
                })

                action.play()
            })

            // Calculate total animation duration (use the longest clip)
            if (this.animationActions.length > 0) {
                this.animationDuration = Math.max(...this.animationActions.map(a => a.duration))
            }
        }
    }
    
    update(deltaTime) {
        // Performance monitoring and adaptive quality
        this.updatePerformanceMonitoring(deltaTime)
        
        // Ultra-smooth animation updates with enhanced time smoothing
        const smoothDeltaTime = Math.min(deltaTime, 1/30) // Cap at 30fps minimum for ultra-smooth animation

        // Apply additional temporal smoothing for particle animations
        if (!this.lastDeltaTime) this.lastDeltaTime = smoothDeltaTime
        const ultraSmoothDelta = this.lastDeltaTime * 0.1 + smoothDeltaTime * 0.9
        this.lastDeltaTime = ultraSmoothDelta

        // Ensure deltaTime is never zero or negative to prevent animation jumps
        const safeDelta = Math.max(ultraSmoothDelta, 0.001)

        // Enhanced animation time management with dynamic speed control
        if (!this.isAnimationComplete) {
            const baseSpeed = 0.4
            const dynamicSpeedVariation = Math.sin(this.customAnimationTime * 0.3) * 0.15 + 1.0
            const finalSpeed = baseSpeed * this.animationSpeed * dynamicSpeedVariation
            this.customAnimationTime += safeDelta * finalSpeed

            // Check if animation is complete
            if (this.animationDuration > 0 && this.customAnimationTime >= this.animationDuration) {
                this.customAnimationTime = this.animationDuration
                this.isAnimationComplete = true
                console.log('🎬 Hero粒子动画播放完成')

                // Trigger completion callback
                if (this.onAnimationComplete) {
                    this.onAnimationComplete()
                }
            }
        }

        if (this.animationMixer && this.animationActions.length > 0) {
            // Save current state of smallest ring objects before animation update
            const savedStates = this.smallestRingObjects.map(obj => ({
                object: obj,
                position: obj.position.clone(),
                rotation: obj.rotation.clone(),
                quaternion: obj.quaternion.clone(),
                scale: obj.scale.clone()
            }))

            // Enhanced animation control with blending and dynamic modes
            this.updateAnimationBlending(ultraSmoothDelta)
            
            this.animationActions.forEach(({ action, duration }, index) => {
                // Use current animation time directly (no looping)
                const animationTime = Math.min(this.customAnimationTime, duration)

                // Apply blending weights based on current mode
                let weight = 1.0
                if (this.currentMode === this.animationModes.BLEND && this.animationActions.length > 1) {
                    if (index === this.animationBlending.targetPrimary) {
                        weight = this.animationBlending.primaryWeight
                    } else if (index === this.animationBlending.targetSecondary) {
                        weight = this.animationBlending.secondaryWeight
                    } else {
                        weight = 0.0
                    }
                } else if (this.currentMode === this.animationModes.DYNAMIC) {
                    // Dynamic weight based on time and animation characteristics (no looping)
                    if (duration > 0) {
                        const timePhase = Math.min(this.customAnimationTime / duration, 1.0)
                        weight = 0.5 + 0.5 * Math.sin(timePhase * Math.PI * 2.0 + index * Math.PI * 0.5)
                    }
                }

                action.setEffectiveWeight(weight)
                action.time = animationTime
            })

            // Apply the time changes without automatic progression
            // IMPORTANT: This resets ALL objects to their initial state!
            this.animationMixer.update(0)

            // Restore the saved state of smallest ring objects
            savedStates.forEach(({ object, position, rotation, quaternion, scale }) => {
                object.position.copy(position)
                object.rotation.copy(rotation)
                object.quaternion.copy(quaternion)
                object.scale.copy(scale)
            })
        }

        // Update particle system uniforms
        if (this.particleMaterial && this.particleMaterial.uniforms) {
            if (this.particleMaterial.uniforms.uTime) {
                this.particleMaterial.uniforms.uTime.value += ultraSmoothDelta
            }
            if (this.particleMaterial.uniforms.uMousePosition) {
                this.particleMaterial.uniforms.uMousePosition.value.copy(this.mousePosition)
            }
            if (this.particleMaterial.uniforms.uMouseStrength) {
                this.particleMaterial.uniforms.uMouseStrength.value = this.mouseStrength
            }
            if (this.particleMaterial.uniforms.uMorphingIntensity) {
                // Update morphing phase
                this.morphingState.phase += ultraSmoothDelta * this.morphingState.frequency
                const morphingValue = this.morphingState.intensity * (0.5 + 0.5 * Math.sin(this.morphingState.phase))
                this.particleMaterial.uniforms.uMorphingIntensity.value = morphingValue
            }
            
            // Update environmental effects
            if (this.particleMaterial.uniforms.uEnvironmentalShift) {
                this.environmentalPhase += ultraSmoothDelta * 0.2
                const envShift = 0.3 + 0.3 * Math.sin(this.environmentalPhase) + 0.2 * Math.cos(this.environmentalPhase * 0.7)
                this.particleMaterial.uniforms.uEnvironmentalShift.value = envShift
            }
            
            // Dynamic atmospheric color
            if (this.particleMaterial.uniforms.uAtmosphericColor) {
                const r = 0.45 + 0.1 * Math.sin(this.environmentalPhase * 0.8)
                const g = 0.72 + 0.08 * Math.cos(this.environmentalPhase * 1.2)
                const b = 1.0 - 0.05 * Math.sin(this.environmentalPhase * 0.5)
                this.particleMaterial.uniforms.uAtmosphericColor.value.setRGB(r, g, b)
            }
        }
    }
    
    updateAnimationBlending(deltaTime) {
        if (!this.animationBlending.enabled || this.animationActions.length < 2) return
        
        // Smooth blending transitions
        const blendSpeed = this.animationBlending.blendSpeed * deltaTime
        
        // Auto-cycle through animations in blend mode
        if (this.currentMode === this.animationModes.BLEND) {
            const cycleDuration = 8.0 // seconds per blend cycle
            const cyclePhase = (this.customAnimationTime / cycleDuration) % 1.0
            
            if (cyclePhase < 0.4) {
                // Blend from primary to secondary
                this.animationBlending.primaryWeight = Math.max(0.0, this.animationBlending.primaryWeight - blendSpeed)
                this.animationBlending.secondaryWeight = Math.min(1.0, this.animationBlending.secondaryWeight + blendSpeed)
            } else if (cyclePhase > 0.6) {
                // Blend back from secondary to primary
                this.animationBlending.primaryWeight = Math.min(1.0, this.animationBlending.primaryWeight + blendSpeed)
                this.animationBlending.secondaryWeight = Math.max(0.0, this.animationBlending.secondaryWeight - blendSpeed)
            }
            
            // Switch targets when blend is complete
            if (cyclePhase > 0.9 && this.animationBlending.primaryWeight > 0.9) {
                this.animationBlending.targetPrimary = (this.animationBlending.targetPrimary + 1) % this.animationActions.length
                this.animationBlending.targetSecondary = (this.animationBlending.targetSecondary + 1) % this.animationActions.length
            }
        }
    }
    
    // Public methods for controlling animation
    setAnimationSpeed(speed) {
        this.animationSpeed = Math.max(0.1, Math.min(3.0, speed))
    }

    setAnimationMode(mode) {
        if (Object.values(this.animationModes).includes(mode)) {
            this.currentMode = mode
        }
    }

    // Set callback function to be called when animation completes
    setOnAnimationComplete(callback) {
        this.onAnimationComplete = callback
    }

    // Check if animation is complete
    isComplete() {
        return this.isAnimationComplete
    }

    // Reset animation to start from beginning
    resetAnimation() {
        this.customAnimationTime = 0
        this.isAnimationComplete = false
        console.log('🔄 Hero粒子动画已重置')
    }
    
    blendToAnimation(primaryIndex, secondaryIndex = null) {
        if (primaryIndex >= 0 && primaryIndex < this.animationActions.length) {
            this.animationBlending.targetPrimary = primaryIndex
            this.animationBlending.targetSecondary = secondaryIndex !== null ? 
                secondaryIndex : (primaryIndex + 1) % this.animationActions.length
            this.currentMode = this.animationModes.BLEND
        }
    }
    
    // Mouse interaction methods
    updateMouseInteraction(mousePosition, strength) {
        this.mousePosition.copy(mousePosition)
        this.mouseStrength = strength
    }
    
    // Advanced particle behavior controls
    setMagneticField(enabled, strength = 2.0, range = 8.0) {
        this.magneticField.enabled = enabled
        this.magneticField.strength = strength
        this.magneticField.range = range
    }
    
    setMorphingEffect(enabled, intensity = 0.5, frequency = 0.3) {
        this.morphingState.enabled = enabled
        this.morphingState.intensity = intensity
        this.morphingState.frequency = frequency
    }
    
    // Performance monitoring and adaptive quality system
    updatePerformanceMonitoring(deltaTime) {
        if (!this.performanceMonitor.adaptiveQuality) return
        
        this.performanceMonitor.frameCount++
        const currentTime = performance.now()
        
        // Check FPS every second
        if (currentTime - this.performanceMonitor.lastFPSCheck > 1000) {
            this.performanceMonitor.averageFPS = this.performanceMonitor.frameCount
            this.performanceMonitor.frameCount = 0
            this.performanceMonitor.lastFPSCheck = currentTime
            
            // Adjust quality based on performance
            this.adjustQualityBasedOnFPS()
        }
    }
    
    adjustQualityBasedOnFPS() {
        const fps = this.performanceMonitor.averageFPS
        const target = this.performanceMonitor.targetFPS
        let newQuality = this.performanceMonitor.currentQuality
        
        if (fps < target * 0.8) { // Below 80% of target FPS
            newQuality = Math.max(0.3, newQuality - 0.1) // Reduce quality
        } else if (fps > target * 0.95) { // Above 95% of target FPS
            newQuality = Math.min(1.0, newQuality + 0.05) // Increase quality
        }
        
        if (newQuality !== this.performanceMonitor.currentQuality) {
            this.performanceMonitor.currentQuality = newQuality
            this.applyQualitySettings(newQuality)
        }
    }
    
    applyQualitySettings(quality) {
        if (!this.particleMaterial || !this.particleMaterial.uniforms) return
        
        // Determine quality level
        let qualityLevel
        if (quality < 0.6) {
            qualityLevel = this.performanceMonitor.qualityLevels.LOW
        } else if (quality < 0.9) {
            qualityLevel = this.performanceMonitor.qualityLevels.MEDIUM
        } else {
            qualityLevel = this.performanceMonitor.qualityLevels.HIGH
        }
        
        // Apply quality settings to uniforms
        if (this.particleMaterial.uniforms.uPointSize) {
            this.particleMaterial.uniforms.uPointSize.value = qualityLevel.particleSize
        }
        if (this.particleMaterial.uniforms.uOpacity) {
            this.particleMaterial.uniforms.uOpacity.value = qualityLevel.opacity
        }
        
        // Adjust morphing and magnetic effects based on quality
        this.morphingState.intensity = this.morphingState.intensity * qualityLevel.complexity
        this.magneticField.strength = this.magneticField.strength * qualityLevel.complexity
    }
    
    // Public methods for performance control
    setAdaptiveQuality(enabled) {
        this.performanceMonitor.adaptiveQuality = enabled
    }
    
    setTargetFPS(fps) {
        this.performanceMonitor.targetFPS = Math.max(30, Math.min(120, fps))
    }
    
    getPerformanceStats() {
        return {
            fps: this.performanceMonitor.averageFPS,
            quality: this.performanceMonitor.currentQuality,
            adaptiveEnabled: this.performanceMonitor.adaptiveQuality
        }
    }
    
    toggleVisibility() {
        this.visible = !this.visible
        if (this.particles) {
            this.particles.visible = this.visible
        }
        if (this.model) {
            this.model.visible = !this.visible
        }
    }
    
    dispose() {
        if (this.particles) {
            this.scene.remove(this.particles)
            this.particleGeometry.dispose()
            this.particleMaterial.dispose()
        }
        
        if (this.animationMixer) {
            this.animationMixer.stopAllAction()
        }
    }
}