import { computed, toValue, type MaybeRefOrGetter } from 'vue';

import type { ShopRpcDatabase } from '~/types/shopCrmRpc';

import type { PublicPlan } from '~/types/plans';
export type { PublicPlan } from '~/types/plans';

export const usePlans = (currency: MaybeRefOrGetter<'EGP' | 'USD'> = 'EGP') => {
  const supabase = useShopClient<ShopRpcDatabase>();
  const request = useShopQuery<PublicPlan[]>(
    computed(() => `shop-crm-public-plans:${toValue(currency)}`),
    async () => {
      const { data: plans, error: queryError } = toValue(currency) === 'EGP'
        ? await supabase.schema('public').rpc('shop_public_plan_catalog')
        : await supabase.schema('public').rpc('shop_subscription_currency_catalog', { p_currency: 'USD' });

      if (queryError) throw queryError;
      return (plans ?? []) as PublicPlan[];
    },
    { scope: 'account', default: () => [] },
  );

  const { data, pending, error, refresh } = request;
  // Form defaults must use the same settled catalogue during SSR and hydration.
  return { data, isLoading: pending, error, refresh, ready: request.ensure() };
};
