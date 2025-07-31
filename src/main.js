/**
 * 高性能3D粒子系统主应用程序
 * 
 * 架构设计：
 * - 采用模块化设计，将渲染、动画、交互分离为独立组件
 * - 使用GPU加速的粒子系统，支持骨骼动画和实时交互
 * - 实现电影级相机运动系统，提供有机的视觉体验
 * - 集成自适应性能优化，确保在不同设备上的流畅运行
 * 
 * 核心功能：
 * - GLB模型加载与DRACO解压缩
 * - 电影级相机系统（多视角、曲线插值、有机缓动）
 * - 大气光照环境（多层次环境光、氛围雾效）
 * - 鼠标交互系统（磁场吸引、实时响应）
 * - 渐变背景生成（Canvas纹理、等矩形映射）
 * 
 * 性能特性：
 * - 使用WebGL硬件加速渲染
 * - 实现帧率平滑算法，避免动画抖动
 * - 支持阴影映射和抗锯齿
 * - 自动像素比适配，优化高DPI显示
 * 
 * @author Claude Code Generator
 * @version 2.0.0
 * @since 2024
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { HeroParticleSystem } from './HeroParticleSystem.js'
import { AnimationTrackExtractor } from './AnimationTrackExtractor.js'
import { RingAnimationMapper } from './RingAnimationMapper.js'
import { CameraAnimationMapper } from './CameraAnimationMapper.js'

/**
 * 主应用程序类 - 3D粒子系统的核心控制器
 * 
 * 职责分离：
 * - Scene管理：Three.js场景初始化、背景设置、光照配置
 * - Camera系统：电影级相机运动、视角切换、有机动画
 * - Renderer控制：WebGL渲染器配置、性能优化设置
 * - Event处理：用户交互、窗口事件、设备适配
 * - Animation循环：渲染循环、时间管理、状态更新
 * 
 * 设计模式：
 * - 单例模式：确保只有一个应用程序实例
 * - 观察者模式：事件监听和响应机制
 * - 策略模式：不同的相机运动策略
 */
class HeroParticleApp {
    /**
     * 构造函数 - 初始化整个3D应用程序
     * 
     * 执行流程：
     * 1. 获取Canvas元素作为渲染目标
     * 2. 初始化Three.js基础组件（场景、相机、渲染器）
     * 3. 异步加载GLB模型并初始化粒子系统
     * 4. 设置事件监听器（窗口大小、鼠标交互）
     * 5. 启动渲染循环，开始实时渲染
     * 
     * 注意：这里采用链式初始化，确保组件按正确顺序初始化
     */
    constructor() {
        // 获取HTML中的Canvas元素，作为WebGL渲染目标
        this.canvas = document.getElementById('three-canvas')

        // 初始化多动画系统组件
        this.trackExtractor = new AnimationTrackExtractor()
        this.ringMapper = null // 将在模型加载后初始化
        this.cameraMapper = null // 将在场景初始化后创建

        // 按顺序执行初始化流程
        this.init()              // 初始化Three.js基础组件
        this.loadModel()         // 异步加载3D模型
        this.setupEventListeners() // 设置事件监听
        this.animate()           // 启动渲柕循环
    }
    
    /**
     * 初始化方法 - 设置Three.js核心组件
     * 
     * 功能模块：
     * 1. 场景初始化：创建3D世界容器
     * 2. 背景系统：生成深空渐变背景
     * 3. 相机设置：透视相机与初始位置
     * 4. 渲染器配置：WebGL渲柕器与性能优化
     * 5. 大气效果：雾效和深度感
     * 6. 光照系统：多层次环境光照
     * 7. 时间管理：动画时钟初始化
     * 8. 相机系统：电影级运动系统
     * 
     * 性能考虑：
     * - 像素比限制为2，避免过度渲染
     * - 启用抗锯齿提高视觉质量
     * - 使用PCF软阴影提供更自然的光照
     */
    init() {
        // === 场景初始化 ===
        // 创建主场景容器，所有3D对象都将添加到这里
        this.scene = new THREE.Scene()

        // === 背景系统 ===
        // 生成深空主题的渐变背景，为粒子效果提供合适的对比度
        this.createGradientBackground()
        
        // === 相机设置 ===
        // 计算窗口宽高比，确保相机视角与屏幕比例一致
        const aspect = window.innerWidth / window.innerHeight
        
        // 创建透视相机：75°视野角，适合展示3D场景
        // 参数：视野角(75°)、宽高比、近裁剪面(0.1)、远裁剪面(1000)
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
        
        // 设置相机初始位置，后续将被电影级相机系统覆盖
        this.camera.position.set(4, 4, 4)
        
        // === 渲柕器配置 ===
        // 创建WebGL渲柕器，启用高质量渲柕特性
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,    // 指定渲柕目标Canvas
            antialias: true,        // 启用抗锯齿，提高边缘平滑度
            alpha: true            // 支持透明度，便于混合效果
        })
        
        // 设置渲柕尺寸为全屏
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        
        // 限制像素比为2，平衡渲柕质量与性能
        // 在高DPI设备上避免过度渲柕导致的性能问题
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        
        // 启用阴影映射功能，增强3D效果的立体感
        this.renderer.shadowMap.enabled = true
        
        // 使用PCF软阴影算法，提供更自然的阴影边缘
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        
        // === 大气效果 ===
        // 启用线性雾效，提供深度感和大气透视效果
        // 适度扩展远平面以适应相机轨迹
        this.scene.fog = new THREE.Fog(0x000000, 10, 100)
        

        
        // === 大气光照系统 ===
        // 采用多层次光照设计，模拟真实的天空光照环境
        
        // 主环境光：提供基础的全局照明，营造深空氛围
        // 适度增强亮度
        const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.6)
        this.scene.add(ambientLight)
        
        // 主光源：模拟太阳光，提供主要的方向性照明
        // 适度增强亮度
        const directionalLight = new THREE.DirectionalLight(0x4a69bd, 0.8)
        
        // 设置主光源位置：右上方，模拟自然光照角度
        directionalLight.position.set(8, 10, 6)
        
        // 启用阴影投射，增强立体感和空间层次
        directionalLight.castShadow = true
        this.scene.add(directionalLight)
        
        // 辅助光源1：紫色口音光，为场景添加生动性
        // 增强亮度以改善整体照明
        const fillLight1 = new THREE.DirectionalLight(0x8c7ce7, 0.6) // 增强紫色口音
        fillLight1.position.set(-5, 3, -8)
        this.scene.add(fillLight1)
        
        // 辅助光源2：微妙的绿色光线，模拟环境反射光
        // 增强亮度以提供更好的环境光照
        const fillLight2 = new THREE.DirectionalLight(0x4eee91, 0.4) // 增强绿色
        fillLight2.position.set(2, -4, 10)
        this.scene.add(fillLight2)
        
        // 粒子发光效果：为粒子系统提供局部光照
        // 大幅增强点光源范围以覆盖相机轨迹的远距离
        const particleGlow = new THREE.PointLight(0x94d9ff, 2.0, 200) // 扩大照明范围
        particleGlow.position.set(0, 0, 0) // 中心位置
        this.scene.add(particleGlow)
        
        // 存储粒子发光光源引用，供后续动态调整使用
        this.particleGlowLight = particleGlow
        
        // === 时间管理系统 ===
        // 创建动画时钟，提供高精度的时间跟踪
        // 用于控制动画速度、帧率计算和时间同步
        this.clock = new THREE.Clock()
        
        // === 鼠标交互系统 ===
        // 初始化鼠标交互相关的状态变量
        
        // 鼠标在屏幕上的标准化坐标(-1到1范围)
        this.mouse = new THREE.Vector2()
        
        // 鼠标在3D世界中的影响位置，用于粒子磁场计算
        this.mouseInfluence = new THREE.Vector3()
        
        // 鼠标影响强度，控制粒子对鼠标交互的响应程度
        this.mouseStrength = 0.0

        // === 电影级相机系统 ===
        // 初始化高级相机运动系统，实现电影级的视角切换效果
        this.setupCinematicCamera()

        // === 相机动画映射器初始化 ===
        // 创建相机动画映射器，用于应用自定义相机轨迹
        this.cameraMapper = new CameraAnimationMapper(this.camera, this.scene)
    }

    /**
     * 创建渐变背景方法 - 生成高质量的深空背景
     * 
     * 技术实现：
     * 1. 使用Canvas 2D API动态生成纹理
     * 2. 将Canvas转换为Three.js纹理对象
     * 3. 应用等矩形映射实现360°环络效果
     * 
     * 设计理念：
     * - 采用纯黑色背景，突出粒子的发光效果
     * - 避免复杂的渐变，减少视觉干扰
     * - 提供与粒子系统的高对比度
     * 
     * 性能优化：
     * - 使用512x512的适中分辨率，平衡质量与性能
     * - 一次性生成，避免每帧重绘
     */
    createGradientBackground() {
        // 创建离屏Canvas元素，用于动态生成背景纹理
        const canvas = document.createElement('canvas')
        
        // 设置纹理尺寸为512x512，平衡渲柕质量与性能消耗
        // 足够的分辨率保证背景的平滑度，但不会过度消耗GPU内存
        canvas.width = 512
        canvas.height = 512

        // 获取Canvas 2D绘图上下文
        const context = canvas.getContext('2d')

        // 填充纯黑色背景，为粒子发光效果提供理想对比
        // 黑色背景能够最大化地突出发光粒子，印象中的深空主题
        context.fillStyle = '#000000'
        context.fillRect(0, 0, canvas.width, canvas.height)

        // 将Canvas转换为Three.js纹理对象
        // CanvasTexture会自动检测Canvas的变化并更新GPU纹理
        const texture = new THREE.CanvasTexture(canvas)
        
        // 设置等矩形反射映射，实现360°环络背景效果
        // 这种映射方式能够将平面纹理映射到球面，创造无缝背景
        texture.mapping = THREE.EquirectangularReflectionMapping

        // 将生成的纹理应用为场景背景
        this.scene.background = texture
    }

    /**
     * 设置电影级相机系统 - 创建动态的视角切换效果
     * 
     * 电影理论基础：
     * - 多视角组合：提供不同的视觉冲击力和情绪表达
     * - 按黄金比例定位：营造视觉美感和平衡感
     * - 时间节奏控制：通过停留和过渡时间控制叙事节奏
     * 
     * 技术实现：
     * 1. 预设多个精心设计的相机位置和目标点
     * 2. 状态机控制相机在停留和过渡之间切换
     * 3. 时间系统管理每个状态的持续时间
     * 
     * 艺术指导原则：
     * - Hero Angle：戏剧性主视角，展示整体及势和气场
     * - Detail View：细节视角，突出粒子的精细结构
     */
    setupCinematicCamera() {
        // === 相机位置定义 ===
        // 根据电影摄影理论设计的多个视角，每个视角都有特定的艺术意图
        this.cameraPositions = [
            {
                // 位置1：英雄视角 - 从右上方的戏剧性角度
                // 高位俯视能够展示整个粒子系统的壮观及势
                position: new THREE.Vector3(8, 6, 12),
                target: new THREE.Vector3(0, 0, 0),    // 目标中心点
                name: "Hero Angle"
            },
            {
                // 位置2：细节视角 - 从左下方的近距离观察
                // 低角度仰视能够突出粒子的细节和层次感
                position: new THREE.Vector3(-10, -4, 8),
                target: new THREE.Vector3(2, 1, -1),   // 偏移目标，增加动态感
                name: "Detail View"
            }
        ]

        // === 动画状态管理 ===
        // 初始化相机动画的状态变量，用于控制过渡和停留
        
        this.currentCameraIndex = 0      // 当前相机位置索引
        this.cameraTransitionTime = 0    // 过渡动画的当前时间
        this.cameraHoldTime = 0          // 停留状态的持续时间
        this.isTransitioning = false     // 是否正在执行过渡动画

        // === 时间节奏设置 ===
        // 根据电影节奏理论调整的时间参数，创造悠缓的观看体验
        
        this.holdDuration = 5.5          // 每个位置的停留时间(秒)
                                         // 较长的停留时间让观众有充分时间欣赏细节
        
        this.transitionDuration = 4.0    // 过渡动画的持续时间(秒)
                                         // 更长的过渡时间提供更平滑的视觉体验

        // === 初始化相机位置 ===
        // 将相机设置到第一个预设位置，开始电影级演出
        this.setCameraToPosition(0)
    }

    setCameraToPosition(index) {
        const pos = this.cameraPositions[index]
        this.camera.position.copy(pos.position)
        this.camera.lookAt(pos.target)
    }

    /**
     * 更新电影级相机动画 - 核心的相机运动控制逻辑
     * 
     * 状态机设计：
     * - 过渡状态：相机在两个位置之间平滑移动
     * - 停留状态：相机在固定位置停留，但有微妙的有机运动
     * 
     * 算法特点：
     * 1. 使用有机缓动函数，代替线性插值
     * 2. 采用曲线路径插值，遵循自然运动规律
     * 3. 在停留状态下添加微妙的“呼吸”效果
     * 4. 多层次正弦波叠加，创造复杂的有机运动
     * 
     * @param {number} deltaTime - 上一帧的时间间隔(秒)
     */
    updateCinematicCamera(deltaTime) {
        // === 状态判断和分支处理 ===
        
        if (this.isTransitioning) {
            // **过渡状态处理** - 相机正在两个位置之间移动
            
            // 累加过渡时间，计算动画进度
            this.cameraTransitionTime += deltaTime
            
            // 计算线性进度(0-1范围)，并用Math.min确保不超出1.0
            const progress = Math.min(this.cameraTransitionTime / this.transitionDuration, 1.0)

            // 应用有机缓动函数，将线性进度转换为平滑的曲线进度
            // 这使得相机运动更加自然，符合物理直觉
            const easedProgress = this.organicEaseInOut(progress)

            // 获取当前和下一个相机位置配置
            const currentPos = this.cameraPositions[this.currentCameraIndex]
            const nextIndex = (this.currentCameraIndex + 1) % this.cameraPositions.length
            const nextPos = this.cameraPositions[nextIndex]

            // 使用曲线路径插值算法，创建更加自然的运动轨迹
            // 代替简单的线性插值，模拟真实世界中的曲线运动
            const curvedPosition = this.createCurvedPath(currentPos.position, nextPos.position, easedProgress)
            const curvedTarget = this.createCurvedPath(currentPos.target, nextPos.target, easedProgress)

            // 应用计算出的曲线位置和目标点
            this.camera.position.copy(curvedPosition)
            this.camera.lookAt(curvedTarget)

            // 检查过渡是否完成，并切换到下一个状态
            if (progress >= 1.0) {
                this.isTransitioning = false     // 退出过渡状态
                this.currentCameraIndex = nextIndex  // 更新当前位置索引
                this.cameraHoldTime = 0          // 重置停留计时器
                this.cameraTransitionTime = 0    // 重置过渡计时器
            }
            
        } else {
            // **停留状态处理** - 相机停留在固定位置，但有微妙的有机运动
            
            // 累加停留时间
            this.cameraHoldTime += deltaTime

            // 获取当前位置配置和时间参数
            const currentPos = this.cameraPositions[this.currentCameraIndex]
            const time = this.cameraHoldTime

            // === 多层次有机运动算法 ===
            // 使用不同频率和振幅的正弦波叠加，模拟自然的“呼吸”效果
            
            // Y轴(垂直)呼吸运动：主频率 + 高频细节
            const breathingY = Math.sin(time * 0.6) * 0.08 + Math.sin(time * 1.3) * 0.03
            
            // X轴(水平)漂浮运动：余弦和正弦组合，创造圆形轨迹
            const floatingX = Math.cos(time * 0.4) * 0.04 + Math.sin(time * 0.9) * 0.02
            
            // Z轴(深度)漂移运动：低频迟缓运动
            const driftZ = Math.sin(time * 0.3) * 0.03

            // 应用基础位置加上微妙的有机位移
            this.camera.position.copy(currentPos.position)
            this.camera.position.y += breathingY  // 垂直呼吸
            this.camera.position.x += floatingX   // 水平漂浮
            this.camera.position.z += driftZ      // 深度漂移
            
            // 始终看向目标点，保持焦点稳定
            this.camera.lookAt(currentPos.target)

            // 检查是否达到停留时间限制，准备进入下一次过渡
            if (this.cameraHoldTime >= this.holdDuration) {
                this.isTransitioning = true      // 进入过渡状态
                this.cameraTransitionTime = 0    // 重置过渡计时器
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

            // Initialize ring animation mapper
            this.ringMapper = new RingAnimationMapper(this.scene, this.model)

            // Load custom animation tracks
            await this.loadCustomAnimationTracks()

            // Load custom camera tracks
            await this.loadCustomCameraTracks()

        } catch (error) {
            console.error('Error loading model:', error)
        }
    }

    /**
     * 加载自定义动画轨迹
     * 从GLB文件中提取圆环动画数据并应用到场景
     */
    async loadCustomAnimationTracks() {
        try {
            console.log('🎬 开始加载自定义动画轨迹...')
            
            // 提取所有圆环的动画轨迹
            const extractedTracks = await this.trackExtractor.extractAllRingTracks()
            
            if (extractedTracks.length > 0) {
                // 将提取的轨迹数据转换为Map格式
                const tracksMap = new Map()
                extractedTracks.forEach(trackData => {
                    tracksMap.set(trackData.ringType, trackData)
                })
                
                // 应用自定义轨迹到圆环
                const success = this.ringMapper.applyCustomTracks(tracksMap)
                
                if (success) {
                    console.log('✅ 自定义动画轨迹加载成功!')
                    
                    // 输出加载状态摘要
                    const summary = this.trackExtractor.getExtractionSummary()
                    console.log('📊 轨迹提取摘要:', summary)
                    
                    const mapperStatus = this.ringMapper.getStatus()
                    console.log('🎯 映射器状态:', mapperStatus)
                } else {
                    console.warn('⚠️ 自定义动画轨迹应用失败')
                }
            } else {
                console.warn('⚠️ 没有找到有效的动画轨迹数据')
            }
            
        } catch (error) {
            console.error('❌ 加载自定义动画轨迹失败:', error)
        }
    }

    /**
     * 加载自定义相机轨迹
     * 从相机GLB文件中提取相机动画数据并应用
     */
    async loadCustomCameraTracks() {
        try {
            console.log('🎥 开始加载自定义相机轨迹...')
            
            if (!this.cameraMapper) {
                console.warn('⚠️ 相机映射器未初始化')
                return
            }

            // 提取相机动画轨迹
            const cameraData = await this.cameraMapper.extractCameraTracks('/cam_cut2_v3cam.glb')
            
            if (cameraData && cameraData.hasAnimations) {
                console.log('✅ 自定义相机轨迹加载成功!')
                console.log('📊 相机轨迹摘要:', {
                    animations: cameraData.animations.length,
                    hasStaticCamera: !!cameraData.staticCamera,
                    filePath: cameraData.filePath
                })
            } else {
                console.warn('⚠️ 没有找到有效的相机动画轨迹')
            }
            
        } catch (error) {
            console.error('❌ 加载自定义相机轨迹失败:', error)
        }
    }

    /**
     * 切换相机模式
     * @param {boolean} useCustomCamera 是否使用自定义相机轨迹
     */
    toggleCameraMode(useCustomCamera = null) {
        if (!this.cameraMapper) {
            console.warn('⚠️ 相机映射器未初始化')
            return
        }

        const status = this.cameraMapper.getStatus()
        
        if (useCustomCamera === null) {
            // 自动切换
            useCustomCamera = !status.isUsingCustomCamera
        }

        if (useCustomCamera && status.hasCustomTracks) {
            // 使用自定义相机轨迹
            this.cameraMapper.applyCustomCameraTracks()
            console.log('🎥 切换到自定义相机轨迹')
        } else {
            // 恢复原始相机状态
            this.cameraMapper.restoreOriginalCamera()
            console.log('🔄 切换到电影级相机系统')
        }
    }

    /**
     * 切换动画模式
     * @param {boolean} useCustomTracks 是否使用自定义轨迹
     */
    toggleAnimationMode(useCustomTracks = null) {
        if (!this.ringMapper) {
            console.warn('⚠️ 圆环映射器未初始化')
            return
        }

        if (useCustomTracks === null) {
            // 自动切换
            const status = this.ringMapper.getStatus()
            useCustomTracks = !status.isUsingCustomTracks
        }

        if (useCustomTracks) {
            // 使用自定义轨迹（已在loadCustomAnimationTracks中应用）
            console.log('🎭 切换到自定义动画轨迹')
        } else {
            // 恢复原始轨迹
            this.ringMapper.restoreOriginalAnimation()
            console.log('🔄 切换到原始动画轨迹')
        }
    }

    /**
     * 动态更新雾效设置
     * 根据相机模式和距离调整雾效，确保圆环始终可见
     */
    updateDynamicFog() {
        if (!this.cameraMapper || !this.scene.fog) return

        const cameraStatus = this.cameraMapper.getStatus()
        
        if (cameraStatus.isUsingCustomCamera) {
            // 使用自定义相机轨迹时，根据相机距离动态调整雾效
            const cameraDistance = this.camera.position.length()
            
            // 动态计算雾效参数，确保在最远距离时圆环仍然可见
            const baseFogNear = 10
            const baseFogFar = 100
            
            // 根据相机距离扩展雾效范围
            const distanceMultiplier = Math.max(1.0, cameraDistance / 50.0)
            const newFogNear = baseFogNear * distanceMultiplier
            const newFogFar = baseFogFar * distanceMultiplier * 2 // 远平面扩展更多
            
            this.scene.fog.near = newFogNear
            this.scene.fog.far = newFogFar
            
            // 同时更新粒子系统中的雾效参数
            if (this.particleSystem && this.particleSystem.particleMaterial && this.particleSystem.particleMaterial.uniforms) {
                if (this.particleSystem.particleMaterial.uniforms.uFogNear) {
                    this.particleSystem.particleMaterial.uniforms.uFogNear.value = newFogNear
                }
                if (this.particleSystem.particleMaterial.uniforms.uFogFar) {
                    this.particleSystem.particleMaterial.uniforms.uFogFar.value = newFogFar
                }
            }
            
            // 调试信息 - 每秒输出一次
            if (!this.lastFogDebugTime || Date.now() - this.lastFogDebugTime > 1000) {
                console.log(`🌫️ 动态雾效: 相机距离=${cameraDistance.toFixed(1)}, 雾效范围=[${newFogNear.toFixed(1)}, ${newFogFar.toFixed(1)}]`)
                this.lastFogDebugTime = Date.now()
            }
            
        } else {
            // 恢复到默认雾效设置
            this.scene.fog.near = 10
            this.scene.fog.far = 100
            
            if (this.particleSystem && this.particleSystem.particleMaterial && this.particleSystem.particleMaterial.uniforms) {
                if (this.particleSystem.particleMaterial.uniforms.uFogNear) {
                    this.particleSystem.particleMaterial.uniforms.uFogNear.value = 10.0
                }
                if (this.particleSystem.particleMaterial.uniforms.uFogFar) {
                    this.particleSystem.particleMaterial.uniforms.uFogFar.value = 100.0
                }
            }
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
        
        // Mouse interaction for particle effects
        window.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
            
            // Calculate mouse influence in world space
            const raycaster = new THREE.Raycaster()
            raycaster.setFromCamera(this.mouse, this.camera)
            
            // Project mouse to a plane in 3D space
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
            const intersection = new THREE.Vector3()
            raycaster.ray.intersectPlane(plane, intersection)
            
            this.mouseInfluence.copy(intersection)
            this.mouseStrength = 1.0
        })
        
        window.addEventListener('mouseleave', () => {
            this.mouseStrength = 0.0
        })

        // Keyboard shortcuts for animation and camera control
        window.addEventListener('keydown', (event) => {
            switch(event.key.toLowerCase()) {
                case 'space':
                    event.preventDefault()
                    this.toggleAnimationMode()
                    break
                case 'c':
                    event.preventDefault()
                    this.toggleCameraMode()
                    break
                case '1':
                    console.log('🎯 显示当前状态')
                    if (this.ringMapper) {
                        console.log('圆环映射器状态:', this.ringMapper.getStatus())
                    }
                    if (this.cameraMapper) {
                        console.log('相机映射器状态:', this.cameraMapper.getStatus())
                    }
                    if (this.trackExtractor) {
                        console.log('轨迹提取器摘要:', this.trackExtractor.getExtractionSummary())
                    }
                    break
                case '2':
                    this.toggleAnimationMode(true) // 强制使用自定义圆环轨迹
                    break
                case '3':
                    this.toggleAnimationMode(false) // 强制使用原始圆环轨迹
                    break
                case '4':
                    this.toggleCameraMode(true) // 强制使用自定义相机轨迹
                    break
                case '5':
                    this.toggleCameraMode(false) // 强制使用电影级相机
                    break
                case 'arrowright':
                    // 加速动画
                    if (this.cameraMapper) {
                        const currentSpeed = this.cameraMapper.getStatus().animationSpeed
                        this.cameraMapper.setAnimationSpeed(currentSpeed + 0.2)
                    }
                    break
                case 'arrowleft':
                    // 减速动画
                    if (this.cameraMapper) {
                        const currentSpeed = this.cameraMapper.getStatus().animationSpeed
                        this.cameraMapper.setAnimationSpeed(currentSpeed - 0.2)
                    }
                    break
                case 'p':
                    // 暂停/恢复相机动画
                    if (this.cameraMapper) {
                        this.cameraMapper.togglePause()
                    }
                    break
            }
        })
    }
    
    /**
     * 主渲柕循环 - 整个应用程序的心脏
     * 
     * 执行流程：
     * 1. 调度下一帧渲柕（使用requestAnimationFrame）
     * 2. 计算并平滑化时间间隔（deltaTime）
     * 3. 更新电影级相机系统
     * 4. 处理鼠标交互效果的衰减
     * 5. 更新粒子系统状态
     * 6. 执行最终渲柕输出
     * 
     * 性能优化特性：
     * - 使用requestAnimationFrame实现与屏幕刷新率同步
     * - 帧率下限限制，防止低帧率时的动画突跃
     * - 时间平滑算法，消除帧率波动导致的动画抖动
     * - 先更新后渲柕，确保逻辑一致性
     * 
     * 渲柕策略：
     * - 单次渲柕调用，避免重复渲柕
     * - 自动清理深度缓冲和颜色缓冲
     */
    animate() {
        // === 帧率控制系统 ===
        // 使用浏览器原生的requestAnimationFrame实现最优帧率
        // 自动与显示器刷新率同步，通常为60Hz或120Hz
        requestAnimationFrame(() => this.animate())

        // === 时间管理系统 ===
        // 获取上一帧的时间间隔，作为动画更新的基础
        let deltaTime = this.clock.getDelta()

        // 设置帧率下限为20fps，防止低帧率时动画出现大幅跳跃
        // 即使实际帧率更低，也会将deltaTime限制在1/20秒
        deltaTime = Math.min(deltaTime, 1/20)

        // 应用时间平滑算法，减少帧率波动导致的抖动
        // 使用指数移动平均：90%新值 + 10%旧值
        if (!this.lastDeltaTime) this.lastDeltaTime = deltaTime
        deltaTime = this.lastDeltaTime * 0.1 + deltaTime * 0.9
        this.lastDeltaTime = deltaTime

        // === 系统更新阶段 ===
        
        // 更新电影级相机系统（仅在未使用自定义相机时）
        const cameraStatus = this.cameraMapper ? this.cameraMapper.getStatus() : { isUsingCustomCamera: false }
        if (!cameraStatus.isUsingCustomCamera) {
            this.updateCinematicCamera(deltaTime)
        }

        // 处理鼠标交互效果的自然衰减
        // 使用0.95的衰减系数，实现平滑的交互效果消退
        this.mouseStrength *= 0.95
        
        // 更新自定义圆环动画轨迹
        if (this.ringMapper) {
            this.ringMapper.updateCustomAnimation(deltaTime)
        }

        // 更新自定义相机动画轨迹
        if (this.cameraMapper) {
            this.cameraMapper.updateCustomCamera(deltaTime)
            
            // 动态调整雾效以确保圆环在相机轨迹中始终可见
            this.updateDynamicFog()
        }
        
        // 更新粒子系统：先传递鼠标交互参数，再执行系统更新
        if (this.particleSystem) {
            // 更新鼠标交互参数，包括3D位置和影响强度
            this.particleSystem.updateMouseInteraction(this.mouseInfluence, this.mouseStrength)
            
            // 执行粒子系统的主更新逻辑（动画、效果、材质等）
            this.particleSystem.update(deltaTime)
        }

        // === 渲柕输出阶段 ===
        // 执行最终渲柕，将所有更新后的内容输出到屏幕
        // 参数：场景对象和相机对象
        this.renderer.render(this.scene, this.camera)
    }
}

// Initialize the app
new HeroParticleApp()