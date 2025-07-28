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
        this.createParticleGeometry(processedData)
        this.createParticleMaterial(processedData)
        this.createParticleObject()
        
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
            console.log(`📍 Using static mesh with ${maxVertices} vertices`)
            
            // Process as static mesh (simplified version)
            const positions = bestMesh.geometry.attributes.position.array
            this.particleCount = positions.length / 3
            
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
            
            this.createParticleGeometry(processedData)
            this.createParticleMaterial(processedData)
            this.createParticleObject()



            // Setup animation even for static mesh
            if (this.animations.length > 0) {
                this.setupAnimation()
            }
        }
    }
    
    createParticleGeometry(processedData) {
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
        this.particleMaterial = new THREE.ShaderMaterial({
            vertexShader: particleVertexShader,
            fragmentShader: particleFragmentShader,
            uniforms: {
                uBasePositions: { value: processedData.basePositionTexture },
                uPointSize: { value: 4.0 },
                uOpacity: { value: 0.8 },
                uTime: { value: 0.0 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: false
        })
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
                this.animations.forEach((clip) => {
                    const action = this.animationMixer.clipAction(clip)
                    action.play()
                })
            }
            return
        }

        this.animationMixer = new THREE.AnimationMixer(this.skinnedMesh)

        if (this.animations.length > 0) {
            this.animations.forEach((clip) => {
                const action = this.animationMixer.clipAction(clip)
                action.play()
            })
        }
    }
    
    update(deltaTime) {
        // Smooth animation updates with clamped deltaTime for consistency
        const smoothDeltaTime = Math.min(deltaTime, 1/30) // Cap at 30fps minimum for smooth animation

        if (this.animationMixer) {
            this.animationMixer.update(smoothDeltaTime)
        }

        // Update particle rotation time with smooth interpolation
        if (this.particleMaterial && this.particleMaterial.uniforms.uTime) {
            this.particleMaterial.uniforms.uTime.value += smoothDeltaTime
        }

        // TODO: Update particle positions based on bone transforms
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