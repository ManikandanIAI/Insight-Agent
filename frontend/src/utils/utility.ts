type Fn = (arg1?: string, arg2?: string) => void;

export function debounce<FN extends Fn>(fn: FN, time: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<FN>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(...args);
    }, time);
  };
}
