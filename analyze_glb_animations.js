import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// GLB files to analyze
const glbFiles = [
    'public/LOST_cut2_v31-transformed.glb',
    'public/Scenes_B_00100-transformed.glb', 
    'public/Scenes_B_00100.001-transformed.glb',
    'public/Scenes_B_0023-transformed.glb'
];

class GLBAnimationAnalyzer {
    constructor() {
        this.loader = new GLTFLoader();
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('public/draco/');
        this.loader.setDRACOLoader(this.dracoLoader);
        
        this.results = {};
    }

    async analyzeFile(filePath) {
        console.log(`\n🔍 Analyzing: ${filePath}`);
        console.log('='.repeat(60));
        
        try {
            const gltf = await this.loadGLB(filePath);
            const analysis = this.extractAnimationData(gltf, filePath);
            this.results[filePath] = analysis;
            this.printAnalysis(analysis, filePath);
            return analysis;
        } catch (error) {
            console.error(`❌ Error analyzing ${filePath}:`, error);
            return null;
        }
    }

    loadGLB(filePath) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                filePath,
                (gltf) => resolve(gltf),
                (progress) => {
                    const percent = (progress.loaded / progress.total * 100).toFixed(1);
                    console.log(`📥 Loading progress: ${percent}%`);
                },
                (error) => reject(error)
            );
        });
    }

    extractAnimationData(gltf, filePath) {
        const analysis = {
            fileName: filePath.split('/').pop(),
            hasAnimations: gltf.animations && gltf.animations.length > 0,
            animationCount: gltf.animations ? gltf.animations.length : 0,
            animations: [],
            scene: {
                objectCount: 0,
                meshCount: 0,
                cameraCount: 0,
                lightCount: 0
            },
            cameras: [],
            meshes: []
        };

        // Analyze scene structure
        gltf.scene.traverse((child) => {
            analysis.scene.objectCount++;
            
            if (child.isMesh) {
                analysis.scene.meshCount++;
                analysis.meshes.push({
                    name: child.name,
                    geometry: child.geometry.constructor.name,
                    vertexCount: child.geometry.attributes.position ? child.geometry.attributes.position.count : 0,
                    hasSkinnedMesh: child.isSkinnedMesh,
                    materialName: child.material.name || 'unnamed'
                });
            }
            
            if (child.isCamera) {
                analysis.scene.cameraCount++;
                analysis.cameras.push({
                    name: child.name,
                    type: child.constructor.name,
                    position: child.position.toArray(),
                    rotation: child.rotation.toArray()
                });
            }
            
            if (child.isLight) {
                analysis.scene.lightCount++;
            }
        });

        // Analyze animations
        if (gltf.animations && gltf.animations.length > 0) {
            gltf.animations.forEach((animation, index) => {
                const animData = {
                    name: animation.name,
                    duration: animation.duration,
                    trackCount: animation.tracks.length,
                    tracks: []
                };

                animation.tracks.forEach((track) => {
                    const trackInfo = {
                        name: track.name,
                        type: track.constructor.name,
                        times: {
                            count: track.times.length,
                            start: track.times[0],
                            end: track.times[track.times.length - 1],
                            duration: track.times[track.times.length - 1] - track.times[0]
                        },
                        values: {
                            count: track.values.length,
                            itemSize: track.getValueSize(),
                            totalKeyframes: track.values.length / track.getValueSize()
                        },
                        interpolation: track.getInterpolation()
                    };

                    // Determine animation property type
                    if (track.name.includes('.position')) {
                        trackInfo.property = 'position';
                    } else if (track.name.includes('.rotation') || track.name.includes('.quaternion')) {
                        trackInfo.property = 'rotation';
                    } else if (track.name.includes('.scale')) {
                        trackInfo.property = 'scale';
                    } else {
                        trackInfo.property = 'other';
                    }

                    // Sample some keyframe values for analysis
                    if (track.values.length > 0) {
                        const sampleCount = Math.min(5, trackInfo.totalKeyframes);
                        trackInfo.sampleValues = [];
                        
                        for (let i = 0; i < sampleCount; i++) {
                            const index = Math.floor(i * (trackInfo.totalKeyframes - 1) / (sampleCount - 1));
                            const startIdx = index * trackInfo.values.itemSize;
                            const values = [];
                            
                            for (let j = 0; j < trackInfo.values.itemSize; j++) {
                                values.push(track.values[startIdx + j]);
                            }
                            
                            trackInfo.sampleValues.push({
                                time: track.times[index],
                                values: values
                            });
                        }
                    }

                    animData.tracks.push(trackInfo);
                });

                analysis.animations.push(animData);
            });
        }

        return analysis;
    }

    printAnalysis(analysis, filePath) {
        console.log(`\n📊 Analysis Results for: ${analysis.fileName}`);
        console.log('-'.repeat(50));
        
        // Scene structure
        console.log(`🏗️  Scene Structure:`);
        console.log(`   Objects: ${analysis.scene.objectCount}`);
        console.log(`   Meshes: ${analysis.scene.meshCount}`);
        console.log(`   Cameras: ${analysis.scene.cameraCount}`);
        console.log(`   Lights: ${analysis.scene.lightCount}`);

        // Meshes
        if (analysis.meshes.length > 0) {
            console.log(`\n🔸 Meshes:`);
            analysis.meshes.forEach((mesh, i) => {
                console.log(`   ${i + 1}. ${mesh.name || 'unnamed'}`);
                console.log(`      Vertices: ${mesh.vertexCount}`);
                console.log(`      Skinned: ${mesh.hasSkinnedMesh ? 'Yes' : 'No'}`);
            });
        }

        // Cameras
        if (analysis.cameras.length > 0) {
            console.log(`\n📷 Cameras:`);
            analysis.cameras.forEach((camera, i) => {
                console.log(`   ${i + 1}. ${camera.name || 'unnamed'} (${camera.type})`);
                console.log(`      Position: [${camera.position.map(v => v.toFixed(2)).join(', ')}]`);
            });
        }

        // Animations
        console.log(`\n🎬 Animation Analysis:`);
        console.log(`   Has Animations: ${analysis.hasAnimations ? 'Yes' : 'No'}`);
        console.log(`   Animation Count: ${analysis.animationCount}`);

        if (analysis.hasAnimations) {
            analysis.animations.forEach((anim, i) => {
                console.log(`\n   Animation ${i + 1}: "${anim.name}"`);
                console.log(`      Duration: ${anim.duration.toFixed(3)}s`);
                console.log(`      Tracks: ${anim.trackCount}`);
                
                // Group tracks by property type
                const tracksByProperty = {
                    position: [],
                    rotation: [],
                    scale: [],
                    other: []
                };
                
                anim.tracks.forEach(track => {
                    tracksByProperty[track.property].push(track);
                });
                
                Object.entries(tracksByProperty).forEach(([property, tracks]) => {
                    if (tracks.length > 0) {
                        console.log(`\n      ${property.toUpperCase()} Tracks (${tracks.length}):`);
                        tracks.forEach(track => {
                            console.log(`         • ${track.name}`);
                            console.log(`           Keyframes: ${track.values.totalKeyframes}`);
                            console.log(`           Duration: ${track.times.duration.toFixed(3)}s`);
                            
                            if (track.sampleValues && track.sampleValues.length > 0) {
                                console.log(`           Sample values:`);
                                track.sampleValues.slice(0, 3).forEach(sample => {
                                    const values = sample.values.map(v => v.toFixed(3)).join(', ');
                                    console.log(`             t=${sample.time.toFixed(2)}s: [${values}]`);
                                });
                            }
                        });
                    }
                });
            });
        }
        
        console.log('\n');
    }

    async analyzeAll() {
        console.log('🚀 Starting GLB Animation Analysis');
        console.log('='.repeat(80));
        
        const results = [];
        
        for (const filePath of glbFiles) {
            const result = await this.analyzeFile(filePath);
            if (result) {
                results.push(result);
            }
        }
        
        this.printSummaryReport(results);
        return results;
    }

    printSummaryReport(results) {
        console.log('\n📈 SUMMARY REPORT');
        console.log('='.repeat(80));
        
        const summary = {
            totalFiles: results.length,
            filesWithAnimations: 0,
            totalAnimations: 0,
            hasPositionTracks: 0,
            hasRotationTracks: 0,
            hasScaleTracks: 0,
            hasCameraAnimations: 0
        };
        
        results.forEach(result => {
            if (result.hasAnimations) {
                summary.filesWithAnimations++;
                summary.totalAnimations += result.animationCount;
                
                result.animations.forEach(anim => {
                    const hasPos = anim.tracks.some(t => t.property === 'position');
                    const hasRot = anim.tracks.some(t => t.property === 'rotation');
                    const hasScale = anim.tracks.some(t => t.property === 'scale');
                    
                    if (hasPos) summary.hasPositionTracks++;
                    if (hasRot) summary.hasRotationTracks++;
                    if (hasScale) summary.hasScaleTracks++;
                });
            }
            
            if (result.scene.cameraCount > 0) {
                summary.hasCameraAnimations++;
            }
        });
        
        console.log(`📊 Files analyzed: ${summary.totalFiles}`);
        console.log(`🎬 Files with animations: ${summary.filesWithAnimations}`);
        console.log(`🎭 Total animations found: ${summary.totalAnimations}`);
        console.log(`📍 Animations with position tracks: ${summary.hasPositionTracks}`);
        console.log(`🔄 Animations with rotation tracks: ${summary.hasRotationTracks}`);
        console.log(`📏 Animations with scale tracks: ${summary.hasScaleTracks}`);
        console.log(`📷 Files with cameras: ${summary.hasCameraAnimations}`);
        
        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('-'.repeat(50));
        
        if (summary.filesWithAnimations === 0) {
            console.log('❌ No animation data found in any files');
            console.log('   → Animation tracks may need to be exported from source');
        } else {
            console.log('✅ Animation data found!');
            
            if (summary.hasPositionTracks > 0) {
                console.log('✅ Position keyframes available for ring movement');
            }
            
            if (summary.hasRotationTracks > 0) {
                console.log('✅ Rotation keyframes available for ring spinning');
            }
            
            if (summary.hasScaleTracks > 0) {
                console.log('✅ Scale keyframes available for ring scaling effects');
            }
            
            console.log('✅ Sufficient data for implementing ring motion trajectory replacement');
        }
        
        console.log('\n🎯 FEASIBILITY FOR RING TRAJECTORY REPLACEMENT:');
        console.log('-'.repeat(50));
        
        const feasible = summary.filesWithAnimations > 0 && 
                        (summary.hasPositionTracks > 0 || summary.hasRotationTracks > 0);
        
        if (feasible) {
            console.log('✅ FEASIBLE - Animation data supports trajectory replacement');
            console.log('   → Can extract keyframe data for position, rotation, and timing');
            console.log('   → Can implement smooth interpolation between keyframes'); 
            console.log('   → Ring motion can be driven by extracted animation curves');
        } else {
            console.log('❌ NOT FEASIBLE - Insufficient animation data');
            console.log('   → Need to export animation tracks from original 3D software');
        }
    }
}

// Run the analysis
const analyzer = new GLBAnimationAnalyzer();
analyzer.analyzeAll().then(() => {
    console.log('\n✨ Analysis complete!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
});