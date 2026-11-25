import type { Card, CardKind } from '../domain/card';
import { derivePayload } from '../domain/payload';
import type { Wallet } from '../domain/wallet';
import { activeCard } from '../domain/wallet';
import { renderQrSvg } from '../qr/render';

/** The short subtitle shown under the active Card's label. */
export function subtitleForKind(kind: CardKind): string {
  switch (kind) {
    case 'visit':
      return 'Contact details';
    case 'link':
      return 'Link';
    case 'text':
      return 'Text';
  }
}

function createHeading(card: Card): HTMLElement {
  const heading = document.createElement('header');
  heading.className = 'wallet-view__heading';

  const label = document.createElement('h1');
  label.className = 'wallet-view__label';
  label.id = 'active-card-label';
  label.textContent = card.label;

  const subtitle = document.createElement('p');
  subtitle.className = 'wallet-view__subtitle';
  subtitle.textContent = subtitleForKind(card.source.kind);

  heading.append(label, subtitle);
  return heading;
}

/**
 * The QR Panel: a pure white surface holding the black QR code. The inline SVG
 * carries no colours of its own, so it is never themed or inverted.
 */
function createQrPanel(card: Card): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'qr-panel';
  panel.setAttribute('aria-labelledby', 'active-card-label');

  const code = document.createElement('div');
  code.className = 'qr-panel__code';

  // renderQrSvg guards the markup before it reaches innerHTML; the SVG is a bare
  // `<svg viewBox>` with one `<path>` and never contains the Payload.
  code.innerHTML = renderQrSvg(derivePayload(card));

  const svg = code.querySelector('svg');
  if (svg !== null) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `QR code for ${card.label}`);
  }

  panel.append(code);
  return panel;
}

function createEmptyState(): HTMLElement {
  const empty = document.createElement('p');
  empty.className = 'wallet-view__empty';
  empty.textContent = 'No Cards yet.';
  return empty;
}

/**
 * Renders the main view: the active Card's label and subtitle plus its QR Panel.
 * Pills, actions, and the footer arrive in later tickets.
 */
export function renderMainView(root: HTMLElement, wallet: Wallet): void {
  const view = document.createElement('main');
  view.className = 'wallet-view';

  const card = activeCard(wallet);
  if (card === null) {
    view.append(createEmptyState());
  } else {
    view.append(createHeading(card), createQrPanel(card));
  }

  root.replaceChildren(view);
}
