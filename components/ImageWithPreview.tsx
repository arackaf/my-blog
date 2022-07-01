import { decode } from "../node_modules/blurhash/dist/esm/index";

type blurhash = { w: number; h: number; blurhash: string };

if (typeof HTMLElement !== "undefined") {
  class ImageWithPreview extends HTMLElement {
    loaded: boolean = false;
    imageEl?: HTMLImageElement;
    previewEl?: HTMLElement;
    noCoverElement: HTMLElement;
    #_url = "";

    set preview(val: blurhash) {
      this.previewEl = this.createPreview(val);
      this.render();
    }

    set url(val: string) {
      this.loaded = false;
      this.#_url = val;
      this.createMainImage(val);
      this.render();
    }

    set nocover(val: string) {
      this.noCoverElement = document.createElement(val);
      this.render();
    }

    createPreview(val: blurhash): HTMLElement {
      return blurHashPreview(val);
    }

    createMainImage(url: string) {
      this.loaded = false;
      if (!url) {
        this.imageEl = null;
        return;
      }

      const img = document.createElement("img");
      img.alt = "Image";
      img.addEventListener("load", () => {
        if (img === this.imageEl) {
          this.loaded = true;
          this.render();
        }
      });
      this.imageEl = img;
      img.src = url;
    }

    render() {
      const elementMaybe = this.loaded ? this.imageEl : this.#_url ? this.previewEl : this.noCoverElement;
      if (elementMaybe) {
        syncSingleChild(this, elementMaybe);
      }
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

function syncSingleChild(container: HTMLElement, child: HTMLElement) {
  const currentChild = container.firstElementChild;
  if (currentChild !== child) {
    clearContainer(container);
    if (child) {
      container.appendChild(child);
    }
  }
}

function clearContainer(el: HTMLElement) {
  let child: Element;

  while ((child = el.firstElementChild)) {
    el.removeChild(child);
  }
}
