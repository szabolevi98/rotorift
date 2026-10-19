// Single two-blade airplane propeller; separate from the quad's four rotors.
export const freshAirplanePropeller = () => [0, 0];
export const validAirplanePropeller = (value) =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((state) => Number.isInteger(state) && state >= 0 && state <= 3);
