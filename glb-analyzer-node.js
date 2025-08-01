import * as fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GLBAnalyzer {
    constructor() {
        this.analysisResults = [];
    }

    async analyzeFile(filePath, fileName) {
        console.log(`\n🔍 Analyzing: ${fileName}`);
        console.log('='.repeat(60));
        
        try {
            const buffer = fs.readFileSync(filePath);
            const analysis = this.parseGLB(buffer, fileName);
            this.analysisResults.push(analysis);
            this.printAnalysis(analysis);
            return analysis;
        } catch (error) {
            console.error(`❌ Error analyzing ${fileName}:`, error.message);
            return null;
        }
    }

    parseGLB(buffer, fileName) {
        const analysis = {
            fileName,
            fileSize: this.formatBytes(buffer.length),
            animations: [],
            meshes: [],
            materials: [],
            bones: [],
            cameras: [],
            scenes: [],
            totalDuration: 0,
            maxDuration: 0,
            minDuration: Infinity
        };

        try {
            // GLB structure parsing
            const header = this.parseGLBHeader(buffer);
            if (!header.isValid) {
                throw new Error('Invalid GLB file format');
            }

            const jsonChunk = this.parseJSONChunk(buffer, header);
            const gltf = JSON.parse(jsonChunk);

            // Analyze animations
            if (gltf.animations && gltf.animations.length > 0) {
                gltf.animations.forEach((animation, index) => {
                    const animData = this.analyzeAnimation(animation, index, gltf);
                    analysis.animations.push(animData);
                    analysis.totalDuration += animData.duration;
                    analysis.maxDuration = Math.max(analysis.maxDuration, animData.duration);
                    analysis.minDuration = Math.min(analysis.minDuration, animData.duration);
                });
            } else {
                analysis.minDuration = 0;
            }

            // Analyze other GLTF components
            this.analyzeGLTFComponents(gltf, analysis);

        } catch (parseError) {
            console.warn(`⚠️  Could not parse GLB structure: ${parseError.message}`);
            analysis.parseError = parseError.message;
        }

        return analysis;
    }

    parseGLBHeader(buffer) {
        const header = {
            isValid: false,
            version: 0,
            length: 0
        };

        if (buffer.length < 12) return header;

        const magic = buffer.readUInt32LE(0);
        const version = buffer.readUInt32LE(4);  
        const length = buffer.readUInt32LE(8);

        // GLB magic number is 0x46546C67 ("glTF")
        if (magic === 0x46546C67 && version === 2) {
            header.isValid = true;
            header.version = version;
            header.length = length;
        }

        return header;
    }

    parseJSONChunk(buffer, header) {
        let offset = 12; // Skip GLB header

        // Read first chunk (should be JSON)
        const chunkLength = buffer.readUInt32LE(offset);
        const chunkType = buffer.readUInt32LE(offset + 4);
        
        // JSON chunk type is 0x4E4F534A ("JSON")
        if (chunkType !== 0x4E4F534A) {
            throw new Error('First chunk is not JSON');
        }

        const jsonStart = offset + 8;
        const jsonEnd = jsonStart + chunkLength;
        const jsonBuffer = buffer.slice(jsonStart, jsonEnd);
        
        return jsonBuffer.toString('utf8');
    }

    analyzeAnimation(animation, index, gltf) {
        const animData = {
            index,
            name: animation.name || `Animation_${index}`,
            duration: 0,
            channels: animation.channels?.length || 0,
            samplers: animation.samplers?.length || 0,
            tracks: [],
            trackTypes: new Set(),
            targetObjects: new Set(),
            keyframeCounts: {}
        };

        // Analyze samplers to get timing information
        if (animation.samplers) {
            animation.samplers.forEach((sampler, samplerIndex) => {
                const inputAccessor = gltf.accessors[sampler.input];
                const outputAccessor = gltf.accessors[sampler.output];
                
                if (inputAccessor && outputAccessor) {
                    // Input accessor contains timing data
                    const duration = this.getAccessorMaxValue(inputAccessor, gltf);
                    animData.duration = Math.max(animData.duration, duration);
                    
                    animData.tracks.push({
                        samplerIndex,
                        interpolation: sampler.interpolation || 'LINEAR',
                        inputCount: inputAccessor.count,
                        outputCount: outputAccessor.count,
                        duration
                    });
                }
            });
        }

        // Analyze channels for target information
        if (animation.channels) {
            animation.channels.forEach(channel => {
                if (channel.target) {
                    const targetNode = gltf.nodes?.[channel.target.node];
                    const targetName = targetNode?.name || `Node_${channel.target.node}`;
                    const path = channel.target.path;
                    
                    animData.targetObjects.add(targetName);
                    animData.trackTypes.add(path);
                    
                    if (!animData.keyframeCounts[path]) {
                        animData.keyframeCounts[path] = 0;
                    }
                    
                    // Get keyframe count from sampler
                    const sampler = animation.samplers?.[channel.sampler];
                    if (sampler) {
                        const inputAccessor = gltf.accessors[sampler.input];
                        if (inputAccessor) {
                            animData.keyframeCounts[path] += inputAccessor.count;
                        }
                    }
                }
            });
        }

        animData.trackTypes = Array.from(animData.trackTypes);
        animData.targetObjects = Array.from(animData.targetObjects);

        return animData;
    }

    getAccessorMaxValue(accessor, gltf) {
        // For timing data, we typically want the max value
        // This is a simplified approach - in a full implementation,
        // you'd read the actual buffer data
        if (accessor.max && accessor.max.length > 0) {
            return accessor.max[0];
        }
        
        // Fallback estimation based on count
        return accessor.count * 0.033; // Assume ~30fps keyframes
    }

    analyzeGLTFComponents(gltf, analysis) {
        // Analyze meshes
        if (gltf.meshes) {
            gltf.meshes.forEach((mesh, index) => {
                const meshData = {
                    name: mesh.name || `Mesh_${index}`,
                    primitives: mesh.primitives?.length || 0,
                    hasJoints: false,
                    hasWeights: false
                };

                if (mesh.primitives) {
                    mesh.primitives.forEach(primitive => {
                        if (primitive.attributes) {
                            if (primitive.attributes.JOINTS_0) meshData.hasJoints = true;
                            if (primitive.attributes.WEIGHTS_0) meshData.hasWeights = true;
                        }
                    });
                }

                analysis.meshes.push(meshData);
            });
        }

        // Analyze materials
        if (gltf.materials) {
            gltf.materials.forEach((material, index) => {
                analysis.materials.push({
                    name: material.name || `Material_${index}`,
                    alphaMode: material.alphaMode || 'OPAQUE',
                    doubleSided: material.doubleSided || false
                });
            });
        }

        // Analyze nodes for bones/cameras
        if (gltf.nodes) {
            gltf.nodes.forEach((node, index) => {
                const nodeData = {
                    name: node.name || `Node_${index}`,
                    hasTransform: !!(node.translation || node.rotation || node.scale || node.matrix),
                    childCount: node.children?.length || 0
                };

                // Check if it's a bone (part of a skin)
                const isBone = gltf.skins?.some(skin => 
                    skin.joints?.includes(index)
                );

                if (isBone) {
                    analysis.bones.push(nodeData);
                }

                // Check if it has a camera
                if (node.camera !== undefined) {
                    const camera = gltf.cameras?.[node.camera];
                    analysis.cameras.push({
                        ...nodeData,
                        type: camera?.type || 'unknown',
                        perspective: camera?.perspective,
                        orthographic: camera?.orthographic
                    });
                }
            });
        }

        // Analyze scenes
        if (gltf.scenes) {
            gltf.scenes.forEach((scene, index) => {
                analysis.scenes.push({
                    name: scene.name || `Scene_${index}`,
                    nodeCount: scene.nodes?.length || 0
                });
            });
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    printAnalysis(analysis) {
        console.log(`📁 File: ${analysis.fileName}`);
        console.log(`📏 Size: ${analysis.fileSize}`);
        console.log(`🎬 Animations: ${analysis.animations.length}`);
        
        if (analysis.animations.length > 0) {
            console.log(`⏱️  Duration Range: ${analysis.minDuration.toFixed(3)}s - ${analysis.maxDuration.toFixed(3)}s`);
            console.log(`📊 Total Duration: ${analysis.totalDuration.toFixed(3)}s`);
            
            console.log('\n🎭 Animation Details:');
            analysis.animations.forEach((anim, i) => {
                console.log(`  ${i + 1}. "${anim.name}"`);
                console.log(`     Duration: ${anim.duration.toFixed(3)}s`);
                console.log(`     Channels: ${anim.channels}`);
                console.log(`     Samplers: ${anim.samplers}`);
                console.log(`     Track Types: ${anim.trackTypes.join(', ')}`);
                console.log(`     Target Objects: ${anim.targetObjects.join(', ')}`);
                console.log(`     Keyframe Counts:`, anim.keyframeCounts);
                console.log('');
            });
        }

        console.log(`🎯 Meshes: ${analysis.meshes.length}`);
        if (analysis.meshes.length > 0) {
            analysis.meshes.forEach(mesh => {
                const skinned = mesh.hasJoints && mesh.hasWeights ? ' [SKINNED]' : '';
                console.log(`  • ${mesh.name} (${mesh.primitives} primitives)${skinned}`);
            });
        }

        console.log(`🦴 Bones: ${analysis.bones.length}`);
        console.log(`📷 Cameras: ${analysis.cameras.length}`);
        console.log(`🎨 Materials: ${analysis.materials.length}`);
        console.log(`🎭 Scenes: ${analysis.scenes.length}`);
        
        if (analysis.parseError) {
            console.log(`⚠️  Parse Issues: ${analysis.parseError}`);
        }
        
        console.log('-'.repeat(60));
    }

    generateDetailedComparison() {
        console.log('\n🔍 DETAILED BINARY COMPARISON');
        console.log('='.repeat(80));
        
        const [original, newFile] = this.analysisResults;
        if (!original || !newFile) return;

        // File size comparison
        const originalSizeKB = this.parseFileSize(original.fileSize);
        const newSizeKB = this.parseFileSize(newFile.fileSize);
        const sizeDiff = newSizeKB - originalSizeKB;
        const sizePercent = ((sizeDiff / originalSizeKB) * 100).toFixed(1);

        console.log('\n📏 FILE SIZE ANALYSIS:');
        console.log(`   Original: ${original.fileSize}`);
        console.log(`   New:      ${newFile.fileSize}`);
        console.log(`   Change:   ${sizeDiff > 0 ? '+' : ''}${(sizeDiff/1024).toFixed(2)} MB (${sizePercent > 0 ? '+' : ''}${sizePercent}%)`);

        // Component count comparison
        console.log('\n🎯 COMPONENT COUNT COMPARISON:');
        console.log(`   Meshes:     ${original.meshes.length} → ${newFile.meshes.length} (${newFile.meshes.length - original.meshes.length >= 0 ? '+' : ''}${newFile.meshes.length - original.meshes.length})`);
        console.log(`   Materials:  ${original.materials.length} → ${newFile.materials.length} (${newFile.materials.length - original.materials.length >= 0 ? '+' : ''}${newFile.materials.length - original.materials.length})`);
        console.log(`   Bones:      ${original.bones.length} → ${newFile.bones.length} (${newFile.bones.length - original.bones.length >= 0 ? '+' : ''}${newFile.bones.length - original.bones.length})`);
        console.log(`   Cameras:    ${original.cameras.length} → ${newFile.cameras.length} (${newFile.cameras.length - original.cameras.length >= 0 ? '+' : ''}${newFile.cameras.length - original.cameras.length})`);
        console.log(`   Scenes:     ${original.scenes.length} → ${newFile.scenes.length} (${newFile.scenes.length - original.scenes.length >= 0 ? '+' : ''}${newFile.scenes.length - original.scenes.length})`);
        console.log(`   Animations: ${original.animations.length} → ${newFile.animations.length} (${newFile.animations.length - original.animations.length >= 0 ? '+' : ''}${newFile.animations.length - original.animations.length})`);

        // Animation compatibility analysis
        console.log('\n🎬 ANIMATION COMPATIBILITY ANALYSIS:');
        const originalAnimNames = original.animations.map(a => a.name);
        const newAnimNames = newFile.animations.map(a => a.name);
        
        const commonAnims = originalAnimNames.filter(name => newAnimNames.includes(name));
        const removedAnims = originalAnimNames.filter(name => !newAnimNames.includes(name));
        const addedAnims = newAnimNames.filter(name => !originalAnimNames.includes(name));

        console.log(`   Common animations: ${commonAnims.length}`);
        if (commonAnims.length > 0) {
            commonAnims.forEach(name => console.log(`     ✅ ${name}`));
        }

        if (removedAnims.length > 0) {
            console.log(`   Removed animations: ${removedAnims.length}`);
            removedAnims.forEach(name => console.log(`     ❌ ${name}`));
        }

        if (addedAnims.length > 0) {
            console.log(`   Added animations: ${addedAnims.length}`);
            addedAnims.forEach(name => console.log(`     ➕ ${name}`));
        }

        // Particle system compatibility check
        console.log('\n⚡ PARTICLE SYSTEM COMPATIBILITY:');
        const originalSkinned = original.meshes.filter(m => m.hasJoints && m.hasWeights).length;
        const newSkinned = newFile.meshes.filter(m => m.hasJoints && m.hasWeights).length;
        
        console.log(`   Skinned meshes: ${originalSkinned} → ${newSkinned}`);
        
        if (newSkinned > 0) {
            console.log('   ✅ Has skinned meshes - Compatible with SkinnedModelProcessor');
        } else {
            console.log('   ⚠️  No skinned meshes found - May need fallback processing');
        }

        // Required animation check for current system
        console.log('\n🔧 CURRENT SYSTEM REQUIREMENTS CHECK:');
        const requiredAnimations = [
            'Scenes_B_00100Action',
            'Scenes_B_0023动作', 
            'Scenes_B_00100.001Action',
            'vipAction.001'
        ];

        requiredAnimations.forEach(reqAnim => {
            const hasExact = newAnimNames.includes(reqAnim);
            const hasPartial = newAnimNames.some(name => name.includes(reqAnim.replace('Action', '').replace('动作', '')));
            
            if (hasExact) {
                console.log(`   ✅ ${reqAnim} - Found exact match`);
            } else if (hasPartial) {
                const match = newAnimNames.find(name => name.includes(reqAnim.replace('Action', '').replace('动作', '')));
                console.log(`   ⚠️  ${reqAnim} - Found similar: "${match}"`);
            } else {
                console.log(`   ❌ ${reqAnim} - Not found`);
            }
        });

        // Replacement recommendation
        console.log('\n💡 REPLACEMENT RECOMMENDATION:');
        const compatibilityScore = this.calculateCompatibilityScore(original, newFile, commonAnims, requiredAnimations, newAnimNames);
        
        if (compatibilityScore >= 80) {
            console.log('   🟢 HIGH COMPATIBILITY - Safe to replace with minimal code changes');
        } else if (compatibilityScore >= 60) {
            console.log('   🟡 MEDIUM COMPATIBILITY - Requires some code adjustments');
        } else {
            console.log('   🔴 LOW COMPATIBILITY - Significant changes required');
        }
        
        console.log(`   Compatibility Score: ${compatibilityScore}/100`);
    }

    parseFileSize(sizeString) {
        const parts = sizeString.split(' ');
        const value = parseFloat(parts[0]);
        const unit = parts[1];
        
        switch(unit) {
            case 'Bytes': return value / 1024;
            case 'KB': return value;
            case 'MB': return value * 1024;
            case 'GB': return value * 1024 * 1024;
            default: return value;
        }
    }

    calculateCompatibilityScore(original, newFile, commonAnims, requiredAnimations, newAnimNames) {
        let score = 0;
        
        // File size impact (20 points max)
        const originalSize = this.parseFileSize(original.fileSize);
        const newSize = this.parseFileSize(newFile.fileSize);
        const sizeIncrease = (newSize - originalSize) / originalSize;
        
        if (sizeIncrease < 0.1) score += 20;      // Size similar or smaller
        else if (sizeIncrease < 0.3) score += 15; // Small increase
        else if (sizeIncrease < 0.5) score += 10; // Moderate increase
        else score += 5;                          // Large increase

        // Animation compatibility (40 points max)
        const animCompatibility = requiredAnimations.reduce((acc, reqAnim) => {
            const hasExact = newAnimNames.includes(reqAnim);
            const hasPartial = newAnimNames.some(name => name.includes(reqAnim.replace('Action', '').replace('动作', '')));
            
            if (hasExact) return acc + 10;
            if (hasPartial) return acc + 7;
            return acc;
        }, 0);
        score += animCompatibility;

        // Mesh compatibility (20 points max)
        const originalSkinned = original.meshes.filter(m => m.hasJoints && m.hasWeights).length;
        const newSkinned = newFile.meshes.filter(m => m.hasJoints && m.hasWeights).length;
        
        if (newSkinned > 0) score += 20;    // Has skinned meshes
        else if (newFile.meshes.length > 0) score += 10; // Has meshes but not skinned

        // Structure compatibility (20 points max)
        const meshDiff = Math.abs(newFile.meshes.length - original.meshes.length);
        const boneDiff = Math.abs(newFile.bones.length - original.bones.length);
        
        if (meshDiff === 0 && boneDiff === 0) score += 20;      // Identical structure
        else if (meshDiff <= 2 && boneDiff <= 5) score += 15;   // Very similar
        else if (meshDiff <= 5 && boneDiff <= 10) score += 10;  // Somewhat similar
        else score += 5;                                        // Different structure

        return Math.min(100, score);
    }

    generateComparisonReport() {
        console.log('\n📊 COMPREHENSIVE COMPARISON ANALYSIS');
        console.log('='.repeat(80));

        if (this.analysisResults.length === 2) {
            this.generateDetailedComparison();
        }

        // Duration comparison table
        console.log('\n⏱️  DURATION COMPARISON TABLE:');
        console.log('-'.repeat(80));
        console.log('File Name'.padEnd(40) + 'Animations'.padEnd(12) + 'Max Duration'.padEnd(15) + 'Total Duration');
        console.log('-'.repeat(80));
        
        this.analysisResults.forEach(result => {
            if (result) {
                const maxDur = result.maxDuration === -Infinity ? 0 : result.maxDuration;
                console.log(
                    result.fileName.padEnd(40) + 
                    result.animations.length.toString().padEnd(12) + 
                    `${maxDur.toFixed(3)}s`.padEnd(15) + 
                    `${result.totalDuration.toFixed(3)}s`
                );
            }
        });

        // Animation name comparison
        console.log('\n🎬 ANIMATION NAMES COMPARISON:');
        console.log('-'.repeat(80));
        
        this.analysisResults.forEach(result => {
            if (result && result.animations.length > 0) {
                console.log(`\n${result.fileName}:`);
                result.animations.forEach(anim => {
                    console.log(`  • ${anim.name} (${anim.duration.toFixed(3)}s)`);
                });
            }
        });

        // File size comparison
        console.log('\n📏 FILE SIZE COMPARISON:');
        console.log('-'.repeat(80));
        this.analysisResults.forEach(result => {
            if (result) {
                console.log(`${result.fileName}: ${result.fileSize}`);
            }
        });

        // Synchronization analysis
        this.analyzeSynchronization();
        
        // Implementation recommendations
        this.generateRecommendations();
    }

    analyzeSynchronization() {
        console.log('\n🔄 SYNCHRONIZATION FEASIBILITY ANALYSIS:');
        console.log('-'.repeat(80));

        const animatedFiles = this.analysisResults.filter(r => r && r.animations.length > 0);
        
        if (animatedFiles.length === 0) {
            console.log('❌ No animated files found for synchronization analysis.');
            return;
        }

        // Check duration consistency
        const durations = animatedFiles.map(f => f.maxDuration);
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        const durationVariance = maxDuration - minDuration;
        
        console.log(`📏 Duration Range: ${minDuration.toFixed(3)}s - ${maxDuration.toFixed(3)}s`);
        console.log(`📊 Duration Variance: ${durationVariance.toFixed(3)}s`);
        
        if (durationVariance < 0.1) {
            console.log('✅ EXCELLENT: Animation durations are very consistent - perfect for synchronization');
        } else if (durationVariance < 0.5) {
            console.log('✅ GOOD: Animation durations are reasonably consistent - synchronization feasible');
        } else if (durationVariance < 1.0) {
            console.log('⚠️  MODERATE: Some duration differences exist - may need timeline adjustments');
        } else {
            console.log('❌ CHALLENGING: Significant duration differences - requires careful synchronization planning');
        }

        // Analyze keyframe timing patterns
        console.log('\n🎯 Keyframe Timing Analysis:');
        animatedFiles.forEach(file => {
            if (file.animations.length > 0) {
                const mainAnim = file.animations[0];
                console.log(`\n${file.fileName}:`);
                console.log(`  Animation: "${mainAnim.name}"`);
                console.log(`  Duration: ${mainAnim.duration.toFixed(3)}s`);
                console.log(`  Channels: ${mainAnim.channels}`);
                console.log(`  Samplers: ${mainAnim.samplers}`);
                
                // Calculate keyframe density
                const totalKeyframes = Object.values(mainAnim.keyframeCounts).reduce((sum, count) => sum + count, 0);
                const keyframeDensity = totalKeyframes / mainAnim.duration;
                console.log(`  Keyframe Density: ${keyframeDensity.toFixed(1)} keyframes/second`);
            }
        });
    }

    generateRecommendations() {
        console.log('\n💡 IMPLEMENTATION RECOMMENDATIONS:');
        console.log('-'.repeat(80));

        const animatedFiles = this.analysisResults.filter(r => r && r.animations.length > 0);
        const totalAnimations = animatedFiles.reduce((sum, f) => sum + f.animations.length, 0);
        
        console.log('\n🎯 Synchronization Strategy:');
        
        if (animatedFiles.length > 1) {
            console.log('1. ⏰ Time Synchronization:');
            console.log('   • Use a master timeline to control all animations simultaneously');
            console.log('   • Implement custom animation time control (customAnimationTime)');
            console.log('   • Normalize all animation durations to the longest one');
            
            console.log('\n2. 🔧 Technical Implementation:');
            console.log('   • Load all GLB files in parallel for performance');
            console.log('   • Create separate AnimationMixer for each file');
            console.log('   • Use AnimationAction.setDuration() to normalize timing');
            console.log('   • Implement centralized play/pause/seek controls');
            
            console.log('\n3. 🎮 Animation Control:');
            console.log('   • Create an AnimationManager class to coordinate all mixers');
            console.log('   • Use consistent time.timeScale for synchronized playback');
            console.log('   • Implement smooth transitions between animation states');
            
            // Check for specific patterns
            const hasCamera = animatedFiles.some(f => f.fileName.includes('cam'));
            const hasRings = animatedFiles.some(f => f.fileName.includes('Scenes_B'));
            
            if (hasCamera) {
                console.log('\n4. 📷 Camera Coordination:');
                console.log('   • Synchronize camera movements with object animations');
                console.log('   • Consider blending between camera animation and user controls');
                console.log('   • Implement smooth camera transitions');
            }
            
            if (hasRings) {
                console.log('\n5. 🎨 Ring Animation Coordination:');
                console.log('   • Coordinate multiple ring animations for cohesive motion');
                console.log('   • Consider phase offsets for more dynamic visuals');
                console.log('   • Synchronize particle effects with ring movements');
            }
            
        } else {
            console.log('• Single animation file detected - no synchronization needed');
            console.log('• Focus on smooth playback and particle system integration');
        }

        console.log('\n📝 Code Integration Points:');
        console.log('   • Update HeroParticleSystem.js to handle multiple GLB files');
        console.log('   • Modify animation time control in main.js');
        console.log('   • Consider creating separate managers for different animation types');
        
        console.log('\n⚡ Performance Considerations:');
        const totalMeshes = this.analysisResults.reduce((sum, r) => sum + (r?.meshes?.length || 0), 0);
        const totalBones = this.analysisResults.reduce((sum, r) => sum + (r?.bones?.length || 0), 0);
        
        console.log(`   • Total meshes across all files: ${totalMeshes}`);
        console.log(`   • Total bones across all files: ${totalBones}`);
        console.log('   • Monitor total polygon count across all files');
        console.log('   • Implement LOD (Level of Detail) if needed');
        console.log('   • Use object pooling for particle systems');
        console.log('   • Consider animation culling for off-screen objects');
    }
}

// Main execution
async function analyzeAllFiles() {
    const analyzer = new GLBAnalyzer();
    
    const filesToAnalyze = [
        'v5-transformed.glb',
        'LOST_cut2_v5-transformed.glb'
    ];

    console.log('🚀 Starting GLB Animation Analysis');
    console.log('='.repeat(80));
    console.log(`📋 Files to analyze: ${filesToAnalyze.length}`);
    console.log(`🎯 Analysis scope: Animation structure, timing, synchronization feasibility`);
    
    for (const fileName of filesToAnalyze) {
        const filePath = path.join(__dirname, fileName);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.log(`\n⚠️  File not found: ${fileName}`);
            continue;
        }
        
        await analyzer.analyzeFile(filePath, fileName);
        
        // Add small delay between analyses
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Generate comprehensive comparison report
    analyzer.generateComparisonReport();
    
    console.log('\n✅ Analysis Complete!');
    console.log('='.repeat(80));
}

// Error handling wrapper
analyzeAllFiles().catch(error => {
    console.error('❌ Fatal error during analysis:', error);
    process.exit(1);
});