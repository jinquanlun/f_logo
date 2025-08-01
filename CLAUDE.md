# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a high-performance 3D particle system designed for website hero sections, featuring GPU-accelerated skeletal animation and interactive effects built with Three.js and Vite. The system converts GLB 3D models into dynamic particle clouds that can respond to skeletal animations and supports synchronized multi-GLB animation sequences.

## Development Commands

```bash
# Start development server (runs on port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Install dependencies
npm install
```

## Core Architecture

### Application Structure

The application follows a modular architecture with multiple animation systems:

1. **HeroParticleApp** (`src/main.js`) - Main application controller that manages:
   - Three.js scene setup with cinematic camera system
   - GLB model loading with DRACO compression support
   - Canvas gradient background generation
   - Animation sequence orchestration (Hero → Camera + Ring animations)
   - Keyboard interaction system for testing and control

2. **HeroParticleSystem** (`src/HeroParticleSystem.js`) - Core particle system that:
   - Converts 3D mesh vertices into GPU-friendly particle data
   - Manages hero animation with completion callbacks
   - Controls particle visibility and material properties
   - Handles animation scene filtering via `enabledScenes` configuration

3. **MasterAnimationController** (`src/MasterAnimationController.js`) - Synchronized animation controller that:
   - Loads master GLB files (e.g., LOST_cut2_v31-transformed.glb) containing complete animation sequences
   - Extracts initial camera positions from GLB animation data
   - Manages unified 7-second animation timeline for complete synchronization
   - Controls both camera and ring animations simultaneously

4. **Multi-GLB Animation System**:
   - **AnimationTrackExtractor** (`src/AnimationTrackExtractor.js`) - Extracts animation tracks from separate GLB files
   - **RingAnimationMapper** (`src/RingAnimationMapper.js`) - Maps extracted ring animations to scene objects
   - **CameraAnimationMapper** (`src/CameraAnimationMapper.js`) - Handles camera trajectory animations from GLB files

5. **SkinnedModelProcessor** (`src/SkinnedModelProcessor.js`) - Data processing pipeline that:
   - Extracts vertex positions, skin indices, and weights from GLB models
   - Creates DataTextures for GPU shader consumption
   - Calculates optimal texture dimensions for particle data

### Animation Sequence Architecture

The system implements a sophisticated three-phase animation sequence:

```
Phase 1: Hero Animation (Particle system intro)
    ↓
Phase 2: Camera + Ring Synchronized Animation (7 seconds)
    ↓
Phase 3: Complete (All animations stopped at final frame)
```

**Key Components:**
- **Sequence State Management**: Tracks animation phases and completion states
- **Callback System**: Hero animation triggers camera+ring phase via callbacks
- **Synchronized Timeline**: Master controller ensures perfect 7-second synchronization
- **Final State Locking**: Rings end in vertical alignment as designed

### Shader System

The particle rendering uses a two-shader approach:

- **Vertex Shader** (`src/shaders/particles.vert.js`) - Samples position data from textures and applies distance-based sizing
- **Fragment Shader** (`src/shaders/particles.frag.js`) - Creates rotating particle patterns with realistic starlight colors

### Key Technical Concepts

**Data Texture Pipeline**: The system converts 3D mesh data into 2D textures that can be efficiently processed by GPU shaders. Vertex positions are packed into RGBA float textures with calculated UV coordinates for sampling.

**Master Animation Control**: Uses unified time control for complete synchronization. The `MasterAnimationController` manages a single 7-second timeline that drives both camera and ring animations simultaneously.

**Cinematic Camera System**: Implements automatic camera transitions between predefined viewpoints with organic easing functions and curved path interpolation.

**GLB Animation Extraction**: Advanced system to extract animation tracks from separate GLB files and apply them to existing scene objects while maintaining perfect synchronization.

## Model Requirements

### Primary Models
- `v5-transformed.glb` - Main particle system model (placed in root directory)
- `LOST_cut2_v31-transformed.glb` - Master animation file containing synchronized camera and ring animations (placed in `public/`)

### Separate Animation GLB Files (placed in `public/`)
- `Scenes_B_00100-transformed.glb` - Main ring animation
- `Scenes_B_0023-transformed.glb` - Middle ring animation  
- `Scenes_B_00100.001-transformed.glb` - Small ring animation
- `cam_cut2_v3cam.glb` - Camera trajectory animation

### Technical Requirements
- GLB format with optional DRACO compression
- DRACO decoder files must be in `public/draco/` directory
- All animation GLB files should have exactly 7.000 seconds duration for perfect synchronization
- Both skinned meshes and static meshes are supported (automatic fallback)

## Performance Considerations

- Particle count is limited to 120,000 for optimal performance
- Uses additive blending and disables depth writing for particle rendering
- Implements frustum culling bypass for large particle systems
- Delta time is capped and smoothed to prevent animation jitter
- Dual animation system allows switching between lightweight and heavy animation modes

## Animation Scene Control

The `enabledScenes` object in HeroParticleSystem allows selective enabling/disabling of specific animation clips:

```javascript
this.enabledScenes = {
    'Scenes_B_00100Action': true,     // Main ring animation
    'Scenes_B_0023动作': false,        // Second ring animation - DISABLED
    'Scenes_B_00100.001Action': false, // Smallest ring - always disabled
    'vipAction.001': false             // VIP ring - always disabled
}
```

## Keyboard Controls for Testing

| Key | Function | Description |
|-----|----------|-------------|
| **1** | Show Status | Display current animation sequence status |
| **R** | Reset | Reset entire animation sequence to beginning |
| **S** | Status | Show detailed animation sequence state |
| **P** | Pause/Resume | Toggle camera animation pause |
| **←/→** | Speed Control | Adjust camera animation speed |

## Development Notes

- The application auto-opens at `http://localhost:3000` on dev server start
- Scene background uses pure black for space-like appearance
- Particle colors use realistic starlight temperature-based color schemes
- Camera positions are extracted from GLB animation data for authentic starting viewpoints
- Console logging provides detailed animation system feedback during development
- Animation sequence is designed to end with rings in vertical alignment as specified in original GLB design