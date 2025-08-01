import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GLBAnimationAnalyzer {
    constructor() {
        this.loader = new GLTFLoader();
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('./public/draco/');
        this.loader.setDRACOLoader(this.dracoLoader);
        this.analysisResults = [];
    }

    async analyzeFile(filePath, fileName) {
        console.log(`\n🔍 Analyzing: ${fileName}`);
        console.log('='.repeat(60));
        
        try {
            const gltf = await this.loadGLB(filePath);
            const analysis = this.performAnalysis(gltf, fileName);
            this.analysisResults.push(analysis);
            this.printAnalysis(analysis);
            return analysis;
        } catch (error) {
            console.error(`❌ Error analyzing ${fileName}:`, error.message);
            return null;
        }
    }

    async loadGLB(filePath) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                filePath,
                (gltf) => resolve(gltf),
                (progress) => {
                    // Progress callback - optional
                },
                (error) => reject(error)
            );
        });
    }

    performAnalysis(gltf, fileName) {
        const analysis = {
            fileName,
            fileSize: this.getFileSize(fileName),
            animations: [],
            meshes: [],
            materials: [],
            bones: [],
            cameras: [],
            lights: [],
            totalDuration: 0,
            maxDuration: 0,
            minDuration: Infinity
        };

        // Analyze animations
        if (gltf.animations && gltf.animations.length > 0) {
            gltf.animations.forEach((animation, index) => {
                const animData = this.analyzeAnimation(animation, index);
                analysis.animations.push(animData);
                analysis.totalDuration += animData.duration;
                analysis.maxDuration = Math.max(analysis.maxDuration, animData.duration);
                analysis.minDuration = Math.min(analysis.minDuration, animData.duration);
            });
        } else {
            analysis.minDuration = 0;
        }

        // Analyze scene objects
        gltf.scene.traverse((object) => {
            if (object.isMesh) {
                analysis.meshes.push({
                    name: object.name,
                    type: object.type,
                    geometry: object.geometry?.type,
                    vertices: object.geometry?.attributes?.position?.count || 0,
                    hasSkinnedMesh: object.isSkinnedMesh,
                    morphTargets: object.morphTargetInfluences?.length || 0
                });
            } else if (object.isBone) {
                analysis.bones.push({
                    name: object.name,
                    position: object.position.toArray(),
                    rotation: object.rotation.toArray(),
                    scale: object.scale.toArray()
                });
            } else if (object.isCamera) {
                analysis.cameras.push({
                    name: object.name,
                    type: object.type,
                    fov: object.fov,
                    position: object.position.toArray(),
                    rotation: object.rotation.toArray()
                });
            } else if (object.isLight) {
                analysis.lights.push({
                    name: object.name,
                    type: object.type,
                    intensity: object.intensity,
                    color: object.color.getHex()
                });
            }
        });

        // Analyze materials
        gltf.scene.traverse((object) => {
            if (object.material && analysis.materials.findIndex(m => m.name === object.material.name) === -1) {
                analysis.materials.push({
                    name: object.material.name,
                    type: object.material.type,
                    transparent: object.material.transparent,
                    opacity: object.material.opacity
                });
            }
        });

        return analysis;
    }

    analyzeAnimation(animation, index) {
        const animData = {
            index,
            name: animation.name || `Animation_${index}`,
            duration: animation.duration,
            tracks: [],
            keyframeCounts: {},
            trackTypes: new Set(),
            targetObjects: new Set()
        };

        animation.tracks.forEach((track, trackIndex) => {
            const trackData = this.analyzeTrack(track, trackIndex);
            animData.tracks.push(trackData);
            animData.trackTypes.add(trackData.type);
            animData.targetObjects.add(trackData.targetObject);
            
            if (!animData.keyframeCounts[trackData.type]) {
                animData.keyframeCounts[trackData.type] = 0;
            }
            animData.keyframeCounts[trackData.type] += trackData.keyframes.length;
        });

        animData.trackTypes = Array.from(animData.trackTypes);
        animData.targetObjects = Array.from(animData.targetObjects);

        return animData;
    }

    analyzeTrack(track, index) {
        const trackData = {
            index,
            name: track.name,
            targetObject: track.name.split('.')[0],
            property: track.name.split('.').pop(),
            type: this.getTrackType(track.name),
            valueSize: track.getValueSize(),
            keyframes: [],
            interpolation: track.getInterpolation(),
            duration: 0
        };

        // Extract keyframe data
        const times = track.times;
        const values = track.values;
        
        for (let i = 0; i < times.length; i++) {
            const time = times[i];
            const valueStart = i * trackData.valueSize;
            const value = values.slice(valueStart, valueStart + trackData.valueSize);
            
            trackData.keyframes.push({
                time,
                value: Array.from(value)
            });
        }

        trackData.duration = times[times.length - 1] || 0;

        return trackData;
    }

    getTrackType(trackName) {
        if (trackName.includes('.position')) return 'position';
        if (trackName.includes('.rotation')) return 'rotation';
        if (trackName.includes('.quaternion')) return 'quaternion';
        if (trackName.includes('.scale')) return 'scale';
        if (trackName.includes('.morphTargetInfluences')) return 'morph';
        return 'unknown';
    }

    getFileSize(fileName) {
        try {
            const filePath = path.join(__dirname, fileName);
            const stats = fs.statSync(filePath);
            return this.formatBytes(stats.size);
        } catch (error) {
            return 'Unknown';
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
                console.log(`     Tracks: ${anim.tracks.length}`);
                console.log(`     Track Types: ${anim.trackTypes.join(', ')}`);
                console.log(`     Target Objects: ${anim.targetObjects.join(', ')}`);
                console.log(`     Keyframe Counts:`, anim.keyframeCounts);
                
                // Show detailed keyframe timing for first few tracks
                if (anim.tracks.length > 0) {
                    console.log(`     Sample Keyframe Times (first track):`);
                    const sampleTrack = anim.tracks[0];
                    const keyframeTimes = sampleTrack.keyframes.slice(0, 10).map(kf => kf.time.toFixed(3));
                    console.log(`       ${keyframeTimes.join(', ')}${sampleTrack.keyframes.length > 10 ? '...' : ''}`);
                }
                console.log('');
            });
        }

        console.log(`🎯 Meshes: ${analysis.meshes.length}`);
        if (analysis.meshes.length > 0) {
            analysis.meshes.forEach(mesh => {
                console.log(`  • ${mesh.name} (${mesh.vertices} vertices)${mesh.hasSkinnedMesh ? ' [SKINNED]' : ''}`);
            });
        }

        console.log(`🦴 Bones: ${analysis.bones.length}`);
        console.log(`📷 Cameras: ${analysis.cameras.length}`);
        console.log(`💡 Lights: ${analysis.lights.length}`);
        console.log(`🎨 Materials: ${analysis.materials.length}`);
        
        console.log('-'.repeat(60));
    }

    generateComparisonReport() {
        console.log('\n📊 COMPREHENSIVE COMPARISON ANALYSIS');
        console.log('='.repeat(80));

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
                console.log(`  Total Tracks: ${mainAnim.tracks.length}`);
                
                // Sample keyframe distribution
                if (mainAnim.tracks.length > 0) {
                    const sampleTrack = mainAnim.tracks[0];
                    const keyframeDensity = sampleTrack.keyframes.length / mainAnim.duration;
                    console.log(`  Keyframe Density: ${keyframeDensity.toFixed(1)} keyframes/second`);
                }
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
            
            console.log('\n4. 🎨 Visual Coordination:');
            console.log('   • Ensure all particle systems use the same animation timeline');
            console.log('   • Coordinate camera movements with object animations');
            console.log('   • Synchronize particle effects with skeletal animations');
            
        } else {
            console.log('• Single animation file detected - no synchronization needed');
            console.log('• Focus on smooth playback and particle system integration');
        }

        console.log('\n📝 Code Integration Points:');
        console.log('   • Update HeroParticleSystem.js to handle multiple GLB files');
        console.log('   • Modify animation time control in main.js');
        console.log('   • Consider creating separate managers for different animation types');
        
        console.log('\n⚡ Performance Considerations:');
        console.log('   • Monitor total polygon count across all files');
        console.log('   • Implement LOD (Level of Detail) if needed');
        console.log('   • Use object pooling for particle systems');
        console.log('   • Consider animation culling for off-screen objects');
    }
}

// Main execution
async function analyzeAllFiles() {
    const analyzer = new GLBAnimationAnalyzer();
    
    const filesToAnalyze = [
        'public/LOST_cut2_v31-transformed.glb',
        'public/Scenes_B_00100-transformed.glb',
        'public/Scenes_B_00100.001-transformed.glb', 
        'public/Scenes_B_0023-transformed.glb',
        'public/cam_cut2_v3cam.glb'
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