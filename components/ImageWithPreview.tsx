import { useEffect, useRef } from "react";
import { decode } from "../node_modules/blurhash/dist/esm/index";

type blurhash = { w: number; h: number; blurhash: string };

if (typeof HTMLElement !== "undefined") {
  class ImageWithPreview extends HTMLElement {
    loaded: boolean = false;

    static observedAttributes = ["preview", "url"];

    get currentImageEl() {
      return this.querySelector("img");
    }
    get currentCanvasEl() {
      return this.querySelector("canvas");
    }

    connectedCallback() {
      if (this.currentImageEl.complete) {
        this.onImageLoad();
      } else {
        this.currentImageEl.addEventListener("load", this.onImageLoad);
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (name === "preview") {
        this.syncPreview();
      } else if (name === "url") {
        if (newValue !== this.currentImageEl.getAttribute("src")) {
          this.syncImage();
        }
      }
      this.render();
    }

    syncPreview() {
      const previewObj = JSON.parse(this.getAttribute("preview"));
      const newCanvas = blurHashPreview(previewObj);
      this.replaceChild(newCanvas, this.currentCanvasEl);
    }

    syncImage() {
      this.loaded = false;
      this.setupMainImage(this.getAttribute("url"));
    }
    setupMainImage(url: string) {
      this.loaded = false;
      if (!url) {
        return;
      }

      const img = document.createElement("img");
      img.alt = "Image";
      img.addEventListener("load", this.onImageLoad);
      img.src = url;

      this.replaceChild(img, this.currentImageEl);
    }

    onImageLoad = () => {
      if (this.getAttribute("url") !== this.currentImageEl.src) {
        setTimeout(() => {
          this.loaded = true;
          this.render();
        }, 3000);
      }
    };

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

export const ImageWithPreview = (props: any) => {
  const wcRef = useRef(null);

  const { preview } = props;
  const { w, h } = JSON.parse(preview);

  useEffect(() => {
    wcRef.current.activate();
  }, []);

  return (
    <uikit-image ref={wcRef} {...props}>
      <img style={{ display: "none" }} />
      <canvas width={w} height={h}></canvas>
    </uikit-image>
  );
};
