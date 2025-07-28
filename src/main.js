import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
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

        // Pure black background
        this.scene.background = new THREE.Color(0x000000)
        
        // Camera setup
        const aspect = window.innerWidth / window.innerHeight
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
        this.camera.position.set(5, 5, 5)
        
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

        // Set up camera controls with smooth settings
        this.controls = new OrbitControls(this.camera, this.canvas)
        this.controls.enableDamping = true
        this.controls.dampingFactor = 0.08
        this.controls.screenSpacePanning = false
        this.controls.minDistance = 1
        this.controls.maxDistance = 100
        this.controls.maxPolarAngle = Math.PI / 2
        this.controls.rotateSpeed = 0.5
        this.controls.zoomSpeed = 0.8
        this.controls.panSpeed = 0.8
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
        
        const box = new THREE.Box3().setFromObject(this.model)
        const size = box.getSize(new THREE.Vector3()).length()
        const center = box.getCenter(new THREE.Vector3())
        
        this.camera.position.copy(center)
        this.camera.position.x += size / 1.5
        this.camera.position.y += size / 2.0
        this.camera.position.z += size / 1.5
        this.camera.lookAt(center)

        // Update orbit controls target
        this.controls.target.copy(center)
        this.controls.update()

        this.cameraCenter = center
        this.cameraDistance = size
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

        // Get smooth delta time
        let deltaTime = this.clock.getDelta()

        // Smooth deltaTime for consistent animation
        deltaTime = Math.min(deltaTime, 1/30)

        // Update controls
        this.controls.update()

        // Update particle system
        if (this.particleSystem) {
            this.particleSystem.update(deltaTime)
        }

        this.renderer.render(this.scene, this.camera)
    }
}

// Initialize the app
new HeroParticleApp()