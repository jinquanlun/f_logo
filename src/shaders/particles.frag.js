export const particleFragmentShader = `
precision highp float;

uniform float uOpacity;
uniform float uTime;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uAtmosphericColor;
uniform float uEnvironmentalShift;

// Enhanced uniforms for particle position and depth effects
varying vec3 vWorldPosition;
varying float vDepth;

void main() {
    // Get point coordinates and center them
    vec2 center = gl_PointCoord - vec2(0.5);
    float distance = length(center);

    // Discard pixels outside the circle
    if (distance > 0.5) discard;

    // Enhanced time variations for complex motion
    float slowTime = uTime * 0.4;
    float mediumTime = uTime * 0.8;
    float fastTime = uTime * 1.5;

    // Multi-layered pulsing effect with different frequencies
    float mainPulse = sin(slowTime) * 0.3 + 0.7;
    float microPulse = sin(fastTime * 3.0) * 0.1 + 0.9;
    float wavePulse = sin(slowTime * 0.5 + distance * 8.0) * 0.2 + 0.8;
    float combinedPulse = mainPulse * microPulse * wavePulse;

    // Advanced rotation with organic variation
    float baseRotation = slowTime + sin(slowTime * 0.3) * 0.15;
    float depthRotation = vDepth * 0.001; // Subtle depth-based rotation offset
    float rotation = baseRotation + depthRotation;
    float cos_r = cos(rotation);
    float sin_r = sin(rotation);

    // Enhanced rotated coordinates
    vec2 rotated = vec2(
        center.x * cos_r - center.y * sin_r,
        center.x * sin_r + center.y * cos_r
    );

    // Complex multi-layered patterns
    float angle = atan(rotated.y, rotated.x);
    
    // Primary spiral pattern
    float spiral1 = sin(angle * 4.0 + rotation * 2.0 + distance * 6.0) * 0.4 + 0.6;
    
    // Secondary counter-rotating pattern
    float spiral2 = sin(angle * -2.0 + rotation * -1.5 + slowTime * 2.0) * 0.3 + 0.7;
    
    // Radial wave pattern
    float radialWave = sin(distance * 12.0 + mediumTime * 3.0) * 0.2 + 0.8;
    
    // Combine patterns with smooth transitions
    float pattern = (spiral1 * 0.5 + spiral2 * 0.3 + radialWave * 0.2) * combinedPulse;
    pattern = smoothstep(0.15, 0.85, pattern);

    // Enhanced falloff with depth-based variations
    float baseFalloff = 1.0 - smoothstep(0.0, 0.45, distance);
    float edgeGlow = 1.0 - smoothstep(0.35, 0.5, distance); // Additional edge glow
    float alpha = baseFalloff * baseFalloff * baseFalloff; // Cubic falloff
    alpha += edgeGlow * 0.3 * combinedPulse; // Add pulsing edge glow
    alpha *= uOpacity * pattern;

    // Dynamic alpha boost based on pulsing
    alpha = clamp(alpha * (1.0 + combinedPulse * 0.3), 0.0, 1.0);

    // Advanced color system with temperature variations
    // Base starlight colors
    vec3 coolColor = vec3(0.7, 0.85, 1.0);   // Cool blue-white
    vec3 warmColor = vec3(1.0, 0.9, 0.7);    // Warm yellow-white
    vec3 hotColor = vec3(1.0, 1.0, 1.0);     // Pure white hot
    
    // Time-based color temperature shifting
    float tempShift = sin(slowTime * 0.7 + distance * 3.0) * 0.5 + 0.5;
    
    // Depth-based color variation
    float depthFactor = clamp(vDepth * 0.0008, 0.0, 1.0);
    
    // Pattern-based color mixing
    vec3 baseColor = mix(coolColor, warmColor, tempShift);
    baseColor = mix(baseColor, hotColor, pattern * 0.4);
    
    // Add depth-based blue shift for distant particles
    baseColor = mix(baseColor, coolColor, depthFactor * 0.3);
    
    // Pulsing color intensity
    vec3 finalColor = baseColor * (0.8 + combinedPulse * 0.4);
    
    // Add subtle rainbow shimmer effect
    float shimmer = sin(angle * 8.0 + fastTime) * 0.1;
    finalColor.g += shimmer * pattern * 0.2;
    finalColor.b += shimmer * pattern * 0.15;
    
    // Apply environmental color shifts
    vec3 environmentalInfluence = uAtmosphericColor * uEnvironmentalShift * 0.3;
    finalColor = mix(finalColor, finalColor + environmentalInfluence, 0.4);
    
    // Atmospheric depth fog
    float fogFactor = smoothstep(uFogNear, uFogFar, vDepth);
    vec3 foggedColor = mix(finalColor, vec3(0.0), fogFactor * 0.7);
    
    // Atmospheric glow for distant particles
    float glowFactor = 1.0 - fogFactor;
    vec3 atmosphericGlow = uAtmosphericColor * glowFactor * 0.2;
    foggedColor += atmosphericGlow;
    
    // Apply fog to alpha as well
    float foggedAlpha = alpha * (1.0 - fogFactor * 0.5);

    // Output enhanced color with atmospheric effects
    gl_FragColor = vec4(foggedColor, foggedAlpha);
}`