// 模型切换工具 - 可以安全地在不同模型之间切换

export class ModelSwitcher {
    constructor() {
        this.models = {
            original: '/v5-transformed.glb',           // 原始模型
            newOriginal: '/LOST_cut2_v5-transformed.glb', // 新原始模型（未优化）
            optimized: '/v5-optimized.glb'            // 优化后的模型
        }
        
        this.currentModel = 'original'
    }
    
    // 获取当前应该使用的模型路径
    getCurrentModelPath() {
        return this.models[this.currentModel]
    }
    
    // 切换到优化后的新模型
    switchToOptimized() {
        console.log('🔄 切换到优化后的新模型...')
        this.currentModel = 'optimized'
        return this.getCurrentModelPath()
    }
    
    // 切换回原始模型
    switchToOriginal() {
        console.log('🔄 回退到原始模型...')
        this.currentModel = 'original'
        return this.getCurrentModelPath()
    }
    
    // 获取模型信息
    getModelInfo() {
        return {
            current: this.currentModel,
            path: this.getCurrentModelPath(),
            available: Object.keys(this.models)
        }
    }
}

// 在main.js中使用示例：
/*
import { ModelSwitcher } from './model-switcher.js'

const modelSwitcher = new ModelSwitcher()

// 在loadModel()中：
const modelPath = modelSwitcher.getCurrentModelPath()
const gltf = await new Promise((resolve, reject) => {
    loader.load(modelPath, resolve, undefined, reject)
})
*/