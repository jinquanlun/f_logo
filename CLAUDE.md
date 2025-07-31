# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a high-performance 3D particle system designed for website hero sections, featuring GPU-accelerated skeletal animation and interactive effects built with Three.js and Vite. The system converts GLB 3D models into dynamic particle clouds that can respond to skeletal animations.

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

The application follows a modular architecture with three main components:

1. **HeroParticleApp** (`src/main.js`) - Main application controller that manages:
   - Three.js scene setup with cinematic camera system
   - GLB model loading with DRACO compression support
   - Canvas gradient background generation
   - Animation loop with ultra-smooth interpolation

2. **HeroParticleSystem** (`src/HeroParticleSystem.js`) - Core particle system that:
   - Converts 3D mesh vertices into GPU-friendly particle data
   - Manages skeletal animation state and timing
   - Controls particle visibility and material properties
   - Handles animation scene filtering via `enabledScenes` configuration

3. **SkinnedModelProcessor** (`src/SkinnedModelProcessor.js`) - Data processing pipeline that:
   - Extracts vertex positions, skin indices, and weights from GLB models
   - Creates DataTextures for GPU shader consumption
   - Calculates optimal texture dimensions for particle data

### Shader System

The particle rendering uses a two-shader approach:

- **Vertex Shader** (`src/shaders/particles.vert.js`) - Samples position data from textures and applies distance-based sizing
- **Fragment Shader** (`src/shaders/particles.frag.js`) - Creates rotating particle patterns with realistic starlight colors

### Key Technical Concepts

**Data Texture Pipeline**: The system converts 3D mesh data into 2D textures that can be efficiently processed by GPU shaders. Vertex positions are packed into RGBA float textures with calculated UV coordinates for sampling.

**Animation Control**: Uses manual time control rather than Three.js automatic animation loops. The `customAnimationTime` property drives all animations with enhanced smoothing for ultra-smooth motion.

**Cinematic Camera System**: Implements automatic camera transitions between predefined viewpoints with organic easing functions and curved path interpolation.

## Model Requirements

- GLB format with optional DRACO compression
- Models should be placed in the root directory (e.g., `v5-transformed.glb`)
- DRACO decoder files must be in `public/draco/` directory
- Both skinned meshes and static meshes are supported (automatic fallback)

## Performance Considerations

- Particle count is limited to 120,000 for optimal performance
- Uses additive blending and disables depth writing for particle rendering
- Implements frustum culling bypass for large particle systems
- Delta time is capped and smoothed to prevent animation jitter

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

## Development Notes

- The application auto-opens at `http://localhost:3000` on dev server start
- Scene background uses pure black for space-like appearance
- Particle colors use realistic starlight temperature-based color schemes
- Camera positions are auto-calculated based on model bounds with cinematic presets