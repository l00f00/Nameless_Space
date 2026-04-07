const BLOOM_VS = `
attribute vec2 aPosition;
varying vec2 vUv;

void main(void) {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vUv = (aPosition + 1.0) * 0.5;
}
`;

const BLOOM_FS = `
precision mediump float;

varying vec2 vUv;
uniform sampler2D uColorBuffer;
uniform vec2 uResolution;
uniform float uStrength;
uniform float uRadius;
uniform float uThreshold;

vec3 sampleBloom(vec2 uv, vec2 offset) {
    vec3 color = texture2D(uColorBuffer, uv + offset).rgb;
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float mask = smoothstep(uThreshold, 1.0, luminance);
    return color * mask;
}

void main(void) {
    vec2 texel = vec2(1.0 / max(uResolution.x, 1.0), 1.0 / max(uResolution.y, 1.0));
    vec3 base = texture2D(uColorBuffer, vUv).rgb;
    vec3 glow = vec3(0.0);

    glow += sampleBloom(vUv, vec2(0.0, 0.0)) * 0.18;
    glow += sampleBloom(vUv, vec2( texel.x * uRadius, 0.0)) * 0.14;
    glow += sampleBloom(vUv, vec2(-texel.x * uRadius, 0.0)) * 0.14;
    glow += sampleBloom(vUv, vec2(0.0,  texel.y * uRadius)) * 0.14;
    glow += sampleBloom(vUv, vec2(0.0, -texel.y * uRadius)) * 0.14;
    glow += sampleBloom(vUv, vec2( texel.x * uRadius,  texel.y * uRadius)) * 0.1;
    glow += sampleBloom(vUv, vec2(-texel.x * uRadius,  texel.y * uRadius)) * 0.1;
    glow += sampleBloom(vUv, vec2( texel.x * uRadius, -texel.y * uRadius)) * 0.1;
    glow += sampleBloom(vUv, vec2(-texel.x * uRadius, -texel.y * uRadius)) * 0.1;

    gl_FragColor = vec4(base + glow * uStrength, 1.0);
}
`;

export class BloomEffect extends pc.PostEffect {
  constructor(graphicsDevice) {
    super(graphicsDevice);

    this.strength = 0;
    this.radius = 5;
    this.threshold = 0.58;

    this.shader = pc.createShaderFromCode(
      graphicsDevice,
      BLOOM_VS,
      BLOOM_FS,
      'BloomEffect',
      {
        aPosition: pc.SEMANTIC_POSITION
      }
    );
  }

  render(inputTarget, outputTarget, rect) {
    const scope = this.device.scope;
    scope.resolve('uColorBuffer').setValue(inputTarget.colorBuffer);
    scope.resolve('uResolution').setValue([
      inputTarget.width || this.device.width,
      inputTarget.height || this.device.height
    ]);
    scope.resolve('uStrength').setValue(this.strength);
    scope.resolve('uRadius').setValue(this.radius);
    scope.resolve('uThreshold').setValue(this.threshold);

    pc.drawFullscreenQuad(this.device, outputTarget, this.vertexBuffer, this.shader, rect);
  }
}
