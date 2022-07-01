import { decode } from "../node_modules/blurhash/dist/esm/index";

type blurhash = { w: number; h: number; blurhash: string };

if (typeof HTMLElement !== "undefined") {
  class ImageWithPreview extends HTMLElement {
    loaded: boolean = false;
    imageEl?: HTMLImageElement;
    previewEl?: HTMLElement;
    noCoverElement: HTMLElement;
    #_url = "";

    static observedAttributes = ["preview", "url"];

    attributeChangedCallback(name, oldValue, newValue) {
      if (name === "preview") {
        const previewObj = JSON.parse(newValue);
        this.previewEl = this.createPreview(previewObj);
        this.render();
      } else if (name === "url") {
        this.loaded = false;
        this.#_url = newValue;
        this.createMainImage(newValue);
        this.render();
      }
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
  console.log("A attempting", { child, currentChild });
  if (currentChild !== child) {
    console.log("B is stale");
    clearContainer(container);
    console.log("C cleared");
    if (child) {
      console.log("Ca child", child, "exists to be inserted");
      setTimeout(() => {
        container.appendChild(child);
      }, 1000);
      console.log("D inserted", container.firstElementChild);
    } else {
      console.log("Cd No child");
    }
  } else {
    console.log("XXX Up to date");
  }
}

function clearContainer(el: HTMLElement) {
  let child: Element;

  while ((child = el.firstElementChild)) {
    el.removeChild(child);
  }
}
