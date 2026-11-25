import { createCardId, MAX_LABEL_LENGTH, type Card, type CardKind } from '../domain/card';
import {
  type CardDraft,
  type DraftErrorKey,
  type DraftErrors,
  draftFromCard,
  newCardDraft,
  validateDraft,
  type VisitCardDraft,
} from '../domain/card-draft';
import type { Wallet } from '../domain/wallet';

/** The human name of each Card Kind, used for the dialog title and the kind switcher. */
const KIND_NAME = {
  visit: 'Visit Card',
  link: 'Link',
  text: 'Text',
} satisfies Record<CardKind, string>;

/** Callbacks the dialog raises; the app owns the Wallet store and the main view. */
export interface CardDialogHandlers {
  /**
   * Persists a new or edited Card and re-renders the main view. Throwing keeps
   * the dialog open and shows the message inline.
   */
  onSave(card: Card): void;
  /** Deletes a Card and re-renders the main view. Throwing keeps the dialog open. */
  onDelete(cardId: string): void;
  /** Runs after the dialog closes, so the app can move focus after a save or delete. */
  onClosed(): void;
}

/** The mounted Card editor: one native modal dialog shared by "+ New" and Edit. */
export interface CardDialog {
  /** Opens the editor empty, pre-filled with a sensible default label. */
  openNew(wallet: Wallet): void;
  /** Opens the editor pre-filled with the Card's current values. */
  openEdit(card: Card): void;
}

interface FieldOptions {
  readonly id: string;
  readonly label: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly maxLength?: number;
}

/** One labelled text input with its own inline error slot. */
interface FormField {
  readonly wrapper: HTMLElement;
  readonly input: HTMLInputElement;
  readonly error: HTMLParagraphElement;
  setError(message: string | undefined): void;
}

function createField(options: FieldOptions): FormField {
  const wrapper = document.createElement('div');
  wrapper.className = 'card-dialog__field';

  const label = document.createElement('label');
  label.className = 'card-dialog__field-label';
  label.htmlFor = options.id;
  label.textContent = options.label;

  const input = document.createElement('input');
  input.id = options.id;
  input.name = options.id;
  input.className = 'card-dialog__input';
  input.type = 'text';
  if (options.maxLength !== undefined) {
    input.maxLength = options.maxLength;
  }
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    input.setAttribute(name, value);
  }

  const error = document.createElement('p');
  error.className = 'card-dialog__error';
  error.id = `${options.id}-error`;
  error.setAttribute('role', 'alert');
  error.hidden = true;

  wrapper.append(label, input, error);

  return {
    wrapper,
    input,
    error,
    setError(message) {
      error.textContent = message ?? '';
      error.hidden = message === undefined;
      if (message === undefined) {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      } else {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', error.id);
      }
    },
  };
}

function createButton(text: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  return button;
}

/** A short, human message for a store or validation failure thrown during Save/Delete. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The Wallet could not be updated.';
}

/**
 * Creates the native `<dialog>` Card editor, shared by "+ New" and Edit.
 *
 * The dialog is opened modally with `showModal()`, so the browser traps focus,
 * closes on Esc, restores focus to the trigger on close, and never light
 * dismisses on a backdrop click. Validation is inline: Save keeps the dialog
 * open on error and the Wallet is only touched through the handlers.
 */
export function createCardDialog(host: HTMLElement, handlers: CardDialogHandlers): CardDialog {
  const dialog = document.createElement('dialog');
  dialog.className = 'card-dialog';
  dialog.setAttribute('aria-labelledby', 'card-dialog-title');

  const form = document.createElement('form');
  form.className = 'card-dialog__form';
  // Validation is inline, so the native constraint UI must stay out of the way.
  form.noValidate = true;

  const title = document.createElement('h2');
  title.className = 'card-dialog__title';
  title.id = 'card-dialog-title';

  const fields = document.createElement('div');
  fields.className = 'card-dialog__fields';

  const labelField = createField({
    id: 'card-dialog-label',
    label: 'Label',
    maxLength: MAX_LABEL_LENGTH,
    attributes: { autocomplete: 'off', placeholder: 'For example, Visit Card' },
  });
  const firstNameField = createField({
    id: 'card-dialog-first-name',
    label: 'First name',
    attributes: { autocomplete: 'given-name', autocapitalize: 'words' },
  });
  const lastNameField = createField({
    id: 'card-dialog-last-name',
    label: 'Last name',
    attributes: { autocomplete: 'family-name', autocapitalize: 'words' },
  });
  const organizationField = createField({
    id: 'card-dialog-organization',
    label: 'Organization',
    attributes: { autocomplete: 'organization' },
  });
  const jobTitleField = createField({
    id: 'card-dialog-title-field',
    label: 'Title',
    attributes: { autocomplete: 'organization-title' },
  });
  const phoneField = createField({
    id: 'card-dialog-phone',
    label: 'Phone',
    attributes: { type: 'tel', inputmode: 'tel', autocomplete: 'tel' },
  });
  const emailField = createField({
    id: 'card-dialog-email',
    label: 'Email',
    attributes: {
      type: 'email',
      inputmode: 'email',
      autocomplete: 'email',
      autocapitalize: 'none',
      spellcheck: 'false',
    },
  });
  const websiteField = createField({
    id: 'card-dialog-website',
    label: 'Website',
    attributes: {
      type: 'url',
      inputmode: 'url',
      autocomplete: 'url',
      autocapitalize: 'none',
      autocorrect: 'off',
      spellcheck: 'false',
      placeholder: 'example.com',
    },
  });

  const nameRow = document.createElement('div');
  nameRow.className = 'card-dialog__name-row';
  nameRow.append(firstNameField.wrapper, lastNameField.wrapper);

  // The Visit Card fields. Ticket #5 adds the Link and Text field groups and the
  // kind switcher, showing the group that matches the draft's selected kind.
  const visitFields = document.createElement('div');
  visitFields.className = 'card-dialog__kind-fields';
  visitFields.dataset.kind = 'visit';
  visitFields.append(
    nameRow,
    organizationField.wrapper,
    jobTitleField.wrapper,
    phoneField.wrapper,
    emailField.wrapper,
    websiteField.wrapper,
  );

  fields.append(labelField.wrapper, visitFields);

  const formError = document.createElement('p');
  formError.className = 'card-dialog__error card-dialog__form-error';
  formError.id = 'card-dialog-form-error';
  formError.setAttribute('role', 'alert');
  formError.hidden = true;

  // Delete lives inside the dialog as an inline, two-step confirmation: the
  // first button reveals the confirmation, and only its Delete removes the Card.
  const deleteZone = document.createElement('div');
  deleteZone.className = 'card-dialog__delete';

  const deleteButton = createButton('Delete Card', 'card-dialog__button card-dialog__button--danger');

  const deleteConfirm = document.createElement('div');
  deleteConfirm.className = 'card-dialog__delete-confirm';
  deleteConfirm.setAttribute('role', 'group');
  deleteConfirm.hidden = true;

  const deleteQuestion = document.createElement('p');
  deleteQuestion.className = 'card-dialog__delete-question';
  deleteQuestion.id = 'card-dialog-delete-question';
  deleteQuestion.textContent = 'Delete this Card? This cannot be undone.';

  const confirmDeleteButton = createButton(
    'Delete',
    'card-dialog__button card-dialog__button--danger',
  );
  const keepButton = createButton('Keep', 'card-dialog__button');

  deleteConfirm.setAttribute('aria-labelledby', deleteQuestion.id);
  deleteConfirm.append(deleteQuestion, confirmDeleteButton, keepButton);
  deleteZone.append(deleteButton, deleteConfirm);

  const actions = document.createElement('div');
  actions.className = 'card-dialog__actions';

  const cancelButton = createButton('Cancel', 'card-dialog__button');
  const saveButton = createButton('Save', 'card-dialog__button card-dialog__button--primary');
  saveButton.type = 'submit';

  actions.append(cancelButton, saveButton);

  form.append(title, fields, formError, deleteZone, actions);
  dialog.append(form);
  host.append(dialog);

  /** Edits an existing Card; null while creating a new one. */
  let editingCard: Card | null = null;

  /**
   * The draft the dialog opened with. Until ticket #5 adds the Link and Text
   * fields, a Link or Text Card can still be renamed and deleted here: only the
   * Label is editable and the stored payload source is carried through unchanged.
   */
  let currentDraft: CardDraft | null = null;

  const allFields: readonly FormField[] = [
    labelField,
    firstNameField,
    lastNameField,
    organizationField,
    jobTitleField,
    phoneField,
    emailField,
    websiteField,
  ];

  /** The fields that can show a specific draft error inline. */
  const errorFields: Partial<Record<DraftErrorKey, FormField>> = {
    label: labelField,
    website: websiteField,
  };

  function clearErrors(): void {
    for (const field of allFields) {
      field.setError(undefined);
    }
    formError.textContent = '';
    formError.hidden = true;
  }

  function setFormError(message: string): void {
    formError.textContent = message;
    formError.hidden = message === '';
  }

  /** Marks the second name input invalid without duplicating the shared name message. */
  function markLastNameInvalid(describedBy: string): void {
    lastNameField.input.setAttribute('aria-invalid', 'true');
    lastNameField.input.setAttribute('aria-describedby', describedBy);
  }

  function showErrors(errors: DraftErrors): void {
    clearErrors();
    const formMessages: string[] = [];

    for (const [key, message] of Object.entries(errors)) {
      if (message === undefined) {
        continue;
      }
      if (key === 'name') {
        firstNameField.setError(message);
        markLastNameInvalid(firstNameField.error.id);
        continue;
      }
      const field = errorFields[key as DraftErrorKey];
      if (field === undefined) {
        formMessages.push(message);
      } else {
        field.setError(message);
      }
    }

    setFormError(formMessages.join(' '));
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }

  function resetDelete(): void {
    deleteButton.hidden = false;
    deleteConfirm.hidden = true;
  }

  /** Shows the two-step delete confirmation and moves focus to its Delete button. */
  function requestDelete(): void {
    deleteButton.hidden = true;
    deleteConfirm.hidden = false;
    confirmDeleteButton.focus();
  }

  function populate(draft: CardDraft): void {
    labelField.input.value = draft.label;
    firstNameField.input.value = draft.visit.firstName;
    lastNameField.input.value = draft.visit.lastName;
    organizationField.input.value = draft.visit.organization;
    jobTitleField.input.value = draft.visit.title;
    phoneField.input.value = draft.visit.phone;
    emailField.input.value = draft.visit.email;
    websiteField.input.value = draft.visit.website;
  }

  function readVisitFields(): VisitCardDraft {
    return {
      firstName: firstNameField.input.value,
      lastName: lastNameField.input.value,
      organization: organizationField.input.value,
      title: jobTitleField.input.value,
      phone: phoneField.input.value,
      email: emailField.input.value,
      website: websiteField.input.value,
    };
  }

  /**
   * Reads the form into a draft. The draft's kind and its non-Visit fields come
   * from the open draft; ticket #5 makes the kind switcher select them instead.
   */
  function readDraft(): CardDraft {
    const current = currentDraft ?? newCardDraft('visit');
    return {
      ...current,
      label: labelField.input.value,
      visit: current.kind === 'visit' ? readVisitFields() : current.visit,
    };
  }

  function open(draft: CardDraft, existing: Card | null): void {
    editingCard = existing;
    currentDraft = draft;
    populate(draft);
    clearErrors();
    resetDelete();
    visitFields.hidden = draft.kind !== 'visit';
    deleteZone.hidden = existing === null;
    title.textContent = `${existing === null ? 'New' : 'Edit'} ${KIND_NAME[draft.kind]}`;
    if (!dialog.open) {
      dialog.showModal();
    }
    labelField.input.focus();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors();

    const identity = {
      id: editingCard?.id ?? createCardId(),
      updatedAt: new Date().toISOString(),
    };
    const result = validateDraft(readDraft(), identity);
    if (!result.ok) {
      showErrors(result.errors);
      return;
    }

    try {
      handlers.onSave(result.card);
    } catch (error) {
      setFormError(errorMessage(error));
      return;
    }
    // Closing after a successful save lets the app re-render first; the app
    // regains focus in `onClosed` because the trigger may have been replaced.
    dialog.close();
  });

  deleteButton.addEventListener('click', requestDelete);

  keepButton.addEventListener('click', () => {
    resetDelete();
    deleteButton.focus();
  });

  confirmDeleteButton.addEventListener('click', () => {
    if (editingCard === null) {
      return;
    }
    clearErrors();
    try {
      handlers.onDelete(editingCard.id);
    } catch (error) {
      setFormError(errorMessage(error));
      return;
    }
    dialog.close();
  });

  cancelButton.addEventListener('click', () => {
    dialog.close();
  });

  // Esc closes the dialog natively and discards the draft. A backdrop click is
  // deliberately not handled: native modal dialogs do not light-dismiss, so the
  // dialog stays open unless Cancel, Esc, Save, or Delete closes it.
  dialog.addEventListener('close', () => {
    resetDelete();
    clearErrors();
    editingCard = null;
    currentDraft = null;
    handlers.onClosed();
  });

  return {
    openNew(wallet) {
      // Ticket #5 changes the default kind to Link and adds the kind switcher.
      open(
        newCardDraft(
          'visit',
          wallet.cards.map((card) => card.label),
        ),
        null,
      );
    },
    openEdit(card) {
      open(draftFromCard(card), card);
    },
  };
}
