/** A mounted update notice; `show` is idempotent. */
export interface UpdateNotice {
  show(): void;
  dismiss(): void;
}

/** The notice class root; styles live in the ticket #8 section of styles.css. */
const NOTICE_CLASS = 'update-notice';

/**
 * The unobtrusive "a new version is ready" notice.
 *
 * It is a polite live region appended to the document, with a Reload button and
 * a Dismiss button. The page is never reloaded automatically: reloading is only
 * ever a deliberate user action, so an owner mid-scan is never interrupted.
 */
export function createUpdateNotice(doc: Document): UpdateNotice {
  let notice: HTMLElement | null = null;

  function dismiss(): void {
    notice?.remove();
    notice = null;
  }

  function show(): void {
    if (notice !== null) {
      return;
    }

    const element = doc.createElement('div');
    element.className = NOTICE_CLASS;
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');

    const message = doc.createElement('p');
    message.className = `${NOTICE_CLASS}__message`;
    message.textContent = 'A new version is available.';

    const reload = doc.createElement('button');
    reload.type = 'button';
    reload.className = `${NOTICE_CLASS}__button update-notice__button--primary`;
    reload.textContent = 'Reload';
    reload.addEventListener('click', () => {
      // The one and only reload path; controllerchange never reloads by itself.
      doc.defaultView?.location.reload();
    });

    const close = doc.createElement('button');
    close.type = 'button';
    close.className = `${NOTICE_CLASS}__button`;
    close.textContent = 'Dismiss';
    close.addEventListener('click', dismiss);

    element.append(message, reload, close);
    doc.body.append(element);
    notice = element;
  }

  return { show, dismiss };
}
