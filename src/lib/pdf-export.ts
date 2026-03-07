import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type PdfExportOptions = {
  sanitizeFormFields?: boolean;
  quality?: number;
  margin?: number;
  primaryScale?: number;
  fallbackScale?: number;
};

const waitForImages = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) return;

      if (typeof img.decode === "function") {
        try {
          await img.decode();
          return;
        } catch {
          // fallback to load/error listeners
        }
      }

      await new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    }),
  );
};

const sanitizeCloneForPdf = (
  doc: Document,
  options: Pick<PdfExportOptions, "sanitizeFormFields">,
) => {
  const containsUnsupported = (val?: string | null) =>
    Boolean(val && /(oklab|oklch|\blab\s*\(|\blch\s*\()/i.test(val));
  const safeBorder = "rgba(15, 23, 42, 0.2)";
  const safeInk = "#0f172a";

  doc.querySelectorAll("style").forEach((styleTag) => {
    if (containsUnsupported(styleTag.textContent)) {
      styleTag.remove();
    }
  });

  // html2canvas can fail while parsing modern color functions inside SVGs.
  doc.querySelectorAll("svg").forEach((svg) => svg.remove());

  doc.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    img.style.display = "block";
    img.style.objectFit = "contain";
    img.style.objectPosition = "center";
    img.style.maxWidth = "100%";
    img.style.height = "auto";
  });

  const resetStyle = doc.createElement("style");
  resetStyle.textContent = `
    * { color: ${safeInk} !important; background: #ffffff !important; background-image: none !important; box-shadow: none !important; text-shadow: none !important; filter: none !important; }
    * { border-color: ${safeBorder} !important; outline-color: ${safeInk} !important; }
    svg *, path, line, rect, circle { fill: ${safeInk} !important; stroke: ${safeInk} !important; }
  `;
  doc.head.appendChild(resetStyle);

  doc.body.style.background = "#ffffff";
  doc.body.style.backgroundImage = "none";

  doc.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const style = doc.defaultView?.getComputedStyle(el);
    if (!style) return;

    if (containsUnsupported(style.color)) el.style.color = safeInk;

    if (
      containsUnsupported(style.backgroundColor) ||
      containsUnsupported(style.backgroundImage)
    ) {
      el.style.backgroundColor = "#ffffff";
      el.style.backgroundImage = "none";
    }

    [
      "borderColor",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
    ].forEach((prop) => {
      const val = (style as unknown as Record<string, string>)[prop];
      if (containsUnsupported(val)) {
        (el.style as unknown as Record<string, string>)[prop] = safeBorder;
      }
    });

    if (containsUnsupported(style.outlineColor)) {
      el.style.outlineColor = safeInk;
    }

    if (containsUnsupported(style.boxShadow)) {
      el.style.boxShadow = "none";
    }

    if (containsUnsupported(style.textShadow)) {
      el.style.textShadow = "none";
    }

    if (containsUnsupported(style.fill)) {
      el.style.fill = safeInk;
    }

    if (containsUnsupported(style.stroke)) {
      el.style.stroke = safeInk;
    }
  });

  if (!options.sanitizeFormFields) return;

  doc
    .querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input, textarea, select")
    .forEach((field) => {
      const style = doc.defaultView?.getComputedStyle(field);
      const replacement = doc.createElement("span");
      const value =
        field instanceof HTMLInputElement && field.type === "checkbox"
          ? field.checked
            ? "Yes"
            : "No"
          : field.value;

      replacement.textContent = value || "-";
      replacement.style.display =
        style?.display === "block" ? "block" : "inline-block";
      replacement.style.minHeight = style?.height || "1.25rem";
      replacement.style.minWidth = style?.minWidth || style?.width || "3rem";
      replacement.style.padding = style?.padding || "0 0.25rem";
      replacement.style.margin = style?.margin || "0";
      replacement.style.borderBottom = `1px dashed ${safeBorder}`;
      replacement.style.color = safeInk;
      replacement.style.verticalAlign = "middle";
      replacement.style.font = style?.font || "500 13px/1.4 sans-serif";
      replacement.style.whiteSpace = "pre-wrap";

      field.replaceWith(replacement);
    });
};

export const downloadFormAsPdf = async (
  element: HTMLElement,
  title: string,
  options: PdfExportOptions = {},
) => {
  const {
    sanitizeFormFields = true,
    quality = 0.82,
    margin = 24,
    primaryScale = 1.5,
    fallbackScale = 1,
  } = options;

  await waitForImages(element);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: primaryScale,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: element.scrollWidth,
      height: element.scrollHeight,
      ignoreElements: (el) => el instanceof SVGElement,
      onclone: (doc) => sanitizeCloneForPdf(doc, { sanitizeFormFields }),
    });
  } catch {
    canvas = await html2canvas(element, {
      scale: fallbackScale,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
      ignoreElements: (el) => el instanceof SVGElement,
      onclone: (doc) => sanitizeCloneForPdf(doc, { sanitizeFormFields }),
    });
  }

  const pdf = new jsPDF("p", "pt", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
  const pageCanvasHeightPx = Math.max(
    1,
    Math.floor((pageHeight * canvas.width) / pageWidth),
  );

  let renderedHeight = 0;
  let pageIndex = 0;

  while (renderedHeight < canvas.height) {
    const sliceHeight = Math.min(
      pageCanvasHeightPx,
      canvas.height - renderedHeight,
    );
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;

    const context = sliceCanvas.getContext("2d");
    if (!context) {
      throw new Error("Could not initialize PDF canvas context.");
    }

    context.drawImage(
      canvas,
      0,
      renderedHeight,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );

    const imgData = sliceCanvas.toDataURL("image/jpeg", quality);
    const renderHeight = (sliceHeight * pageWidth) / canvas.width;

    if (pageIndex > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      imgData,
      "JPEG",
      margin,
      margin,
      pageWidth,
      renderHeight,
      undefined,
      "FAST",
    );

    renderedHeight += sliceHeight;
    pageIndex += 1;
  }

  const safeName = title.replace(/\s+/g, "-").toLowerCase();
  pdf.save(`${safeName}.pdf`);
};
