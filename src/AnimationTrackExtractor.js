import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

/**
 * 动画轨迹提取器 - 从GLB文件中提取圆环运动数据
 * 
 * 功能：
 * 1. 加载多个GLB动画文件
 * 2. 提取圆环的位置、旋转、缩放轨迹
 * 3. 转换为可应用的动画数据格式
 * 4. 支持实时轨迹替换
 */
export class AnimationTrackExtractor {
    constructor() {
        this.setupLoader()
        this.extractedTracks = new Map() // 存储提取的轨迹数据
        this.ringMappings = new Map()    // 圆环名称映射
        
        // 定义圆环标识符映射
        this.ringIdentifiers = {
            'Scenes_B_00100': 'mainRing',      // 主环
            'Scenes_B_0023': 'middleRing',     // 中环  
            'Scenes_B_00100001': 'smallRing'   // 小环
        }
    }

    setupLoader() {
        const dracoLoader = new DRACOLoader()
        dracoLoader.setDecoderPath('/draco/')
        
        this.loader = new GLTFLoader()
        this.loader.setDRACOLoader(dracoLoader)
    }

    /**
     * 从GLB文件提取动画轨迹
     * @param {string} filePath GLB文件路径
     * @param {string} ringType 圆环类型标识
     * @returns {Promise<Object>} 提取的轨迹数据
     */
    async extractTracksFromFile(filePath, ringType) {
        try {
            console.log(`🔄 正在提取 ${ringType} 的动画轨迹: ${filePath}`)
            
            const gltf = await new Promise((resolve, reject) => {
                this.loader.load(filePath, resolve, undefined, reject)
            })

            const trackData = {
                ringType,
                filePath,
                hasAnimations: gltf.animations && gltf.animations.length > 0,
                animations: [],
                staticTransform: null
            }

            // 提取静态变换信息（作为初始位置）
            gltf.scene.traverse((child) => {
                if (this.isRingObject(child.name)) {
                    trackData.staticTransform = {
                        position: child.position.clone(),
                        rotation: child.rotation.clone(),
                        quaternion: child.quaternion.clone(),
                        scale: child.scale.clone(),
                        name: child.name
                    }
                }
            })

            // 提取动画轨迹
            if (gltf.animations && gltf.animations.length > 0) {
                gltf.animations.forEach((animation) => {
                    const animData = this.processAnimation(animation, ringType)
                    if (animData) {
                        trackData.animations.push(animData)
                    }
                })
            }

            // 存储提取的数据
            this.extractedTracks.set(ringType, trackData)
            
            console.log(`✅ ${ringType} 轨迹提取完成:`, {
                animations: trackData.animations.length,
                hasStatic: !!trackData.staticTransform
            })

            return trackData

        } catch (error) {
            console.error(`❌ 提取 ${ringType} 轨迹失败:`, error)
            return null
        }
    }

    /**
     * 处理单个动画，提取关键帧数据
     */
    processAnimation(animation, ringType) {
        const animData = {
            name: animation.name,
            duration: animation.duration,
            tracks: {
                position: null,
                rotation: null,
                quaternion: null,
                scale: null
            }
        }

        animation.tracks.forEach(track => {
            const trackInfo = this.parseTrackName(track.name)
            if (!trackInfo || !this.isRingTrack(trackInfo.objectName)) {
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
            }
        })

        // 只返回包含有效轨迹的动画
        const hasValidTracks = Object.values(animData.tracks).some(track => track !== null)
        return hasValidTracks ? animData : null
    }

    /**
     * 解析轨迹名称，提取对象名和属性
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
     * 判断是否为圆环对象
     */
    isRingObject(name) {
        return Object.keys(this.ringIdentifiers).some(identifier => 
            name.includes(identifier)
        )
    }

    /**
     * 判断是否为圆环相关的轨迹
     */
    isRingTrack(objectName) {
        return this.isRingObject(objectName)
    }

    /**
     * 批量提取所有圆环动画轨迹
     */
    async extractAllRingTracks() {
        const extractionTasks = [
            {
                filePath: '/Scenes_B_00100-transformed.glb',
                ringType: 'mainRing'
            },
            {
                filePath: '/Scenes_B_0023-transformed.glb', 
                ringType: 'middleRing'
            },
            {
                filePath: '/Scenes_B_00100.001-transformed.glb',
                ringType: 'smallRing'
            }
        ]

        console.log('🚀 开始批量提取圆环动画轨迹...')
        
        const results = []
        for (const task of extractionTasks) {
            const result = await this.extractTracksFromFile(task.filePath, task.ringType)
            if (result) {
                results.push(result)
            }
        }

        console.log(`✅ 动画轨迹提取完成，成功提取 ${results.length} 个圆环的轨迹数据`)
        return results
    }

    /**
     * 获取指定圆环的轨迹数据
     */
    getRingTracks(ringType) {
        return this.extractedTracks.get(ringType)
    }

    /**
     * 获取所有提取的轨迹数据
     */
    getAllTracks() {
        return Array.from(this.extractedTracks.values())
    }

    /**
     * 将轨迹数据转换为Three.js AnimationClip格式
     */
    createAnimationClip(ringType, animationIndex = 0) {
        const trackData = this.extractedTracks.get(ringType)
        if (!trackData || !trackData.animations[animationIndex]) {
            return null
        }

        const animation = trackData.animations[animationIndex]
        const tracks = []

        // 转换每个轨迹为Three.js KeyframeTrack
        Object.entries(animation.tracks).forEach(([property, trackInfo]) => {
            if (!trackInfo) return

            let TrackClass
            switch (property) {
                case 'position':
                    TrackClass = THREE.VectorKeyframeTrack
                    break
                case 'quaternion':
                    TrackClass = THREE.QuaternionKeyframeTrack
                    break
                case 'rotation':
                    TrackClass = THREE.VectorKeyframeTrack
                    break
                case 'scale':
                    TrackClass = THREE.VectorKeyframeTrack
                    break
                default:
                    return
            }

            // 创建目标名称（适配现有粒子系统）
            const targetName = `${ringType}.${property}`
            
            const track = new TrackClass(
                targetName,
                trackInfo.times,
                trackInfo.values
            )

            tracks.push(track)
        })

        if (tracks.length === 0) return null

        return new THREE.AnimationClip(
            `${ringType}_${animation.name}`,
            animation.duration,
            tracks
        )
    }

    /**
     * 创建所有圆环的动画剪辑
     */
    createAllAnimationClips() {
        const clips = []
        
        this.extractedTracks.forEach((trackData, ringType) => {
            trackData.animations.forEach((_, index) => {
                const clip = this.createAnimationClip(ringType, index)
                if (clip) {
                    clips.push(clip)
                }
            })
        })

        return clips
    }

    /**
     * 获取提取状态摘要
     */
    getExtractionSummary() {
        const summary = {
            totalRings: this.extractedTracks.size,
            rings: {}
        }

        this.extractedTracks.forEach((trackData, ringType) => {
            summary.rings[ringType] = {
                hasAnimations: trackData.hasAnimations,
                animationCount: trackData.animations.length,
                hasStaticTransform: !!trackData.staticTransform,
                filePath: trackData.filePath
            }
        })

        return summary
    }
}