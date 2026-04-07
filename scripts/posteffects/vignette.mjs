const VIGNETTE_VS = `
attribute vec2 aPosition;
varying vec2 vUv;

void main(void) {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vUv = (aPosition + 1.0) * 0.5;
}
`;

const VIGNETTE_FS = `
precision mediump float;

varying vec2 vUv;
uniform sampler2D uColorBuffer;
uniform float uOffset;
uniform float uDarkness;

void main(void) {
    vec4 color = texture2D(uColorBuffer, vUv);
    vec2 uv = (vUv - 0.5) * uOffset;
    float vignette = smoothstep(0.95, 0.15, dot(uv, uv));
    color.rgb *= mix(1.0 - uDarkness, 1.0, vignette);
    gl_FragColor = color;
}
`;

export class VignetteEffect extends pc.PostEffect {
  constructor(graphicsDevice) {
    super(graphicsDevice);

    this.offset = 1.25;
    this.darkness = 0.32;

    this.shader = pc.createShaderFromCode(
      graphicsDevice,
      VIGNETTE_VS,
      VIGNETTE_FS,
      'VignetteEffect',
      {
        aPosition: pc.SEMANTIC_POSITION
      }
    );
  }

  render(inputTarget, outputTarget, rect) {
    const scope = this.device.scope;
    scope.resolve('uColorBuffer').setValue(inputTarget.colorBuffer);
    scope.resolve('uOffset').setValue(this.offset);
    scope.resolve('uDarkness').setValue(this.darkness);

    pc.drawFullscreenQuad(this.device, outputTarget, this.vertexBuffer, this.shader, rect);
  }
}
