export const particleFragmentShader = `
precision highp float;

uniform float uOpacity;
uniform float uTime;

void main() {
    // Get point coordinates and center them
    vec2 center = gl_PointCoord - vec2(0.5);

    // Ultra-smooth rotation with enhanced easing
    float smoothTime = uTime * 0.6; // Even slower, more elegant rotation
    float rotation = smoothTime + sin(smoothTime * 0.3) * 0.15; // Reduced variation for smoother motion
    float cos_r = cos(rotation);
    float sin_r = sin(rotation);

    // Create a pattern that makes rotation visible
    vec2 rotated = vec2(
        center.x * cos_r - center.y * sin_r,
        center.x * sin_r + center.y * cos_r
    );

    float distance = length(center);

    // Discard pixels outside the circle
    if (distance > 0.5) discard;

    // Create a smooth rotating pattern inside the circle
    float angle = atan(rotated.y, rotated.x);
    float pattern = sin(angle * 3.0 + rotation * 2.0) * 0.4 + 0.6;
    pattern = smoothstep(0.2, 0.8, pattern); // Smooth the pattern transitions

    // Enhanced falloff for better clarity and definition
    float alpha = 1.0 - smoothstep(0.0, 0.45, distance); // Slightly sharper edge
    alpha = alpha * alpha * alpha; // Cubic falloff for even smoother edges
    alpha *= uOpacity * pattern;

    // Boost alpha for better visibility
    alpha = clamp(alpha * 1.2, 0.0, 1.0);

    // Enhanced blue-white color scheme with better contrast
    vec3 color = mix(vec3(0.3, 0.6, 1.0), vec3(1.0, 1.0, 1.0), pattern * 0.9);

    // Output color with calculated alpha
    gl_FragColor = vec4(color, alpha);
}`