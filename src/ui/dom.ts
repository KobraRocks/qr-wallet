/** Creates a non-submitting button with a class name and text. */
export function createButton(text: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  return button;
}

/**
 * A short, human message for a thrown store, validation, or download failure.
 * The fallback is used when the thrown value is not an Error carrying a message.
 */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
