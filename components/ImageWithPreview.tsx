import { decode } from "../node_modules/blurhash/dist/esm/index";

type blurhash = { w: number; h: number; blurhash: string };

if (typeof HTMLElement !== "undefined") {
  class ImageWithPreview extends HTMLElement {
    active: boolean = false;
    loaded: boolean = false;
    dirty: boolean = false;

    static observedAttributes = ["preview", "url"];

    get currentImageEl() {
      return this.querySelector("img");
    }
    get currentCanvasEl() {
      return this.querySelector("canvas");
    }

    connectedCallback() {
      this.active = true;
      if (this.dirty) {
        this.sync();
        this.dirty = false;
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (!this.active) {
        this.dirty = true;
        return;
      }

      if (name === "preview") {
        this.syncPreview();
      } else if (name === "url") {
        this.syncImage();
      }
      this.render();
    }

    sync() {
      if (this.getAttribute("preview") && this.getAttribute("url")) {
        this.syncPreview();
        this.syncImage();
        this.render();
      }
    }

    syncPreview() {
      const previewObj = JSON.parse(this.getAttribute("preview"));
      this.setNewPreview(previewObj);
    }
    setNewPreview(val: blurhash) {
      const priorCanvas = this.currentCanvasEl;
      const newCanvas = blurHashPreview(val);

      this.replaceChild(newCanvas, priorCanvas);
    }

    syncImage() {
      this.loaded = false;
      this.setupMainImage(this.getAttribute("img"));
    }
    setupMainImage(url: string) {
      this.loaded = false;
      if (!url) {
        return;
      }

      const img = document.createElement("img");
      img.alt = "Image";
      img.addEventListener("load", () => {
        if (img === this.currentImageEl) {
          this.loaded = true;
          this.render();
        }
      });
      img.src = url;

      const oldImage = this.currentImageEl;
      this.replaceChild(img, oldImage);
    }

    render() {
      const shown = this.loaded ? this.currentImageEl : this.currentCanvasEl;
      const hidden = !this.loaded ? this.currentImageEl : this.currentCanvasEl;

      shown.style.display = "";
      hidden.style.display = "none";
    }
  }

  if (!customElements.get("uikit-image")) {
    customElements.define("uikit-image", ImageWithPreview);
  }
}

function blurHashPreview(preview: blurhash): HTMLCanvasElement {
  const canvasEl = document.createElement("canvas");
  const { w: width, h: height } = preview;

  canvasEl.width = width;
  canvasEl.height = height;

  const pixels = decode(preview.blurhash, width, height);
  const ctx = canvasEl.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);

  return canvasEl;
}

export const ImageWithPreview = (props: any) => (
  <uikit-image {...props}>
    <img />
    <canvas></canvas>
  </uikit-image>
);
