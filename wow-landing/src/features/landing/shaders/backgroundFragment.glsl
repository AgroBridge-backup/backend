in vec3 vWorldPosition;

uniform vec3 uTopColor;
uniform vec3 uBottomColor;
uniform float uOffset;
uniform float uExponent;

void main() {
  float h = normalize(vWorldPosition).y;
  float mixFactor = (h + uOffset) / (1.0 + uOffset);
  mixFactor = pow(mixFactor, uExponent);
  vec3 mixedColor = mix(uBottomColor, uTopColor, mixFactor);
  
  // Re-using starfield logic from a previous prompt for a subtle effect
  float star = step(0.998, fract(sin(dot(vWorldPosition.xy, vec2(12.9898,78.233))) * 43758.5453));
  
  gl_FragColor = vec4(mixedColor + vec3(star * 0.1), 1.0);
}