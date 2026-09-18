export const navItems = [
  { id: "login", label: "Login" },
  { id: "register", label: "Register" },
  { id: "verify-phone", label: "Phone OTP" },
  { id: "verify-email", label: "Email OTP" },
  { id: "reset-request", label: "Reset" },
  { id: "new-password", label: "New Password" },
  { id: "one-last-step", label: "One Last Step" }
];

export const screenIds = navItems.map((item) => item.id);
