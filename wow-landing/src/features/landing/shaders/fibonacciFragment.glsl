precision highp float;
varying vec3 vPosition;
uniform vec3 center;
uniform vec2 screen;
uniform float glow;

void main() {
  float dist = length(vPosition - center) / (screen.x * 0.5);
  vec3 grad = mix(vec3(0.0, 0.96, 1.0), vec3(0.0, 0.5, 1.0), dist);
  float fresnel = pow(1.0 - dot(normalize(vPosition - center), vec3(0,0,1)), 2.0);
  float bloom = smoothstep(0.8, 1.0, fresnel) * glow;
  gl_FragColor = vec4(grad + bloom, 1.0);
}
