import { CARD_KIND_NAMES, type Card } from '../domain/card';
import { resolveActiveCardId, type Wallet } from '../domain/wallet';

/** Callbacks the Card Menu raises; the app owns the Wallet store and the view. */
export interface CardMenuHandlers {
  /** Activates the chosen Card; the menu closes itself afterwards. */
  onChoose(cardId: string): void;
  /** Opens the Private Backup sheet from the menu footer. */
  onOpenBackup(): void;
}

/** The mounted Card Menu: a modal list of every Card in the Wallet. */
export interface CardMenu {
  open(wallet: Wallet): void;
}

/** One row's content: the Card's label, and its kind when that adds information. */
function createRow(card: Card, isActive: boolean): HTMLLIElement {
  const item = document.createElement('li');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card-menu__row';
  button.dataset.cardId = card.id;
  if (isActive) {
    button.classList.add('card-menu__row--active');
    button.setAttribute('aria-current', 'true');
  }

  const label = document.createElement('span');
  label.className = 'card-menu__label';
  label.textContent = card.label;

  const kind = CARD_KIND_NAMES[card.source.kind];
  button.append(label);

  // A seeded "Visit Card" already says its kind; repeating it is noise.
  if (kind !== card.label) {
    const kindLine = document.createElement('span');
    kindLine.className = 'card-menu__kind';
    kindLine.textContent = kind;
    button.append(kindLine);
  }

  item.append(button);
  return item;
}

/**
 * Creates the Card Menu: a native modal `dialog` listing every Card.
 *
 * The menu is the Wallet's selector. It opens scrolled to the active Card with
 * that row focused, marks it with `aria-current`, and closes on a choice, the
 * close control, Esc, or a backdrop tap; `showModal()` returns focus to the
 * top bar's menu button. Choosing a Card only raises a handler — the app owns
 * the Wallet — and Backup closes the menu before opening its own sheet, so two
 * modal dialogs are never stacked.
 */
export function createCardMenu(host: HTMLElement, handlers: CardMenuHandlers): CardMenu {
  const dialog = document.createElement('dialog');
  dialog.className = 'card-menu';
  dialog.setAttribute('aria-labelledby', 'card-menu-title');

  const header = document.createElement('header');
  header.className = 'card-menu__header';

  const wordmark = document.createElement('p');
  wordmark.className = 'card-menu__wordmark';
  wordmark.textContent = 'QR Wallet';

  const title = document.createElement('h2');
  title.className = 'card-menu__title';
  title.id = 'card-menu-title';
  title.textContent = 'Cards';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'card-menu__close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';
  close.addEventListener('click', () => {
    dialog.close();
  });

  header.append(wordmark, title, close);

  const nav = document.createElement('nav');
  nav.className = 'card-menu__body';
  nav.setAttribute('aria-label', 'Cards');

  const list = document.createElement('ul');
  list.className = 'card-menu__list';

  const empty = document.createElement('p');
  empty.className = 'card-menu__empty';
  empty.textContent = 'No Cards yet.';
  empty.hidden = true;

  nav.append(list, empty);

  const footer = document.createElement('footer');
  footer.className = 'card-menu__footer';

  const backup = document.createElement('button');
  backup.type = 'button';
  backup.className = 'card-menu__backup';
  backup.setAttribute('aria-haspopup', 'dialog');
  backup.textContent = 'Backup';
  backup.addEventListener('click', () => {
    dialog.close();
    handlers.onOpenBackup();
  });

  footer.append(backup);

  dialog.append(header, nav, footer);
  host.append(dialog);

  // A tap outside the sheet lands on the <dialog> element itself. Unlike the
  // editor, the menu does dismiss on a backdrop tap: it holds no draft.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  function open(wallet: Wallet): void {
    const activeId = resolveActiveCardId(wallet);
    list.replaceChildren(
      ...wallet.cards.map((card) => createRow(card, card.id === activeId)),
    );

    const isEmpty = wallet.cards.length === 0;
    list.hidden = isEmpty;
    empty.hidden = !isEmpty;

    for (const button of list.querySelectorAll<HTMLButtonElement>('.card-menu__row')) {
      button.addEventListener('click', () => {
        const cardId = button.dataset.cardId;
        if (cardId !== undefined) {
          // Close first: the row that had focus is about to be re-rendered.
          dialog.close();
          handlers.onChoose(cardId);
        }
      });
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    const activeRow = list.querySelector<HTMLElement>('.card-menu__row--active');
    if (activeRow !== null) {
      activeRow.scrollIntoView({ block: 'center' });
      activeRow.focus();
    } else if (!isEmpty) {
      list.querySelector<HTMLElement>('.card-menu__row')?.focus();
    } else {
      close.focus();
    }
  }

  return { open };
}
