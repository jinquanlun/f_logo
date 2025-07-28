import * as THREE from 'three'

export class SkinnedModelProcessor {
    processSkinnedMesh(skinnedMesh) {
        const geometry = skinnedMesh.geometry
        const skeleton = skinnedMesh.skeleton

        // Extract vertex data
        const positions = geometry.attributes.position.array
        const skinIndices = geometry.attributes.skinIndex ? geometry.attributes.skinIndex.array : null
        const skinWeights = geometry.attributes.skinWeight ? geometry.attributes.skinWeight.array : null

        const particleCount = positions.length / 3

        // Calculate texture dimensions
        const textureWidth = Math.ceil(Math.sqrt(particleCount))
        const textureHeight = Math.ceil(particleCount / textureWidth)
        
        // Create base position texture (T-pose positions)
        const basePositionTexture = this.createPositionTexture(positions, textureWidth, textureHeight, particleCount)
        
        // Create skin data textures if available
        let skinIndexTexture = null
        let skinWeightTexture = null
        
        if (skinIndices && skinWeights) {
            skinIndexTexture = this.createSkinIndexTexture(skinIndices, textureWidth, textureHeight, particleCount)
            skinWeightTexture = this.createSkinWeightTexture(skinWeights, textureWidth, textureHeight, particleCount)
        }
        

        
        return {
            particleCount,
            textureWidth,
            textureHeight,
            basePositionTexture,
            skinIndexTexture,
            skinWeightTexture,
            skeleton,
            bindMatrix: skinnedMesh.bindMatrix,
            bindMatrixInverse: skinnedMesh.bindMatrixInverse
        }
    }
    
    createPositionTexture(positions, width, height, particleCount) {
        
        const data = new Float32Array(width * height * 4)
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3  // position array index
            const i4 = i * 4  // texture array index
            
            data[i4] = positions[i3]         // x
            data[i4 + 1] = positions[i3 + 1] // y  
            data[i4 + 2] = positions[i3 + 2] // z
            data[i4 + 3] = 1.0               // w
        }
        
        // Fill remaining texels with zeros
        for (let i = particleCount; i < width * height; i++) {
            const i4 = i * 4
            data[i4] = 0.0
            data[i4 + 1] = 0.0
            data[i4 + 2] = 0.0
            data[i4 + 3] = 0.0
        }
        
        const texture = new THREE.DataTexture(
            data,
            width,
            height,
            THREE.RGBAFormat,
            THREE.FloatType
        )
        texture.needsUpdate = true
        
        return texture
    }
    
    createSkinIndexTexture(skinIndices, width, height, particleCount) {
        
        const data = new Float32Array(width * height * 4)
        
        for (let i = 0; i < particleCount; i++) {
            const i4vertex = i * 4  // vertex index in skin array
            const i4texture = i * 4 // texture index
            
            data[i4texture] = skinIndices[i4vertex]         // bone index 0
            data[i4texture + 1] = skinIndices[i4vertex + 1] // bone index 1
            data[i4texture + 2] = skinIndices[i4vertex + 2] // bone index 2
            data[i4texture + 3] = skinIndices[i4vertex + 3] // bone index 3
        }
        
        const texture = new THREE.DataTexture(
            data,
            width,
            height,
            THREE.RGBAFormat,
            THREE.FloatType
        )
        texture.needsUpdate = true
        
        return texture
    }
    
    createSkinWeightTexture(skinWeights, width, height, particleCount) {
        
        const data = new Float32Array(width * height * 4)
        
        for (let i = 0; i < particleCount; i++) {
            const i4vertex = i * 4  // vertex index in skin array
            const i4texture = i * 4 // texture index
            
            data[i4texture] = skinWeights[i4vertex]         // weight 0
            data[i4texture + 1] = skinWeights[i4vertex + 1] // weight 1
            data[i4texture + 2] = skinWeights[i4vertex + 2] // weight 2
            data[i4texture + 3] = skinWeights[i4vertex + 3] // weight 3
        }
        
        const texture = new THREE.DataTexture(
            data,
            width,
            height,
            THREE.RGBAFormat,
            THREE.FloatType
        )
        texture.needsUpdate = true
        
        return texture
    }
    
    createBoneTexture(skeleton) {
        if (!skeleton) return null
        

        
        const bones = skeleton.bones
        const boneCount = bones.length
        
        // Each bone matrix is 4x4, we store it in 4 texels (each texel = vec4)
        const textureWidth = 4
        const textureHeight = boneCount
        const data = new Float32Array(textureWidth * textureHeight * 4)
        
        // This will be updated each frame with current bone transforms
        for (let i = 0; i < boneCount; i++) {
            const bone = bones[i]
            const matrix = bone.matrixWorld
            
            const offset = i * 16 // 4x4 matrix = 16 elements
            
            // Copy matrix elements to texture data
            for (let j = 0; j < 16; j++) {
                data[offset + j] = matrix.elements[j]
            }
        }
        
        const texture = new THREE.DataTexture(
            data,
            textureWidth,
            textureHeight,
            THREE.RGBAFormat,
            THREE.FloatType
        )
        texture.needsUpdate = true
        
        return texture
    }
}