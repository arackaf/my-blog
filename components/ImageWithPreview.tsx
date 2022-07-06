import { useEffect, useRef } from "react";
import { decode } from "../node_modules/blurhash/dist/esm/index";

type blurhash = { w: number; h: number; blurhash: string };

if (typeof HTMLElement !== "undefined") {
  class ImageWithPreview extends HTMLElement {
    loaded: boolean = false;
    sd: ShadowRoot;

    static observedAttributes = ["preview", "url"];

    get currentImageEl() {
      return this.querySelector("img");
    }
    get currentCanvasEl() {
      return this.querySelector("canvas");
    }

    constructor() {
      super();
      this.sd = this.attachShadow({ mode: "open" });
      this.sd.innerHTML = `<slot name="preview"></slot>`;
    }

    connectedCallback() {
      if (this.currentImageEl.complete) {
        this.onImageLoad();
      }
      this.currentImageEl.addEventListener("load", this.onImageLoad);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (name === "preview") {
        const previewObj = JSON.parse(newValue);
        updateBlurHashPreview(this.currentCanvasEl, previewObj);
      } else if (name === "url") {
        if (newValue !== this.currentImageEl.getAttribute("src")) {
          this.loaded = false;
          this.currentImageEl.src = newValue || "";
        }
      }
      this.render();
    }

    onImageLoad = () => {
      if (this.getAttribute("url") !== this.currentImageEl.src) {
        setTimeout(() => {
          this.loaded = true;
          this.render();
        }, 1500);
      }
    };

    render() {
      this.sd.innerHTML = `<slot name="${this.loaded ? "image" : "preview"}"></slot>`;
    }
  }

  if (!customElements.get("uikit-image")) {
    customElements.define("uikit-image", ImageWithPreview);
  }
}

function updateBlurHashPreview(canvasEl: HTMLCanvasElement, preview: blurhash) {
  const { w: width, h: height } = preview;

  canvasEl.width = width;
  canvasEl.height = height;

  const pixels = decode(preview.blurhash, width, height);
  const ctx = canvasEl.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
}

export const ImagePreviewBootstrap = props => {
  return null;
};

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
