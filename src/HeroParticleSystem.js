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

        // Animation scene control - set to false to disable specific scenes
        this.enabledScenes = {
            'Scenes_B_00100Action': true,     // Main ring animation
            'Scenes_B_0023动作': false,        // Second ring animation - DISABLED
            'Scenes_B_00100.001Action': false, // Smallest ring - always disabled
            'vipAction.001': false             // VIP ring - always disabled
        }

        this.processor = new SkinnedModelProcessor()
    }
    
    async init() {

        // Find the first skinned mesh in the model
        this.skinnedMesh = this.findSkinnedMesh()
        
        if (!this.skinnedMesh) {
            this.createFromStaticMesh()
            return
        }
        
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
            // Significantly increase particle count for much better visual clarity
            const maxParticles = 120000 // Much higher limit for crisp detail

            // Process as static mesh (simplified version)
            const positions = bestMesh.geometry.attributes.position.array
            this.particleCount = Math.min(positions.length / 3, maxParticles)
            
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
                    uPointSize: { value: 5.5 }, // Larger particles for better visibility
                    uOpacity: { value: 0.9 }, // Slightly higher opacity for clarity
                    uTime: { value: 0.0 }
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
        this.particles = new THREE.Points(this.particleGeometry, this.particleMaterial)
        this.particles.frustumCulled = false
        this.particles.visible = this.visible
        this.scene.add(this.particles)
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
        }
    }
    
    update(deltaTime) {
        // Ultra-smooth animation updates with enhanced time smoothing
        const smoothDeltaTime = Math.min(deltaTime, 1/30) // Cap at 30fps minimum for ultra-smooth animation

        // Apply additional temporal smoothing for particle animations
        if (!this.lastDeltaTime) this.lastDeltaTime = smoothDeltaTime
        const ultraSmoothDelta = this.lastDeltaTime * 0.1 + smoothDeltaTime * 0.9
        this.lastDeltaTime = ultraSmoothDelta

        // Ensure deltaTime is never zero or negative to prevent animation jumps
        const safeDelta = Math.max(ultraSmoothDelta, 0.001)

        // Custom smooth animation time management
        this.customAnimationTime += safeDelta * 0.4 // Slower animation speed for smoother motion

        if (this.animationMixer && this.animationActions.length > 0) {
            // Save current state of smallest ring objects before animation update
            const savedStates = this.smallestRingObjects.map(obj => ({
                object: obj,
                position: obj.position.clone(),
                rotation: obj.rotation.clone(),
                quaternion: obj.quaternion.clone(),
                scale: obj.scale.clone()
            }))

            // Manually control animation time for perfectly smooth looping
            this.animationActions.forEach(({ action, duration }) => {
                // Calculate smooth looping time with seamless transitions
                const loopTime = this.customAnimationTime % duration

                // Set the action time directly - this bypasses Three.js loop logic
                action.time = loopTime
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

        // Update particle rotation time with ultra-smooth interpolation
        if (this.particleMaterial && this.particleMaterial.uniforms.uTime) {
            this.particleMaterial.uniforms.uTime.value += ultraSmoothDelta
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