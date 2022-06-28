import { FunctionComponent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { decode } from "blurhash";

export const ImageWithPreview = ({ url, preview = "" }) => {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoaded(false);
  }, [url]);

  useEffect(() => {
    // make sure the image src is added after the onload handler
    if (imgRef.current) {
      imgRef.current.src = url;
    }
  }, [url, imgRef, preview]);

  if (preview) {
    return (
      <>
        <Preview loaded={loaded} preview={preview} />
        <img
          key={`book-preview-real-${url}`}
          alt="Image"
          ref={imgRef}
          onLoad={() => setLoaded(true)}
          style={{ display: loaded ? "block" : "none" }}
        />
      </>
    );
  } else {
    return <img key="book-real" alt="Image" style={{ display: "block" }} src={url} />;
  }
};

type ImagePreviewProps = { preview: string | { blurhash: string; w: number; h: number }; loaded: boolean };
type CanvasPreviewProps = { preview: { blurhash: string; w: number; h: number }; loaded: boolean };

const Preview: FunctionComponent<ImagePreviewProps> = ({ preview, loaded }) => {
  if (loaded) {
    return null;
  } else if (typeof preview === "string") {
    return <img key="book-preview" alt="Image preview" src={preview} style={{ display: "block" }} />;
  } else {
    return <PreviewCanvas preview={preview} loaded={loaded} />;
  }
};

const PreviewCanvas: FunctionComponent<CanvasPreviewProps> = ({ preview }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const pixels = decode(preview.blurhash, preview.w, preview.h);
    const ctx = canvasRef.current.getContext("2d");
    const imageData = ctx.createImageData(preview.w, preview.h);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  }, [preview]);

  return <canvas className="book-preview" ref={canvasRef} width={preview.w} height={preview.h} />;
};
