import { useAsyncData, useSupabaseClient } from '#imports';

type PublicPlan = {
  id: string;
  name: string;
  slug: string;
  price_amount: number;
  currency: string;
  billing_interval: string;
  trial_days: number;
  features: { inventory?: boolean } | null;
  resource_limits: {
    active_locations: number | null;
    active_members: number | null;
    active_products: number | null;
    active_services: number | null;
  };
  is_purchasable: boolean;
  is_coming_soon: boolean;
};

export const usePlans = () => {
  const supabase = useSupabaseClient();
  const { data, pending, error, refresh } = useAsyncData<PublicPlan[]>(
    'shop-crm-public-plans',
    async () => {
      const { data: plans, error: queryError } = await supabase
        .from('plans')
        .select('id,name,slug,price_amount,currency,billing_interval,trial_days,features,resource_limits,is_purchasable,is_coming_soon')
        .eq('is_active', true)
        .eq('is_public', true)
        .eq('is_purchasable', true)
        .order('sort_order', { ascending: true });

      if (queryError) throw queryError;
      return (plans ?? []) as PublicPlan[];
    },
    { default: () => [] },
  );

  return { data, isLoading: pending, error, refresh };
};
