/** Yield so the browser can paint and handle input between heavy work. */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
