export type TemplateVariant = "editorial" | "split" | "bold" | "search";

export interface TemplateInput {
  width: number;
  height: number;
  variant: TemplateVariant;
  brandName: string;
  headline: string;
  subhead: string;
  cta: string;
  product: string;
  colors: string[];
  placement: string;
}

const FALLBACK = {
  forest: "#173D35",
  gold: "#D9C58D",
  ivory: "#F5F1E7",
  ink: "#24352E",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hex(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function palette(colors: string[]) {
  const forest = hex(colors[0], FALLBACK.forest);
  const gold = hex(colors[1], FALLBACK.gold);
  const ivory = hex(colors[2], FALLBACK.ivory);
  return { forest, gold, ivory };
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (Array.from(candidate).length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (words.length && lines.length === maxLines) {
    const consumed = lines.join(" ").split(" ").length;
    if (consumed < words.length) {
      lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/[.,;:!?]$/, "")}…`;
    }
  }
  return lines;
}

function tspans(lines: string[], x: number, y: number, lineHeight: number): string {
  return lines
    .map(
      (line, index) =>
        `<tspan x="${x}" y="${y + index * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");
}

function wordmark(x: number, y: number, fill: string, letterSpacing = 4, size = 22): string {
  return `<text x="${x}" y="${y}" font-family="Manrope, Arial, sans-serif" font-size="${size}" font-weight="600" letter-spacing="${letterSpacing}" fill="${fill}"></text>`;
}

function wordmarkText(x: number, y: number, text: string, fill: string, letterSpacing = 4, size = 22): string {
  return `<text x="${x}" y="${y}" font-family="Manrope, Arial, sans-serif" font-size="${size}" font-weight="600" letter-spacing="${letterSpacing}" fill="${fill}">${escapeXml(text.toUpperCase())}</text>`;
}

function ctaPill(x: number, y: number, label: string, background: string, foreground: string, width = 380): string {
  return `<g>
    <rect x="${x}" y="${y}" rx="${44}" width="${width}" height="76" fill="${background}" />
    <text x="${x + width / 2}" y="${y + 48}" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="0.5" fill="${foreground}">${escapeXml(label)}</text>
  </g>`;
}

function commonFrame(width: number, height: number, title: string, background: string): string {
  return `<rect width="${width}" height="${height}" fill="${background}" />
  <title>${escapeXml(title)}</title>`;
}

export function renderTemplateSvg(input: TemplateInput): string {
  const { forest, gold, ivory } = palette(input.colors);
  const padding = Math.round(input.width * 0.075);
  const safeBrand = input.brandName.trim() || "Your business";
  const safeCta = input.cta.trim() || "Learn more";
  const safeProduct = input.product.trim();

  if (input.variant === "split") {
    const headlineSize = Math.round(input.width * 0.085);
    const lines = wrap(input.headline, Math.round((input.width * 0.8) / (headlineSize * 0.52)), 3);
    const splitAt = Math.round(input.height * 0.6);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" role="img" aria-labelledby="title">
  ${commonFrame(input.width, input.height, `${safeBrand}: ${input.headline}`, ivory)}
  <rect width="${input.width}" height="${splitAt}" fill="${forest}" />
  <circle cx="${input.width - padding}" cy="${padding + 40}" r="${Math.round(input.width * 0.13)}" fill="${gold}" opacity="0.16" />
  ${wordmarkText(padding, padding + 18, safeBrand, gold, 5, Math.round(input.width * 0.022))}
  <text font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="${headlineSize}" font-weight="500" fill="${ivory}">
    ${tspans(lines, padding, splitAt - headlineSize * (lines.length - 1) - Math.round(input.height * 0.1), Math.round(headlineSize * 1.06))}
  </text>
  <rect x="${padding}" y="${splitAt}" width="${Math.round(input.width * 0.18)}" height="6" fill="${gold}" />
  <text x="${padding}" y="${splitAt + Math.round(input.height * 0.105)}" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.034)}" font-weight="700" fill="${forest}">${escapeXml(safeProduct)}</text>
  <text x="${padding}" y="${splitAt + Math.round(input.height * 0.16)}" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.024)}" fill="${FALLBACK.ink}" opacity="0.8">${escapeXml(input.subhead)}</text>
  ${ctaPill(padding, input.height - padding - 76, safeCta, forest, ivory, Math.round(input.width * 0.5))}
  <text x="${input.width - padding}" y="${input.height - padding - 24}" text-anchor="end" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.019)}" fill="${FALLBACK.ink}" opacity="0.55">${escapeXml(input.placement)}</text>
</svg>`;
  }

  if (input.variant === "bold") {
    const headlineSize = Math.round(input.width * 0.1);
    const lines = wrap(input.headline, Math.round((input.width * 0.82) / (headlineSize * 0.5)), 3);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" role="img" aria-labelledby="title">
  ${commonFrame(input.width, input.height, `${safeBrand}: ${input.headline}`, forest)}
  <circle cx="${Math.round(input.width * 0.82)}" cy="${Math.round(input.height * 0.26)}" r="${Math.round(input.width * 0.3)}" fill="none" stroke="${gold}" stroke-width="3" opacity="0.55" />
  <circle cx="${Math.round(input.width * 0.14)}" cy="${Math.round(input.height * 0.86)}" r="${Math.round(input.width * 0.2)}" fill="${gold}" opacity="0.1" />
  ${wordmarkText(padding, padding + 16, safeBrand, gold, 5, Math.round(input.width * 0.022))}
  <rect x="${padding}" y="${Math.round(input.height * 0.19)}" width="${Math.round(input.width * 0.1)}" height="5" fill="${gold}" />
  <text font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="${headlineSize}" font-weight="500" fill="${ivory}">
    ${tspans(lines, padding, Math.round(input.height * 0.31), Math.round(headlineSize * 1.05))}
  </text>
  <text x="${padding}" y="${Math.round(input.height * 0.66)}" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.026)}" fill="${ivory}" opacity="0.82">${escapeXml(input.subhead)}</text>
  ${ctaPill(padding, Math.round(input.height * 0.75), safeCta, gold, forest, Math.round(input.width * 0.48))}
  <text x="${input.width - padding}" y="${input.height - padding}" text-anchor="end" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.018)}" fill="${ivory}" opacity="0.55">${escapeXml(safeProduct)}</text>
</svg>`;
  }

  if (input.variant === "search") {
    const headlineSize = Math.round(input.width * 0.062);
    const lines = wrap(input.headline, Math.round((input.width * 0.52) / (headlineSize * 0.5)), 3);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" role="img" aria-labelledby="title">
  ${commonFrame(input.width, input.height, `${safeBrand}: ${input.headline}`, ivory)}
  <rect x="0" y="0" width="${Math.round(input.width * 0.012)}" height="${input.height}" fill="${forest}" />
  <rect x="${Math.round(input.width * 0.62)}" y="${Math.round(input.height * 0.12)}" width="${Math.round(input.width * 0.31)}" height="${Math.round(input.height * 0.76)}" rx="28" fill="${forest}" />
  <circle cx="${Math.round(input.width * 0.775)}" cy="${Math.round(input.height * 0.38)}" r="${Math.round(input.width * 0.085)}" fill="none" stroke="${gold}" stroke-width="2.5" />
  <path d="M ${Math.round(input.width * 0.72)} ${Math.round(input.height * 0.5)} Q ${Math.round(input.width * 0.775)} ${Math.round(input.height * 0.33)} ${Math.round(input.width * 0.83)} ${Math.round(input.height * 0.5)}" fill="none" stroke="${gold}" stroke-width="2.5" />
  <text x="${Math.round(input.width * 0.775)}" y="${Math.round(input.height * 0.78)}" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.016)}" letter-spacing="3" fill="${gold}">${escapeXml(safeProduct.toUpperCase().slice(0, 28))}</text>
  ${wordmarkText(padding, Math.round(input.height * 0.16), safeBrand, forest, 4, Math.round(input.width * 0.018))}
  <text font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="${headlineSize}" font-weight="500" fill="${forest}">
    ${tspans(lines, padding, Math.round(input.height * 0.36), Math.round(headlineSize * 1.1))}
  </text>
  <text x="${padding}" y="${Math.round(input.height * 0.66)}" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.019)}" fill="${FALLBACK.ink}" opacity="0.8">${escapeXml(input.subhead)}</text>
  ${ctaPill(padding, Math.round(input.height * 0.76), safeCta, forest, ivory, Math.round(input.width * 0.3))}
</svg>`;
  }

  // editorial (default)
  const headlineSize = Math.round(input.width * 0.088);
  const lines = wrap(input.headline, Math.round((input.width * 0.82) / (headlineSize * 0.5)), 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" role="img" aria-labelledby="title">
  ${commonFrame(input.width, input.height, `${safeBrand}: ${input.headline}`, ivory)}
  <path d="M ${Math.round(input.width * 0.7)} 0 Q ${Math.round(input.width * 0.92)} ${Math.round(input.height * 0.18)} ${input.width} ${Math.round(input.height * 0.12)}" fill="none" stroke="${gold}" stroke-width="2" opacity="0.6" />
  ${wordmarkText(padding, padding + 14, safeBrand, forest, 5, Math.round(input.width * 0.022))}
  <text x="${input.width - padding}" y="${padding + 14}" text-anchor="end" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.018)}" letter-spacing="3" fill="${FALLBACK.ink}" opacity="0.5">${escapeXml(input.placement.toUpperCase())}</text>
  <rect x="${padding}" y="${Math.round(input.height * 0.16)}" width="${Math.round(input.width * 0.12)}" height="4" fill="${gold}" />
  <text font-family="Fraunces, Georgia, 'Times New Roman', serif" font-size="${headlineSize}" font-weight="500" fill="${forest}">
    ${tspans(lines, padding, Math.round(input.height * 0.26), Math.round(headlineSize * 1.06))}
  </text>
  <text x="${padding}" y="${Math.round(input.height * 0.5)}" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.026)}" fill="${FALLBACK.ink}" opacity="0.78">${escapeXml(input.subhead)}</text>
  <rect x="${padding}" y="${Math.round(input.height * 0.6)}" width="${input.width - padding * 2}" height="${Math.round(input.height * 0.28)}" rx="18" fill="${forest}" />
  <circle cx="${input.width - padding - Math.round(input.width * 0.1)}" cy="${Math.round(input.height * 0.74)}" r="${Math.round(input.width * 0.11)}" fill="none" stroke="${gold}" stroke-width="2" opacity="0.5" />
  <text x="${padding + Math.round(input.width * 0.05)}" y="${Math.round(input.height * 0.7)}" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.032)}" font-weight="700" fill="${ivory}">${escapeXml(safeProduct)}</text>
  <text x="${padding + Math.round(input.width * 0.05)}" y="${Math.round(input.height * 0.765)}" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.021)}" fill="${gold}">${escapeXml(input.subhead)}</text>
  ${ctaPill(padding, Math.round(input.height * 0.84), safeCta, gold, forest, Math.round(input.width * 0.42))}
  <text x="${input.width - padding}" y="${input.height - padding}" text-anchor="end" font-family="Manrope, Arial, sans-serif" font-size="${Math.round(input.width * 0.018)}" fill="${FALLBACK.ink}" opacity="0.5">${escapeXml(safeBrand)}</text>
</svg>`;
}
