import { useAsyncData, useSupabaseClient } from '#imports';
import type { ShopRpcDatabase } from '~/types/shopCrmRpc';
import type { PlanResourceLimits } from '~/types/plans';

export type PublicPlan = {
  id: string;
  name: string;
  slug: string;
  price_amount: number;
  currency: string;
  billing_interval: string;
  trial_days: number;
  features: { inventory?: boolean } | null;
  resource_limits: PlanResourceLimits;
  is_purchasable: boolean;
  is_coming_soon: boolean;
};

export const usePlans = () => {
  const supabase = useSupabaseClient<ShopRpcDatabase>();
  const { data, pending, error, refresh } = useAsyncData<PublicPlan[]>(
    'shop-crm-public-plans',
    async () => {
      const { data: plans, error: queryError } = await supabase
        .schema('public')
        .rpc('shop_public_plan_catalog');

      if (queryError) throw queryError;
      return (plans ?? []) as PublicPlan[];
    },
    { default: () => [] },
  );

  return { data, isLoading: pending, error, refresh };
};
