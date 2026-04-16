/**
 * Camera capture using MediaDevices.getUserMedia.
 * Provides start/stop/capture-to-canvas helpers.
 */

export class Camera {
  constructor(videoEl) {
    this.video = videoEl;
    this.stream = null;
  }

  async start(facingMode = 'environment') {
    if (this.stream) this.stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('이 브라우저는 카메라 접근을 지원하지 않습니다');
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    } catch (e) {
      // Fallback: try without facingMode constraint
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    this.video.srcObject = null;
  }

  /** Capture current video frame to a new canvas. Returns the canvas. */
  capture() {
    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    if (!w || !h) throw new Error('아직 카메라 영상이 준비되지 않았습니다');
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0, w, h);
    return canvas;
  }
}
