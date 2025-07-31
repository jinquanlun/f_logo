export const particleVertexShader = `
precision highp float;

uniform sampler2D uBasePositions;
uniform float uPointSize;
uniform float uTime;
uniform vec3 uMousePosition;
uniform float uMouseStrength;
uniform float uMagneticStrength;
uniform float uMorphingIntensity;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vDepth;

void main() {
    vUv = uv;
    
    // Sample the base position from the texture
    vec3 pos = texture2D(uBasePositions, uv).rgb;
    
    // Enhanced wave motion effects
    float waveTime = uTime * 0.5;
    
    // Multi-layered wave displacement
    float waveX = sin(pos.y * 2.0 + waveTime) * 0.02;
    float waveY = cos(pos.x * 1.5 + waveTime * 0.7) * 0.015;
    float waveZ = sin(pos.z * 1.8 + waveTime * 0.9) * 0.018;
    
    // Radial wave from center
    float distFromCenter = length(pos.xz);
    float radialWave = sin(distFromCenter * 0.8 + waveTime * 2.0) * 0.025;
    
    // Apply wave displacements
    vec3 animatedPos = pos;
    animatedPos.x += waveX + radialWave * 0.5;
    animatedPos.y += waveY + radialWave * 0.3;
    animatedPos.z += waveZ + radialWave * 0.4;
    
    // Magnetic attraction to mouse position
    if (uMouseStrength > 0.0) {
        vec3 toMouse = uMousePosition - animatedPos;
        float mouseDistance = length(toMouse);
        
        // Magnetic field falloff
        float magneticRange = 8.0;
        float magneticInfluence = smoothstep(magneticRange, 0.0, mouseDistance);
        magneticInfluence *= uMouseStrength * uMagneticStrength;
        
        // Apply magnetic attraction
        vec3 magneticForce = normalize(toMouse) * magneticInfluence * 0.5;
        animatedPos += magneticForce;
    }
    
    // Morphing effects
    float morphPhase = waveTime * 0.7 + length(pos.xz) * 0.5;
    vec3 morphOffset = vec3(
        sin(morphPhase) * 0.2,
        cos(morphPhase * 1.3) * 0.15,
        sin(morphPhase * 0.8) * 0.18
    ) * uMorphingIntensity;
    
    animatedPos += morphOffset;
    
    // Transform to world space
    vec4 modelPosition = vec4(animatedPos, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;
    
    // Pass world position and depth to fragment shader
    vWorldPosition = (modelMatrix * vec4(animatedPos, 1.0)).xyz;
    vDepth = length(viewPosition.xyz);

    // Enhanced distance-based size calculation with pulsing
    float distance = length(viewPosition.xyz);
    
    // Pulsing size effect
    float pulse = sin(uTime * 1.2 + distFromCenter * 3.0) * 0.15 + 0.85;
    
    // Smoother distance falloff with better scaling
    float sizeFactor = (1200.0 / (distance + 100.0)) * pulse;
    gl_PointSize = uPointSize * sizeFactor;

    // Dynamic size clamping based on depth
    float minSize = mix(1.5, 3.0, clamp(distance / 500.0, 0.0, 1.0));
    float maxSize = mix(8.0, 15.0, clamp(distance / 200.0, 0.0, 1.0));
    gl_PointSize = clamp(gl_PointSize, minSize, maxSize);
}`