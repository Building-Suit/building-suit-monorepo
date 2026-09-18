import { ref } from 'vue';

const isMenuOpen = ref(false);

export const useNavigation = () => {
  const toggleMenu = () => {
    isMenuOpen.value = !isMenuOpen.value;
  };

  const navLinks = [
    { label: 'features', to: '#features' },
    { label: 'pricing', to: '#pricing' },
    { label: 'faqs', to: '#faqs' },
  ];

  const companyLinks = [
    { label: 'aboutUs', to: '/' },
    { label: 'contact', to: '/' },
  ];

  const legalLinks = [
    { label: 'privacyPolicy', to: '/' },
    { label: 'termsOfService', to: '/' },
  ];

  return {
    isMenuOpen,
    toggleMenu,

    /* Links */
    navLinks,
    companyLinks,
    legalLinks,
  };
};
