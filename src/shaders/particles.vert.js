export const particleVertexShader = `
precision highp float;

uniform sampler2D uBasePositions;
uniform float uPointSize;

varying vec2 vUv;

void main() {
    vUv = uv;
    
    // Sample the base position from the texture
    vec3 pos = texture2D(uBasePositions, uv).rgb;
    
    // Transform to world space
    vec4 modelPosition = vec4(pos, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;

    // Enhanced distance-based size calculation for better clarity
    float distance = length(viewPosition.xyz);

    // Smoother distance falloff with better scaling
    float sizeFactor = 1200.0 / (distance + 100.0); // Softer falloff curve
    gl_PointSize = uPointSize * sizeFactor;

    // Better size clamping for improved visibility
    gl_PointSize = clamp(gl_PointSize, 2.0, 12.0); // Larger range for better detail
}`