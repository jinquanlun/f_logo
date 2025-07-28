export const particleVertexShader = `
uniform sampler2D uBasePositions;
uniform float uPointSize;

varying vec2 vUv;
attribute vec2 uv;

void main() {
    vUv = uv;
    
    // Sample the base position from the texture
    vec3 pos = texture2D(uBasePositions, uv).rgb;
    
    // Transform to world space
    vec4 modelPosition = vec4(pos, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;
    gl_PointSize = uPointSize;
    
    // Calculate distance-based size falloff
    float distance = length(viewPosition.xyz);
    gl_PointSize *= (1000.0 / distance);
    
    // Clamp point size
    gl_PointSize = clamp(gl_PointSize, 1.0, 10.0);
}`