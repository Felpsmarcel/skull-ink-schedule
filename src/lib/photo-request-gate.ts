/** A new read invalidates callbacks from the previous project/adapter generation. */
export function createPhotoRequestGate() {
  let current: object | null = null;
  let capture: (() => boolean) | null = null;
  return {
    begin() {
      const token = {};
      current = token;
      const isCurrent = () => current === token;
      capture = isCurrent;
      return {
        isCurrent,
        end() {
          if (current === token) {
            current = null;
            capture = null;
          }
        },
      };
    },
    capture: () => capture,
  };
}
