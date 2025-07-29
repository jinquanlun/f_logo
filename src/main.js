import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { HeroParticleSystem } from './HeroParticleSystem.js'

class HeroParticleApp {
    constructor() {
        this.canvas = document.getElementById('three-canvas')

        this.init()
        this.loadModel()
        this.setupEventListeners()
        this.animate()
    }
    
    init() {
        // Scene setup
        this.scene = new THREE.Scene()

        // Deep ocean gradient background - blue-black with subtle gradient
        this.createGradientBackground()
        
        // Camera setup
        const aspect = window.innerWidth / window.innerHeight
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
        this.camera.position.set(4, 4, 4)
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true,
            alpha: true
        })
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        

        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
        this.scene.add(ambientLight)
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(5, 5, 5)
        directionalLight.castShadow = true
        this.scene.add(directionalLight)
        
        // Animation clock
        this.clock = new THREE.Clock()

        // Cinematic camera system
        this.setupCinematicCamera()
    }

    createGradientBackground() {
        // Create a canvas for the gradient
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 512

        const context = canvas.getContext('2d')

        // Create pure black background
        context.fillStyle = '#000000'
        context.fillRect(0, 0, canvas.width, canvas.height)

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas)
        texture.mapping = THREE.EquirectangularReflectionMapping

        // Apply as background
        this.scene.background = texture
    }

    setupCinematicCamera() {
        // Define two cinematic viewpoints
        this.cameraPositions = [
            {
                // Position 1: Dramatic angle from upper right
                position: new THREE.Vector3(8, 6, 12),
                target: new THREE.Vector3(0, 0, 0),
                name: "Hero Angle"
            },
            {
                // Position 2: Close-up detail view from lower left
                position: new THREE.Vector3(-10, -4, 8),
                target: new THREE.Vector3(2, 1, -1),
                name: "Detail View"
            }
        ]

        // Animation state
        this.currentCameraIndex = 0
        this.cameraTransitionTime = 0
        this.cameraHoldTime = 0
        this.isTransitioning = false

        // Timing settings (in seconds) - longer for more cinematic feel
        this.holdDuration = 5.5      // How long to hold each position
        this.transitionDuration = 4.0 // Longer transitions for smoother movement

        // Set initial camera position
        this.setCameraToPosition(0)
    }

    setCameraToPosition(index) {
        const pos = this.cameraPositions[index]
        this.camera.position.copy(pos.position)
        this.camera.lookAt(pos.target)
    }

    updateCinematicCamera(deltaTime) {
        if (this.isTransitioning) {
            // Currently transitioning between positions
            this.cameraTransitionTime += deltaTime
            const progress = Math.min(this.cameraTransitionTime / this.transitionDuration, 1.0)

            // Ultra-smooth organic easing function
            const easedProgress = this.organicEaseInOut(progress)

            // Get current and next positions
            const currentPos = this.cameraPositions[this.currentCameraIndex]
            const nextIndex = (this.currentCameraIndex + 1) % this.cameraPositions.length
            const nextPos = this.cameraPositions[nextIndex]

            // Create curved path for more organic movement
            const curvedPosition = this.createCurvedPath(currentPos.position, nextPos.position, easedProgress)
            const curvedTarget = this.createCurvedPath(currentPos.target, nextPos.target, easedProgress)

            // Apply the curved interpolation
            this.camera.position.copy(curvedPosition)
            this.camera.lookAt(curvedTarget)

            // Check if transition is complete
            if (progress >= 1.0) {
                this.isTransitioning = false
                this.currentCameraIndex = nextIndex
                this.cameraHoldTime = 0
                this.cameraTransitionTime = 0
            }
        } else {
            // Currently holding at a position with enhanced organic movement
            this.cameraHoldTime += deltaTime

            // More subtle and organic breathing effects
            const currentPos = this.cameraPositions[this.currentCameraIndex]
            const time = this.cameraHoldTime

            // Multiple layered sine waves for organic movement
            const breathingY = Math.sin(time * 0.6) * 0.08 + Math.sin(time * 1.3) * 0.03
            const floatingX = Math.cos(time * 0.4) * 0.04 + Math.sin(time * 0.9) * 0.02
            const driftZ = Math.sin(time * 0.3) * 0.03

            // Apply subtle organic movement
            this.camera.position.copy(currentPos.position)
            this.camera.position.y += breathingY
            this.camera.position.x += floatingX
            this.camera.position.z += driftZ
            this.camera.lookAt(currentPos.target)

            // Check if it's time to start next transition
            if (this.cameraHoldTime >= this.holdDuration) {
                this.isTransitioning = true
                this.cameraTransitionTime = 0
            }
        }
    }

    // Ultra-smooth organic easing function for natural camera movement
    organicEaseInOut(t) {
        // Combination of multiple easing curves for organic feel
        const quintic = t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
        const sine = (1 - Math.cos(t * Math.PI)) / 2

        // Blend the curves for ultra-smooth organic movement
        return quintic * 0.7 + sine * 0.3
    }

    // Create curved path between two points for more natural camera movement
    createCurvedPath(startPos, endPos, t) {
        // Create a control point for the curve (slightly offset for natural arc)
        const midPoint = new THREE.Vector3().lerpVectors(startPos, endPos, 0.5)

        // Add perpendicular offset to create gentle arc
        const direction = new THREE.Vector3().subVectors(endPos, startPos).normalize()
        const perpendicular = new THREE.Vector3(-direction.z, direction.y, direction.x)
        const arcHeight = startPos.distanceTo(endPos) * 0.15 // Subtle arc

        midPoint.add(perpendicular.multiplyScalar(arcHeight))

        // Quadratic Bezier curve interpolation
        const oneMinusT = 1 - t
        const result = new THREE.Vector3()

        result.x = oneMinusT * oneMinusT * startPos.x + 2 * oneMinusT * t * midPoint.x + t * t * endPos.x
        result.y = oneMinusT * oneMinusT * startPos.y + 2 * oneMinusT * t * midPoint.y + t * t * endPos.y
        result.z = oneMinusT * oneMinusT * startPos.z + 2 * oneMinusT * t * midPoint.z + t * t * endPos.z

        return result
    }
    
    async loadModel() {
        try {
            // Set up DRACO loader for compressed models
            const dracoLoader = new DRACOLoader()
            dracoLoader.setDecoderPath('/draco/')

            const loader = new GLTFLoader()
            loader.setDRACOLoader(dracoLoader)

            const gltf = await new Promise((resolve, reject) => {
                loader.load('/v5-transformed.glb', resolve, undefined, reject)
            })

            this.model = gltf.scene
            this.animations = gltf.animations

            // Add model to scene
            this.scene.add(this.model)

            // Auto-position camera to fit model
            this.fitCameraToModel()

            // Initialize particle system
            this.particleSystem = new HeroParticleSystem(this.scene, this.model, this.animations)
            await this.particleSystem.init()

        } catch (error) {
            console.error('Error loading model:', error)
        }
    }
    
    fitCameraToModel() {
        if (!this.model) return

        // Calculate model bounds for reference
        const box = new THREE.Box3().setFromObject(this.model)
        const size = box.getSize(new THREE.Vector3()).length()
        const center = box.getCenter(new THREE.Vector3())

        // Update cinematic camera positions based on model size and center
        // Optimized distances for enhanced particle detail visibility
        this.cameraPositions = [
            {
                // Position 1: Interior upward view - dramatic wormhole perspective
                position: new THREE.Vector3(
                   center.x + size * -0.212,                // X轴：摄像机在模型中心
                   center.y + size * 0.159,  // Y轴：摄像机在结构底部
                   center.z + size * 0.018
                   // Z轴：摄像机在模型中心深度
                ),
                target: new THREE.Vector3(
                    center.x + size * 0.633,              // X轴：直视上方，无偏移
                    center.y + size * -0.094,  // Y轴：看向结构顶部开口
                    center.z + size * -0.510                // Z轴：直视上方，无偏移
                ),
                name: "Interior Upward View"
            },
            {
                // Position 2: Intimidating low angle - creates towering, imposing presence
                position: new THREE.Vector3(
                    center.x + size * 0.04,
                    center.y + size * 0.004,  // 从 -0.28 调整为 -0.15 (提高摄像机位置)
                    center.z + size * 0.088
                ),
                target: new THREE.Vector3(
                    center.x - size * 0.606,
                    center.y - size * 0.095,  // 从 +0.20 调整为 +0.05 (降低目标点)
                    center.z + size * -0.750
                ),
                name: "Intimidating Low Angle"
            }
        ]

        // Reset camera animation state and set initial position
        this.currentCameraIndex = 0
        this.cameraTransitionTime = 0
        this.cameraHoldTime = 0
        this.isTransitioning = false
        this.setCameraToPosition(0)
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight
            this.camera.updateProjectionMatrix()
            this.renderer.setSize(window.innerWidth, window.innerHeight)
        })
    }
    
    animate() {
        requestAnimationFrame(() => this.animate())

        // Get smooth delta time with better frame rate consistency
        let deltaTime = this.clock.getDelta()

        // More aggressive smoothing for ultra-smooth animation
        deltaTime = Math.min(deltaTime, 1/20) // Cap at 20fps minimum for smoother motion

        // Apply temporal smoothing to reduce jitter
        if (!this.lastDeltaTime) this.lastDeltaTime = deltaTime
        deltaTime = this.lastDeltaTime * 0.1 + deltaTime * 0.9 // Smooth blend
        this.lastDeltaTime = deltaTime

        // Update cinematic camera system
        this.updateCinematicCamera(deltaTime)

        // Update particle system
        if (this.particleSystem) {
            this.particleSystem.update(deltaTime)
        }

        this.renderer.render(this.scene, this.camera)
    }
}

// Initialize the app
new HeroParticleApp()