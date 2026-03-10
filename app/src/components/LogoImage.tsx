/**
 * LogoImage — renders the AscendOne logo with its white/light background
 * removed at runtime via canvas pixel manipulation, producing a
 * genuinely transparent logo that sits cleanly on any dark surface.
 */
import { useEffect, useRef } from "react";
import logoSrc from "../assets/logo-black.png";

interface LogoImageProps {
  size: number;
  style?: React.CSSProperties;
  className?: string;
}

export default function LogoImage({ size, style, className }: LogoImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      // Draw at full resolution for best quality
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];

        // Pure-white and very-near-white → fully transparent
        if (r > 245 && g > 245 && b > 245) {
          d[i + 3] = 0;
          continue;
        }

        // Near-white with low saturation → partially transparent (anti-alias)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        const brightness = max / 255;

        if (brightness > 0.88 && saturation < 0.10) {
          const alpha = Math.round(((1 - brightness) / 0.12) * 255);
          d[i + 3] = Math.min(d[i + 3], Math.max(0, alpha));
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    img.src = logoSrc;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width:  size,
        height: size,
        objectFit: "contain",
        display: "block",
        ...style,
      }}
    />
  );
}
