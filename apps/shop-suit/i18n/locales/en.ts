export default defineI18nLocale(async () => ({
  /* Common */
  common: {
    retry: 'Retry',
  },

  customers: {
    title: 'Customers',
    subtitle: 'Keep customer contact details accurate and ready for future sales.',
    add: 'Add customer',
    createTitle: 'New customer',
    editTitle: 'Edit customer',
    save: 'Save customer',
    saving: 'Saving…',
    cancel: 'Cancel',
    edit: 'Edit',
    archive: 'Archive',
    back: 'Back to customers',
    name: 'Customer name',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    notes: 'Notes',
    status: 'Status',
    active: 'Active',
    archived: 'Archived',
    all: 'All customers',
    contact: 'Contact information',
    details: 'Customer details',
    created: 'Created',
    updated: 'Updated',
    archivedOn: 'Archived on',
    search: 'Search name, phone, or email',
    noCustomers: 'No customers match this view.',
    noContact: 'No contact information has been added.',
    noShop: 'Create a shop from the dashboard first.',
    dashboard: 'Dashboard',
    loadError: 'Could not load customers.',
    detailError: 'Could not load this customer.',
    notFound: 'This customer was not found in the selected shop.',
    permissionDenied: 'You do not have permission to view customers for this shop.',
    manageDenied: 'You can view customers, but you do not have permission to change them.',
    invalid: 'Enter a name of 2–160 characters and check the contact field lengths and email.',
    writeError: 'Could not save the customer.',
    archiveError: 'Could not archive the customer.',
    createdSuccess: 'Customer created.',
    updatedSuccess: 'Customer updated.',
    archivedSuccess: 'Customer archived. Historical references are preserved.',
    archiveConfirm: 'Archive this customer? The customer will be unavailable for new operations, while historical records remain preserved.',
    historyNotice: 'Receivables, payments, statements, and credit-sale totals are not available yet. This page shows customer master data only.',
    pageStatus: 'Showing {from}–{to} of {total}',
    previous: 'Previous page',
    next: 'Next page',
  },

  /* Landing Header CTAs */
  login: 'Login',
  startFreeTrial: 'Start Free Trial',

  /* Accessibility labels */
  a11y: {
    switchToLight: 'Switch to light mode',
    switchToDark: 'Switch to dark mode',
  },

  /* Auth pages */
  auth: {
    loginTitle: 'Welcome back',
    loginSubtitle: 'Log in to keep managing your shop.',
    email: 'Email',
    emailPlaceholder: 'Enter your email',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    passwordHint: 'At least 6 characters.',
    forgotPassword: 'Forgot password?',
    loginAction: 'Log in',
    noAccount: "Don't have an account?",
    signupAction: 'Create account',
    signupTitle: 'Start for free',
    signupSubtitle: 'Try Shop CRM free for 30 days. No credit card required.',
    displayName: 'Name',
    displayNamePlaceholder: 'Enter your name',
    haveAccount: 'Already have an account?',
    forgotTitle: 'Reset your password',
    forgotSubtitle: 'Enter your email and we will send you a reset link.',
    resetAction: 'Send reset link',
    resetSent: "If that email is registered, a reset link is on its way.",
    backToLogin: 'Back to login',
  },

  nav: {
    /* Landing Nav Links */
    features: 'Features',
    pricing: 'Pricing',
    faqs: 'FAQs',

    /* Landing Company Links */
    aboutUs: 'About Us',
    contact: 'Contact',

    /* Landing Legal Links */
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
  },

  /* Landing Footer */
  footer: {
    description:
      'The all-in-one CRM for Egyptian small businesses. Invoices, employees, expenses, and inventory — all in one place.',
    product: 'Product',
    company: 'Company',
    legal: 'Legal',
    allRightsReserved: 'All rights reserved',
  },

  /* Landing Hero */
  hero: {
    title: 'Know your real profit,',
    subtitle: 'Stop guessing.',
    description:
      'A complete CRM for small business owners in Egypt. Handle invoices, employees, services, expenses, and inventory — all in one place.',
    cta: 'Start Your 30-Day Free Trial',
    noCreditCard: 'No credit card required. Cancel anytime.',
    seeHowItWorks: 'See How It Works',
    trustSignal1: 'Built for Egyptian businesses',
    trustSignal2: 'Your data stays private and secure',
    trustSignal3: 'Export your data anytime',
  },

  /* Landing Social Proof Bar */
  socialProofBar: {
    trustedBy: 'Trusted by 500+ shops across Egypt',
    industries: {
      stores: 'Stores',
      electricians: 'Electricians',
      coffee: 'Coffee',
      retail: 'Retail',
      barbers: 'Barbers',
      pharmacy: 'Pharmacy',
      repairs: 'Repairs',
      clothing: 'Clothing',
    },
  },

  /* Landing Features */
  features: {
    title: 'Everything You Need to',
    subtitle: 'Grow Your Business',
    description:
      'From invoices to inventory, manage every aspect of your shop in one powerful platform.',
    invoicesAndServices: {
      title: 'Invoices & Services',
      description:
        'Create, print, and track invoices. Add discounts, services, and work with full math accuracy.',
      description2: 'Print on A4, A5, or thermal receipt',
    },
    employeesManagement: {
      title: 'Employees Management',
      description:
        'Add team members with custom roles and permissions. Track who does what and maintain full control.',
      description2: 'Custom roles with flexible permissions',
    },
    dashboardAndReports: {
      title: 'Dashboard & Reports',
      description:
        'See your revenue, expenses, and profit at a glance. Make informed decisions with accurate data.',
      description2: 'Know the difference between revenue and real profit',
    },
    expensesTracking: {
      title: 'Expenses Tracking',
      description:
        'Log every expense — rent, supplies, utilities. Understand your true costs and maximize profit.',
      description2: 'One-time or recurring expenses',
    },
  },

  /* Landing Inventory */
  inventory: {
    proPlanOnly: 'Pro plan only',
    neverLoseTrackOfYour: 'Never lose track of your',
    stock: 'stock',
    again: 'again',
    description:
      'Stop guessing what things cost. Track every purchase, know your real profit on every sale, and never run out of stock unexpectedly.',
    feature01: 'Automatic stock increase with vendor invoices',
    feature02: 'Automatic stock deduction on client invoices',
    feature03: 'Smart cost tracking (FIFO-based)',
    feature04: 'Batch-level accuracy',
    perfectForShops: 'Perfect for shops that sell products, not just services.',
  },

  /* Landing Pricing */
  pricing: {
    title: 'Simple, Transparent',
    subtitle: 'Pricing',
    description:
      "Start free, upgrade when you're ready. No hidden fees, cancel anytime.",
    notes: {
      allPlansIncludeFreeTrial:
        'All plans include a 30-day free trial. No credit card required.',
      switchPlansAnytime: 'Switch plans anytime during your trial.',
      upgradeMidTrial:
        "Need to upgrade mid-trial? You'll start paying immediately, but keep your data.",
    },
    comingSoon: 'Coming soon: Multi-shop support & more.',

    loadError: 'Something went wrong loading the plans. Please try again.',
    empty: 'No plans are available right now. Please check back later.',

    EGP: 'EGP',
    USD: 'USD',
    monthly: 'monthly',
    yearly: 'yearly',

    trial: '{trialDays}-day free trial',
    mostPopular: 'Most Popular',

    features: ['Employees', 'Invoices', 'Expenses', 'Dashboard', 'Reports'],
    inventoryFeatures: [
      'Automatic stock increase with vendor invoices',
      'Automatic stock deduction on client invoices',
      'Smart cost tracking (FIFO-based)',
      'Batch-level accuracy',
    ],

    cta: 'Get Started',
  },

  /* Landing FAQs */
  faqs: {
    title: 'Frequently Asked',
    subtitle: 'Questions',
    description: 'Everything you need to know about Shop CRM',
    q1: 'What happens after my trial ends?',
    a1: `You'll have 3 days to subscribe. After that, your account is locked until you pay. If locked for 90 days, your data is deleted.`,
    q2: 'Can I switch from Basic to Pro?',
    a2: `Yes, anytime. If you're still on trial, you'll start paying immediately. If you've already paid, you'll be charged the difference on your next billing cycle.`,
    q3: 'Do I need to enter all my data before I start?',
    a3: `No. You can create your first invoice in under 2 minutes. Add more data as you go.`,
    q4: 'Can I export my data?',
    a4: `Yes. You can export any table as Excel/CSV anytime.`,
    q5: 'Does this work offline?',
    a5: `No, you need an internet connection.`,
    q6: 'What payment methods do you accept?',
    a6: `We use Visa / Credit Card for Egyptian businesses.`,
    q7: 'Is my data secure?',
    a7: `Yes. Your data is encrypted and private. We never share it with anyone.`,
    q8: 'Can I use this in Arabic?',
    a8: `Yes. The entire platform is available in Arabic and English. You can switch anytime.`,
  },

  /* Landing Closing CTA */
  closingCTA: {
    title: 'Ready to Take Control of',
    subtitle: 'Your Business?',
    description:
      "Join hundreds of Egyptian shop owners who've simplified their operations with Shop CRM.",
  },
}));
