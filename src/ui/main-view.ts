import type { Card, CardKind } from '../domain/card';
import { derivePayload } from '../domain/payload';
import { resolveActiveCardId, type Wallet } from '../domain/wallet';
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

/** Callbacks the main view raises; the app wires them to the Wallet store and dialogs. */
export interface MainViewHandlers {
  /**
   * Activates the Card whose Pill was pressed and returns the updated Wallet.
   * The view swaps the QR Panel, label, and subtitle in place with that Wallet.
   */
  onSelectCard(cardId: string): Wallet;
  /** Opens the Card editor. Wired in ticket #4; the "+ New" Pill is present now. */
  onNewCard?(): void;
}

/** A mounted main view that re-renders in place when the Wallet changes. */
export interface MainView {
  update(wallet: Wallet): void;
}

const ACTIVE_PILL_CLASS = 'wallet-view__pill--active';

function createPill(card: Card, onSelect: (cardId: string) => void): HTMLButtonElement {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'wallet-view__pill';
  pill.dataset.cardId = card.id;
  pill.textContent = card.label;
  pill.setAttribute('aria-pressed', 'false');
  pill.addEventListener('click', () => {
    onSelect(card.id);
  });
  return pill;
}

/**
 * The "+ New" Pill is present in every Wallet state, including empty, so creating
 * a Card is always discoverable. Ticket #4 wires it to the native dialog.
 */
function createNewPill(handlers: MainViewHandlers): HTMLButtonElement {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'wallet-view__pill wallet-view__pill--new';
  pill.textContent = '+ New';
  pill.setAttribute('aria-haspopup', 'dialog');
  pill.addEventListener('click', () => {
    handlers.onNewCard?.();
  });
  return pill;
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

/** The empty state: no active Card, one call to action, and the "+ New" Pill above it. */
function createEmptyState(handlers: MainViewHandlers): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'wallet-view__empty';

  const message = document.createElement('p');
  message.className = 'wallet-view__empty-message';
  message.textContent = 'No Cards yet.';

  const create = document.createElement('button');
  create.type = 'button';
  create.className = 'wallet-view__create';
  create.textContent = 'Create a Card';
  create.setAttribute('aria-haspopup', 'dialog');
  create.addEventListener('click', () => {
    handlers.onNewCard?.();
  });

  empty.append(message, create);
  return empty;
}

/**
 * Renders the main view and returns a handle that re-renders it in place.
 *
 * The Pill selector stays mounted across Wallet updates, so pressing a Pill
 * swaps the QR Panel, label, and subtitle immediately — no network, no reload —
 * and keyboard focus stays on the pressed Pill. A Wallet with no Cards renders
 * the empty state and no active Card.
 */
export function renderMainView(
  root: HTMLElement,
  wallet: Wallet,
  handlers: MainViewHandlers,
): MainView {
  const view = document.createElement('main');
  view.className = 'wallet-view';

  const selector = document.createElement('div');
  selector.className = 'wallet-view__selector';
  selector.setAttribute('role', 'group');
  selector.setAttribute('aria-label', 'Cards');

  const content = document.createElement('div');
  content.className = 'wallet-view__content';

  view.append(selector, content);
  root.replaceChildren(view);

  /** Distinct Cards and labels need a fresh set of Pills; active-id changes do not. */
  function cardSignature(current: Wallet): string {
    return current.cards.map((card) => `${card.id}\u0000${card.label}`).join('\u0001');
  }

  function focusedCardId(): string | null {
    return document.activeElement instanceof HTMLElement
      ? (document.activeElement.dataset.cardId ?? null)
      : null;
  }

  function focusCardPill(cardId: string): void {
    for (const pill of selector.querySelectorAll<HTMLElement>('[data-card-id]')) {
      if (pill.dataset.cardId === cardId) {
        pill.focus();
        return;
      }
    }
  }

  function rebuildSelector(next: Wallet): void {
    const previousFocus = focusedCardId();
    selector.replaceChildren(
      ...next.cards.map((card) => createPill(card, activate)),
      createNewPill(handlers),
    );
    if (previousFocus !== null) {
      focusCardPill(previousFocus);
    }
  }

  function updatePills(activeId: string | null): void {
    for (const pill of selector.querySelectorAll<HTMLButtonElement>('[data-card-id]')) {
      const isActive = pill.dataset.cardId === activeId;
      pill.classList.toggle(ACTIVE_PILL_CLASS, isActive);
      pill.setAttribute('aria-pressed', String(isActive));
    }
  }

  function renderContent(next: Wallet, activeId: string | null): void {
    const card = next.cards.find((candidate) => candidate.id === activeId) ?? null;
    content.replaceChildren(
      ...(card === null ? [createEmptyState(handlers)] : [createHeading(card), createQrPanel(card)]),
    );
  }

  let selectorSignature: string | null = null;

  /** Activates a Card through the store callback and re-renders in place. */
  function activate(cardId: string): void {
    update(handlers.onSelectCard(cardId));
  }

  function update(next: Wallet): void {
    // An unresolvable id (which the Wallet store repairs on load) falls back to
    // the first Card rather than rendering a selector with nothing selected.
    const activeId = resolveActiveCardId(next);

    const signature = cardSignature(next);
    if (signature !== selectorSignature) {
      rebuildSelector(next);
      selectorSignature = signature;
    }
    updatePills(activeId);
    renderContent(next, activeId);
  }

  update(wallet);

  return { update };
}
