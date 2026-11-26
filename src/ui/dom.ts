const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** One stroked shape in a decorative 24×24 icon: a path or a circle. */
export type StrokeShape =
  | { readonly path: string }
  | { readonly circle: { readonly cx: number; readonly cy: number; readonly r: number } };

/**
 * Builds a decorative stroked icon at the app's single 24×24 grid.
 *
 * The stroke itself lives in CSS (`.icon` and the vault glyph), so this helper
 * carries only geometry. It is always aria-hidden: every control that holds one
 * carries its own accessible name.
 */
export function createStrokeIcon(className: string, shapes: readonly StrokeShape[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add(className);

  for (const shape of shapes) {
    if ('circle' in shape) {
      const circle = document.createElementNS(SVG_NAMESPACE, 'circle');
      circle.setAttribute('cx', String(shape.circle.cx));
      circle.setAttribute('cy', String(shape.circle.cy));
      circle.setAttribute('r', String(shape.circle.r));
      svg.append(circle);
      continue;
    }
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', shape.path);
    svg.append(path);
  }

  return svg;
}

/** Creates a non-submitting button with a class name and text. */
export function createButton(text: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  return button;
}

/** The × close control every sheet shares; it closes its dialog on press. */
export function createCloseButton(className: string, onClose: () => void): HTMLButtonElement {
  const button = createButton('×', className);
  button.setAttribute('aria-label', 'Close');
  button.addEventListener('click', onClose);
  return button;
}

/**
 * A short, human message for a thrown store, validation, or download failure.
 * The fallback is used when the thrown value is not an Error carrying a message.
 */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
