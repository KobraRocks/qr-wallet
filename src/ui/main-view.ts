import { CARD_KIND_NAMES, cardDisplayName, type Card } from '../domain/card';
import { resolveActiveCardId, type Wallet } from '../domain/wallet';
import { cardQrSvg } from '../qr/card-svg';

/** Callbacks the main view raises; the app wires them to the Wallet store and dialogs. */
export interface MainViewHandlers {
  /** Activates a Card and returns the updated Wallet. */
  onSelectCard(cardId: string): Wallet;
  /** Opens the editor for a new Card; it becomes active once saved. */
  onNewCard(): void;
  /** Opens the Card Menu over the main view. */
  onOpenMenu(): void;
  /** Opens the editor pre-filled with the given Card. */
  onEditCard(card: Card): void;
  /** Copies the given Card's exact Payload and reports the result. */
  onCopyPayload(card: Card): void;
  /** Shares the given Card's QR SVG, or downloads it when sharing is unavailable. */
  onShareCard(card: Card): void;
}

/** A mounted main view that re-renders in place when the Wallet changes. */
export interface MainView {
  update(wallet: Wallet): void;
  /**
   * Places focus after the editor closes from a save or a delete: the dock's
   * Edit action while a Card is shown, otherwise the empty state's create
   * action. Cancel and Esc keep the browser's native focus return instead.
   */
  focusAfterClose(cardId: string | null): void;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Builds a stroked, decorative icon. It is always aria-hidden: every control
 * that holds one carries its own accessible name.
 */
function createIcon(viewBox: string, pathData: readonly string[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon');
  for (const data of pathData) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', data);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
  }
  return svg;
}

const MENU_ICON = ['M4 7h16', 'M4 12h16', 'M4 17h16'];
const PREVIOUS_ICON = ['M15 5l-7 7 7 7'];
const NEXT_ICON = ['M9 5l7 7-7 7'];

/** The pager: previous, a position counter, next. Hidden while one Card exists. */
interface Pager {
  readonly element: HTMLElement;
  update(wallet: Wallet): void;
}

function createPager(onSwap: (direction: -1 | 1) => void): Pager {
  const element = document.createElement('nav');
  element.className = 'wallet-pager';
  element.setAttribute('aria-label', 'Card pager');

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'wallet-pager__step';
  previous.setAttribute('aria-label', 'Previous Card');
  previous.append(createIcon('0 0 24 24', PREVIOUS_ICON));
  previous.addEventListener('click', () => {
    onSwap(-1);
  });

  // The visible counter and the announcement live in one polite region: sighted
  // owners see "2 / 5", screen readers hear which Card is showing.
  const counter = document.createElement('p');
  counter.className = 'wallet-pager__count';
  counter.setAttribute('aria-live', 'polite');
  counter.setAttribute('aria-atomic', 'true');

  const visibleCount = document.createElement('span');
  visibleCount.setAttribute('aria-hidden', 'true');
  const announcedCount = document.createElement('span');
  announcedCount.className = 'visually-hidden';
  counter.append(visibleCount, announcedCount);

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'wallet-pager__step';
  next.setAttribute('aria-label', 'Next Card');
  next.append(createIcon('0 0 24 24', NEXT_ICON));
  next.addEventListener('click', () => {
    onSwap(1);
  });

  element.append(previous, counter, next);

  function update(wallet: Wallet): void {
    const index = wallet.cards.findIndex((card) => card.id === resolveActiveCardId(wallet));
    const total = wallet.cards.length;
    element.hidden = total < 2;
    if (total < 2 || index < 0) {
      return;
    }
    const card = wallet.cards[index];
    visibleCount.textContent = `${index + 1} / ${total}`;
    announcedCount.textContent = `Card ${index + 1} of ${total}: ${
      card === undefined ? '' : cardDisplayName(card)
    }`;
    previous.disabled = index === 0;
    next.disabled = index === total - 1;
  }

  return { element, update };
}

/**
 * The top bar: the Card Menu on the left, the pager in the centre, and the New
 * Card control on the right. It is built once and never re-created, so focus
 * survives every Wallet update.
 */
function createTopBar(handlers: MainViewHandlers, pager: Pager): HTMLElement {
  const bar = document.createElement('header');
  bar.className = 'wallet-top-bar';

  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'wallet-top-bar__control';
  menu.setAttribute('aria-label', 'Cards');
  menu.setAttribute('aria-haspopup', 'dialog');
  menu.append(createIcon('0 0 24 24', MENU_ICON));
  menu.addEventListener('click', () => {
    handlers.onOpenMenu();
  });

  const create = document.createElement('button');
  create.type = 'button';
  create.className = 'wallet-top-bar__control wallet-top-bar__new';
  create.setAttribute('aria-label', 'New Card');
  create.setAttribute('aria-haspopup', 'dialog');
  create.append(createIcon('0 0 24 24', ['M12 5v14', 'M5 12h14']));
  create.addEventListener('click', () => {
    handlers.onNewCard();
  });

  bar.append(menu, pager.element, create);
  return bar;
}

/** The Card Face: Display Name, a kind · organization subtitle, and the QR Panel. */
interface CardFace {
  readonly element: HTMLElement;
  show(card: Card): void;
}

function createCardFace(): CardFace {
  const face = document.createElement('article');
  face.className = 'card-face';

  // Four machined corners, drawn on the titanium frame. They are decoration
  // outside the alabaster inset and never touch the code's quiet zone.
  for (const corner of ['tl', 'tr', 'bl', 'br'] as const) {
    const bracket = document.createElement('span');
    bracket.className = 'card-face__bracket';
    bracket.dataset.corner = corner;
    bracket.setAttribute('aria-hidden', 'true');
    face.append(bracket);
  }

  const name = document.createElement('h1');
  name.className = 'card-face__name';
  name.id = 'active-card-name';

  const subtitle = document.createElement('p');
  subtitle.className = 'card-face__subtitle';

  const panel = document.createElement('section');
  panel.className = 'qr-panel';
  panel.setAttribute('aria-labelledby', 'active-card-name');

  face.append(name, subtitle, panel);

  function show(card: Card): void {
    name.textContent = cardDisplayName(card);
    const organization = card.source.kind === 'visit' ? card.source.organization.trim() : '';
    subtitle.textContent =
      organization === ''
        ? CARD_KIND_NAMES[card.source.kind]
        : `${CARD_KIND_NAMES[card.source.kind]} · ${organization}`;

    // The SVG is a bare `<svg viewBox>` with one `<path>` and never contains the
    // Payload in markup; cardQrSvg guards it before it reaches innerHTML.
    panel.innerHTML = cardQrSvg(card);
    const svg = panel.querySelector('svg');
    if (svg !== null) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', `QR code for ${cardDisplayName(card)}`);
    }
  }

  return { element: face, show };
}

/** One dock action; `label` is visible, `accessibleName` completes it when needed. */
function createDockAction(
  label: string,
  accessibleName: string | null,
  icon: readonly string[],
  onPress: () => void,
): HTMLLIElement {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'action-dock__action';
  if (accessibleName !== null) {
    button.setAttribute('aria-label', accessibleName);
  }
  const text = document.createElement('span');
  text.className = 'action-dock__label';
  text.textContent = label;
  button.append(createIcon('0 0 24 24', icon), text);
  button.addEventListener('click', onPress);
  item.append(button);
  return item;
}

/** The floating dock of actions for the Card the face is showing. */
interface Dock {
  readonly element: HTMLElement;
  setActiveCard(card: Card | null): void;
}

function createDock(handlers: MainViewHandlers): Dock {
  const dock = document.createElement('div');
  dock.className = 'action-dock';
  dock.setAttribute('role', 'group');
  dock.setAttribute('aria-label', 'Card actions');

  let activeCard: Card | null = null;

  const list = document.createElement('ul');
  list.className = 'action-dock__list';

  const edit = createDockAction('Edit', null, ['M4 20l4.5-1 10-10-3.5-3.5-10 10L4 20z'], () => {
    if (activeCard !== null) {
      handlers.onEditCard(activeCard);
    }
  });
  const copy = createDockAction(
    'Copy',
    'Copy Payload',
    ['M9 9h10v10H9z', 'M15 9V5H5v10h4'],
    () => {
      if (activeCard !== null) {
        handlers.onCopyPayload(activeCard);
      }
    },
  );
  const share = createDockAction(
    'Share',
    null,
    ['M12 16V4', 'M8 8l4-4 4 4', 'M5 14v5h14v-5'],
    () => {
      if (activeCard !== null) {
        handlers.onShareCard(activeCard);
      }
    },
  );

  list.append(edit, copy, share);
  dock.append(list);

  return {
    element: dock,
    setActiveCard(card) {
      activeCard = card;
      dock.hidden = card === null;
    },
  };
}

/** The empty state: no active Card, one call to action, and the top bar above it. */
function createEmptyState(handlers: MainViewHandlers): HTMLElement {
  const empty = document.createElement('section');
  empty.className = 'empty-state';

  const message = document.createElement('p');
  message.className = 'empty-state__message';
  message.textContent = 'No Cards yet.';

  const create = document.createElement('button');
  create.type = 'button';
  create.className = 'empty-state__create';
  create.textContent = 'Create a Card';
  create.setAttribute('aria-haspopup', 'dialog');
  create.addEventListener('click', () => {
    handlers.onNewCard();
  });

  empty.append(message, create);
  return empty;
}

/**
 * Renders the main view and returns a handle that updates it in place.
 *
 * The top bar, card face, dock, and empty state stay mounted: a Wallet update
 * changes text and the QR markup only, so focus is never lost and no Card Menu
 * or dialog loses its trigger. A Wallet with no Cards hides the face, the dock,
 * and the pager, and shows the empty state.
 */
export function renderMainView(
  root: HTMLElement,
  wallet: Wallet,
  handlers: MainViewHandlers,
): MainView {
  const view = document.createElement('main');
  view.className = 'wallet-view';

  const face = createCardFace();
  const empty = createEmptyState(handlers);
  const dock = createDock(handlers);
  const pager = createPager((direction) => {
    swap(direction);
  });
  const topBar = createTopBar(handlers, pager);

  view.append(topBar, face.element, empty, dock.element);
  root.replaceChildren(view);

  let currentWallet: Wallet = wallet;

  /** Moves to the neighbouring Card, clamped at both ends. */
  function swap(direction: -1 | 1): void {
    const index = currentWallet.cards.findIndex(
      (card) => card.id === resolveActiveCardId(currentWallet),
    );
    const target = currentWallet.cards[index + direction];
    if (index < 0 || target === undefined) {
      return;
    }
    update(handlers.onSelectCard(target.id));
  }

  function update(next: Wallet): void {
    currentWallet = next;
    const activeId = resolveActiveCardId(next);
    const card = next.cards.find((candidate) => candidate.id === activeId) ?? null;

    face.element.hidden = card === null;
    empty.hidden = card !== null;
    dock.setActiveCard(card);
    pager.update(next);

    if (card !== null) {
      face.show(card);
    }
  }

  function focusAfterClose(cardId: string | null): void {
    if (cardId === null) {
      if (!empty.hidden) {
        empty.querySelector<HTMLElement>('.empty-state__create')?.focus();
        return;
      }
      view.querySelector<HTMLElement>('.wallet-top-bar__new')?.focus();
      return;
    }
    dock.element.querySelector<HTMLElement>('.action-dock__action')?.focus();
  }

  update(wallet);

  return { update, focusAfterClose };
}
