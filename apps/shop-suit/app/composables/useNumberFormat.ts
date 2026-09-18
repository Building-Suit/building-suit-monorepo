export const useNumberFormat = (number: number) => {
  return new Intl.NumberFormat('en-US').format(number);
};
