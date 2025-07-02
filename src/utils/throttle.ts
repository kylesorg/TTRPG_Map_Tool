export function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let inCooldown = false;
  // let lastArgs: Parameters<T> | undefined; // Not strictly needed for simple leading-edge

  return (...args: Parameters<T>) => {
    // lastArgs = args; // Capture if we wanted a trailing call
    if (inCooldown) {
      return; // If in cooldown, do nothing
    }

    func(...args); // Execute the function

    inCooldown = true; // Enter cooldown
    setTimeout(() => {
      inCooldown = false; // Exit cooldown after delay
      // If a trailing call was desired for events during cooldown:
      // if (lastArgs) {
      //   func(...lastArgs); // Call with the last arguments received during cooldown
      //   lastArgs = undefined; // Clear after use
      // }
    }, delay);
  };
}
