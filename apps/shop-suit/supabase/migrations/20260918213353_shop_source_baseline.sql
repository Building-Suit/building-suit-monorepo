-- Baseline for a NEW dedicated Shop project only.
-- Generated from the preserved recovery snapshot and nine unchanged source migrations.
-- Do not replay this baseline against an existing populated source project.
BEGIN;

-- Shop Suit schema-only baseline captured from Supabase project jkdncdexqcymwbihwdhp on 2026-09-18.
-- Replays only on a fresh, isolated Supabase PostgreSQL database. Do not apply to the shared live project.
-- No customer rows, auth users, storage objects, migration history, Building Suit tables or secrets are included.
-- This preserves observed defects for forensic/recovery purposes; it is not an upgrade migration.

SET search_path = public, shop_crm, pg_temp;
SET check_function_bodies = false;
CREATE SCHEMA IF NOT EXISTS shop_crm;

CREATE TYPE "public"."expense_status" AS ENUM ('unpaid', 'paid', 'void');
CREATE TYPE "public"."inventory_movement_type" AS ENUM ('in', 'out', 'adjustment');
CREATE TYPE "public"."inventory_source_type" AS ENUM ('vendor_invoice', 'manual');
CREATE TYPE "public"."invoice_item_type" AS ENUM ('custom', 'service', 'product');
CREATE TYPE "public"."invoice_status" AS ENUM ('draft', 'issued', 'paid', 'refunded', 'void');
CREATE TYPE "public"."payment_direction" AS ENUM ('in', 'out');
CREATE TYPE "public"."payment_method" AS ENUM ('cash', 'bank_transfer', 'card', 'wallet', 'cheque', 'other');
CREATE TYPE "public"."payment_status" AS ENUM ('pending', 'completed', 'failed', 'void');
CREATE TYPE "public"."profile_status" AS ENUM ('active', 'suspended', 'archived');
CREATE TYPE "public"."shop_membership_status" AS ENUM ('active', 'invited', 'suspended');
CREATE TYPE "public"."shop_status" AS ENUM ('active', 'suspended', 'archived');
CREATE TYPE "public"."vendor_invoice_status" AS ENUM ('draft', 'posted', 'void');

CREATE TABLE shop_crm."accounting_periods" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "is_closed" boolean DEFAULT false NOT NULL,
  "closed_at" timestamp with time zone,
  "closed_by_profile_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."clients" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "email" text,
  "address" text,
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."expense_categories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."expenses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "category_id" uuid,
  "title" text NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "status" expense_status DEFAULT 'paid'::expense_status NOT NULL,
  "expense_date" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone,
  "notes" text,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."inventory_batches" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "quantity_received" numeric(12,2) NOT NULL,
  "remaining_quantity" numeric(12,2) NOT NULL,
  "unit_cost" numeric(12,2) NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source_type" inventory_source_type NOT NULL,
  "source_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."inventory_movements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "batch_id" uuid,
  "quantity_change" numeric(12,2) NOT NULL,
  "movement_type" inventory_movement_type NOT NULL,
  "reference_id" uuid,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."invoice_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "item_type" invoice_item_type DEFAULT 'custom'::invoice_item_type NOT NULL,
  "item_name" text NOT NULL,
  "quantity" numeric(12,2) DEFAULT 1 NOT NULL,
  "unit_price" numeric(12,2) NOT NULL,
  "discount_amount" numeric(12,2),
  "total_amount" numeric(12,2) NOT NULL,
  "product_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."invoices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "assigned_to_profile_id" uuid,
  "invoice_number" text NOT NULL,
  "status" invoice_status DEFAULT 'draft'::invoice_status NOT NULL,
  "issued_at" timestamp with time zone,
  "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
  "discount_amount" numeric(12,2),
  "currency" text DEFAULT 'EGP'::text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "client_id" uuid,
  "client_name_snapshot" text
);
CREATE TABLE shop_crm."membership_roles" (
  "membership_id" uuid NOT NULL,
  "role_id" uuid NOT NULL
);
CREATE TABLE shop_crm."payments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "payment_direction" payment_direction NOT NULL,
  "invoice_id" uuid,
  "vendor_invoice_id" uuid,
  "client_id" uuid,
  "vendor_id" uuid,
  "amount" numeric(12,2) NOT NULL,
  "method" payment_method NOT NULL,
  "status" payment_status DEFAULT 'completed'::payment_status NOT NULL,
  "reference" text,
  "paid_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."permissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "portal_id" uuid NOT NULL,
  "key" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."plans" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "portal_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "price_amount" integer NOT NULL,
  "currency" text DEFAULT 'EGP'::text NOT NULL,
  "billing_interval" text DEFAULT 'monthly'::text NOT NULL,
  "trial_days" integer DEFAULT 30 NOT NULL,
  "stripe_product_id" text,
  "stripe_price_id" text,
  "stripe_mode" text DEFAULT 'subscription'::text NOT NULL,
  "features" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_public" boolean DEFAULT true NOT NULL,
  "is_coming_soon" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."portals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "is_original" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."products" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "sku" text,
  "barcode" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "portal_id" uuid NOT NULL,
  "display_name" text,
  "email_snapshot" text,
  "status" profile_status DEFAULT 'active'::profile_status NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."role_permissions" (
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL
);
CREATE TABLE shop_crm."roles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."services" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "base_sale_price" numeric(12,2),
  "default_discount_type" text,
  "default_discount_value" numeric(12,2),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."shop_memberships" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "role" text NOT NULL,
  "status" shop_membership_status DEFAULT 'active'::shop_membership_status NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."shops" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "portal_id" uuid NOT NULL,
  "name" text NOT NULL,
  "status" shop_status DEFAULT 'active'::shop_status NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "status" text NOT NULL,
  "trial_start_at" timestamp with time zone,
  "trial_end_at" timestamp with time zone,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "trial_consumed" boolean DEFAULT false NOT NULL,
  "locked_at" timestamp with time zone,
  "stripe_customer_id" text,
  "stripe_subsription_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."vendor_invoice_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "vendor_invoice_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "quantity" numeric(12,2) NOT NULL,
  "unit_cost" numeric(12,4) NOT NULL,
  "total_cost" numeric(12,2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."vendor_invoices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "vendor_id" uuid,
  "vendor_name_snapshot" text NOT NULL,
  "invoice_number" text,
  "status" vendor_invoice_status DEFAULT 'draft'::vendor_invoice_status NOT NULL,
  "issued_at" timestamp with time zone,
  "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
  "notes" text,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE shop_crm."vendors" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "shop_id" uuid NOT NULL,
  "name" text NOT NULL,
  "contact_name" text,
  "phone" text,
  "email" text,
  "address" text,
  "tax_number" text,
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE shop_crm."accounting_periods" ADD CONSTRAINT "accounting_periods_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."clients" ADD CONSTRAINT "clients_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."expense_categories" ADD CONSTRAINT "expense_categories_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."expenses" ADD CONSTRAINT "expenses_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."inventory_batches" ADD CONSTRAINT "inventory_batches_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."inventory_movements" ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."invoice_items" ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."invoices" ADD CONSTRAINT "invoices_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."membership_roles" ADD CONSTRAINT "membership_roles_pkey" PRIMARY KEY (membership_id, role_id);
ALTER TABLE shop_crm."payments" ADD CONSTRAINT "payments_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."permissions" ADD CONSTRAINT "permissions_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."plans" ADD CONSTRAINT "plans_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."portals" ADD CONSTRAINT "portals_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."products" ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."role_permissions" ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY (role_id, permission_id);
ALTER TABLE shop_crm."roles" ADD CONSTRAINT "roles_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."services" ADD CONSTRAINT "services_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."shop_memberships" ADD CONSTRAINT "shop_memberships_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."shops" ADD CONSTRAINT "shops_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."subscriptions" ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."vendor_invoice_items" ADD CONSTRAINT "vendor_invoice_items_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."vendor_invoices" ADD CONSTRAINT "vendor_invoices_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."vendors" ADD CONSTRAINT "vendors_pkey" PRIMARY KEY (id);
ALTER TABLE shop_crm."accounting_periods" ADD CONSTRAINT "accounting_periods_shop_id_period_start_period_end_key" UNIQUE (shop_id, period_start, period_end);
ALTER TABLE shop_crm."invoices" ADD CONSTRAINT "invoices_shop_id_invoice_number_key" UNIQUE (shop_id, invoice_number);
ALTER TABLE shop_crm."permissions" ADD CONSTRAINT "permissions_portal_id_key_key" UNIQUE (portal_id, key);
ALTER TABLE shop_crm."plans" ADD CONSTRAINT "plans_portal_id_slug_key" UNIQUE (portal_id, slug);
ALTER TABLE shop_crm."portals" ADD CONSTRAINT "portals_key_key" UNIQUE (key);
ALTER TABLE shop_crm."profiles" ADD CONSTRAINT "profiles_user_id_portal_id_key" UNIQUE (user_id, portal_id);
ALTER TABLE shop_crm."roles" ADD CONSTRAINT "roles_shop_id_name_key" UNIQUE (shop_id, name);
ALTER TABLE shop_crm."shop_memberships" ADD CONSTRAINT "shop_memberships_shop_id_profile_id_key" UNIQUE (shop_id, profile_id);
ALTER TABLE shop_crm."subscriptions" ADD CONSTRAINT "subscriptions_profile_id_key" UNIQUE (profile_id);
ALTER TABLE shop_crm."vendor_invoices" ADD CONSTRAINT "vendor_invoices_shop_id_invoice_number_key" UNIQUE (shop_id, invoice_number);
ALTER TABLE shop_crm."accounting_periods" ADD CONSTRAINT "accounting_periods_check" CHECK (period_start <= period_end);
ALTER TABLE shop_crm."expenses" ADD CONSTRAINT "expenses_amount_check" CHECK (amount > 0::numeric);
ALTER TABLE shop_crm."inventory_batches" ADD CONSTRAINT "inventory_batches_check" CHECK (remaining_quantity <= quantity_received);
ALTER TABLE shop_crm."inventory_batches" ADD CONSTRAINT "inventory_batches_remaining_quantity_check" CHECK (remaining_quantity >= 0::numeric);
ALTER TABLE shop_crm."payments" ADD CONSTRAINT "payments_amount_check" CHECK (amount > 0::numeric);
ALTER TABLE shop_crm."services" ADD CONSTRAINT "services_default_discount_type_check" CHECK (default_discount_type = ANY (ARRAY['amount'::text, 'percent'::text]));
ALTER TABLE shop_crm."accounting_periods" ADD CONSTRAINT "accounting_periods_closed_by_profile_id_fkey" FOREIGN KEY (closed_by_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."accounting_periods" ADD CONSTRAINT "accounting_periods_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."clients" ADD CONSTRAINT "clients_created_by_profile_id_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."clients" ADD CONSTRAINT "clients_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."expense_categories" ADD CONSTRAINT "expense_categories_created_by_profile_id_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."expense_categories" ADD CONSTRAINT "expense_categories_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY (category_id) REFERENCES shop_crm.expense_categories(id) ON DELETE SET NULL;
ALTER TABLE shop_crm."expenses" ADD CONSTRAINT "expenses_created_by_profile_id_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."expenses" ADD CONSTRAINT "expenses_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."inventory_batches" ADD CONSTRAINT "inventory_batches_product_id_fkey" FOREIGN KEY (product_id) REFERENCES shop_crm.products(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."inventory_batches" ADD CONSTRAINT "inventory_batches_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES shop_crm.inventory_batches(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_profile_id_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY (product_id) REFERENCES shop_crm.products(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."inventory_movements" ADD CONSTRAINT "inventory_movements_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES shop_crm.invoices(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."invoices" ADD CONSTRAINT "invoices_assigned_to_profile_id_fkey" FOREIGN KEY (assigned_to_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE SET NULL;
ALTER TABLE shop_crm."invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY (client_id) REFERENCES shop_crm.clients(id) ON DELETE SET NULL;
ALTER TABLE shop_crm."invoices" ADD CONSTRAINT "invoices_created_by_profile_id_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."invoices" ADD CONSTRAINT "invoices_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."membership_roles" ADD CONSTRAINT "membership_roles_membership_id_fkey" FOREIGN KEY (membership_id) REFERENCES shop_crm.shop_memberships(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."membership_roles" ADD CONSTRAINT "membership_roles_role_id_fkey" FOREIGN KEY (role_id) REFERENCES shop_crm.roles(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."payments" ADD CONSTRAINT "payments_client_id_fkey" FOREIGN KEY (client_id) REFERENCES shop_crm.clients(id) ON DELETE SET NULL;
ALTER TABLE shop_crm."payments" ADD CONSTRAINT "payments_created_by_profile_id_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES shop_crm.invoices(id) ON DELETE SET NULL;
ALTER TABLE shop_crm."payments" ADD CONSTRAINT "payments_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."payments" ADD CONSTRAINT "payments_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES shop_crm.vendors(id) ON DELETE SET NULL;
ALTER TABLE shop_crm."payments" ADD CONSTRAINT "payments_vendor_invoice_id_fkey" FOREIGN KEY (vendor_invoice_id) REFERENCES shop_crm.vendor_invoices(id) ON DELETE SET NULL;
ALTER TABLE shop_crm."permissions" ADD CONSTRAINT "permissions_portal_id_fkey" FOREIGN KEY (portal_id) REFERENCES shop_crm.portals(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."plans" ADD CONSTRAINT "plans_portal_id_fkey" FOREIGN KEY (portal_id) REFERENCES shop_crm.portals(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."products" ADD CONSTRAINT "products_created_by_profile_id_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."products" ADD CONSTRAINT "products_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."profiles" ADD CONSTRAINT "profiles_portal_id_fkey" FOREIGN KEY (portal_id) REFERENCES shop_crm.portals(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."profiles" ADD CONSTRAINT "profiles_user_fk" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY (permission_id) REFERENCES shop_crm.permissions(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY (role_id) REFERENCES shop_crm.roles(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."roles" ADD CONSTRAINT "roles_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."services" ADD CONSTRAINT "services_created_by_profile_id_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."services" ADD CONSTRAINT "services_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."shop_memberships" ADD CONSTRAINT "shop_memberships_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES shop_crm.profiles(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."shop_memberships" ADD CONSTRAINT "shop_memberships_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."shops" ADD CONSTRAINT "shops_portal_id_fkey" FOREIGN KEY (portal_id) REFERENCES shop_crm.portals(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES shop_crm.plans(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."subscriptions" ADD CONSTRAINT "subscriptions_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES shop_crm.profiles(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."vendor_invoice_items" ADD CONSTRAINT "vendor_invoice_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES shop_crm.products(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."vendor_invoice_items" ADD CONSTRAINT "vendor_invoice_items_vendor_invoice_id_fkey" FOREIGN KEY (vendor_invoice_id) REFERENCES shop_crm.vendor_invoices(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."vendor_invoices" ADD CONSTRAINT "vendor_invoices_created_by_profile_id_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."vendor_invoices" ADD CONSTRAINT "vendor_invoices_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;
ALTER TABLE shop_crm."vendor_invoices" ADD CONSTRAINT "vendor_invoices_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES shop_crm.vendors(id) ON DELETE SET NULL;
ALTER TABLE shop_crm."vendors" ADD CONSTRAINT "vendors_created_by_profile_id_fkey" FOREIGN KEY (created_by_profile_id) REFERENCES shop_crm.profiles(id) ON DELETE RESTRICT;
ALTER TABLE shop_crm."vendors" ADD CONSTRAINT "vendors_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES shop_crm.shops(id) ON DELETE CASCADE;

CREATE INDEX idx_accounting_periods_shop ON shop_crm.accounting_periods USING btree (shop_id);
CREATE INDEX idx_clients_phone ON shop_crm.clients USING btree (phone);
CREATE INDEX idx_clients_shop_id ON shop_crm.clients USING btree (shop_id);
CREATE INDEX idx_expense_categories_shop_id ON shop_crm.expense_categories USING btree (shop_id);
CREATE INDEX idx_expenses_category_id ON shop_crm.expenses USING btree (category_id);
CREATE INDEX idx_expenses_expense_date ON shop_crm.expenses USING btree (expense_date);
CREATE INDEX idx_expenses_shop_id ON shop_crm.expenses USING btree (shop_id);
CREATE INDEX idx_inventory_batches_product_fifo ON shop_crm.inventory_batches USING btree (product_id, received_at);
CREATE INDEX idx_inventory_batches_remaining ON shop_crm.inventory_batches USING btree (remaining_quantity);
CREATE INDEX idx_inventory_movements_created_at ON shop_crm.inventory_movements USING btree (created_at);
CREATE INDEX idx_inventory_movements_product ON shop_crm.inventory_movements USING btree (product_id);
CREATE INDEX idx_inventory_movements_shop ON shop_crm.inventory_movements USING btree (shop_id);
CREATE INDEX idx_invoice_items_invoice_id ON shop_crm.invoice_items USING btree (invoice_id);
CREATE INDEX idx_invoice_items_product_id ON shop_crm.invoice_items USING btree (product_id);
CREATE INDEX idx_invoices_assigned_to ON shop_crm.invoices USING btree (assigned_to_profile_id);
CREATE INDEX idx_invoices_client_id ON shop_crm.invoices USING btree (client_id);
CREATE INDEX idx_invoices_created_by ON shop_crm.invoices USING btree (created_by_profile_id);
CREATE INDEX idx_invoices_shop_id ON shop_crm.invoices USING btree (shop_id);
CREATE INDEX idx_invoices_status ON shop_crm.invoices USING btree (status);
CREATE INDEX idx_payments_direction_status ON shop_crm.payments USING btree (payment_direction, status);
CREATE INDEX idx_payments_invoice_id ON shop_crm.payments USING btree (invoice_id);
CREATE INDEX idx_payments_paid_at ON shop_crm.payments USING btree (paid_at);
CREATE INDEX idx_payments_shop_id ON shop_crm.payments USING btree (shop_id);
CREATE INDEX idx_payments_vendor_invoice_id ON shop_crm.payments USING btree (vendor_invoice_id);
CREATE INDEX idx_products_shop_id ON shop_crm.products USING btree (shop_id);
CREATE INDEX idx_services_active ON shop_crm.services USING btree (is_active);
CREATE INDEX idx_services_shop_id ON shop_crm.services USING btree (shop_id);
CREATE INDEX idx_vendor_invoices_shop_id ON shop_crm.vendor_invoices USING btree (shop_id);
CREATE INDEX idx_vendor_invoices_vendor_id ON shop_crm.vendor_invoices USING btree (vendor_id);
CREATE INDEX idx_vendors_phone ON shop_crm.vendors USING btree (phone);
CREATE INDEX idx_vendors_shop_id ON shop_crm.vendors USING btree (shop_id);
CREATE UNIQUE INDEX one_original_portal ON shop_crm.portals USING btree (is_original) WHERE (is_original = true);

CREATE OR REPLACE FUNCTION public.assert_period_is_open(_shop_id uuid, _date timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if exists (
    select 1 from public.accounting_periods ap
    where ap.shop_id = _shop_id
      and ap.is_closed = true
      and _date::date between ap.period_start and ap.period_end
  ) then
    raise exception
      'Accounting period is closed for date %',
      _date::date;
  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION public.check_expense_period()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.status = paid then
    perform public.assert_period_is_open(
      new.shop_id,
      new.expense_date
    );
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.check_invoice_period()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  perform public.assert_period_is_open(
    new.shop_id,
    new.issued_at
  );
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.check_payment_period()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  perform public.assert_period_is_open(
    new.shop_id,
    new.paid_at
  );
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.deduct_inventory_fifo(_shop_id uuid, _product_id uuid, _quantity numeric, _reference_id uuid, _actor_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  remaining_qty numeric := _quantity;
  batch record;
  take_qty numeric;
begin
  -- Loop over FIFO batches
  for batch in
    select * from public.inventory_batches
    where shop_id = _shop_id
      and product_id = _product_id
      and remaining_quantity > 0
    order by received_at asc
    for update
  loop
    exit when remaining_qty <= 0;

    take_qty := least(remaining_qty, batch.remaining_quantity);

    -- update batch remaining quantity
    update public.inventory_batches
    set remaining_quantity = remaining_quantity - take_qty
    where id = batch.id;


    -- insert ledger movmeent
    insert into public.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type, reference_id, created_by_profile_id
    ) values (
      _shop_id, _product_id, batch.id, -take_qty, 'out', _reference_id, _actor_profile_id
    );

    remaining_qty := remaining_qty - take_qty;
  end loop;


  -- if we couldn't fulfill required quantity -> rollback
  if remaining_qty > 0 then
    raise exception
      'Insufficient stock for product % (missing %)',
      _product_id, remaining_qty;
  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION public.issue_invoice_and_deduct_inventory(_invoice_id uuid, _actor_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  inv record;
  item record;
begin
  -- Lock invoice
  select * into inv
  from public.invoices
  where id = _invoice_id
  for update;

  if inv.status <> 'draft' then
    raise exception 'Invoice % is not in draft state', _invoice_id;
  end if;

  -- Process each product item
  for item in
    select * from public.invoice_items
    where invoice_id - _invoice_id
      and item_type = 'product'
      and product_id is not null
  loop
    perform public.deduct_inventory_fifo(
      inv.shop_id, item.product_id, item.quantity, inv.id, _actor_profile_id
    );
  end loop;

  -- Mark invoice as issued
  update public.invoices
  set status = 'issued',
    issued_at = now()
  where id = _invoice_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.post_vendor_invoice_and_create_batches(_vendor_invoice_id uuid, _actor_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  inv record;
  item record;
  batch_id uuid;
begin
  -- Lock invoice
  select * into inv from public.vendor_invoices
  where id = _vendor_invoice_id
  for update;

  if inv.status <> 'draft' then
    raise exception 'Vendor invoice % is not in draft state', _vendor_invoice_id;
  end if;

  -- Process each item
  for item in
    select * from public.vendor_invoice_items
    where vendor_invoice_id = _vendor_invoice_id
  loop
    -- Create FIFO batch
    insert into public.inventory_batches (
      shop_id, product_id, quantity_received, remaining_quantity, unit_cost, received_at, source_type, source_id
    ) values (
      inv.shop_id, item.product_id, item.quantity, item.quantity, item.unit_cost, coalesce(inv.issued_at, now()), 'vendor_invoice', inv.id
    ) returning id into batch_id;

    -- Ledger movement
    insert into public.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type, reference_id, created_by_profile_id
    ) values (
      inv.shop_id, item.product_id, batch_id, item.quantity, 'in', inv.id, _actor_profile_id
    );
  end loop;

  -- Mark invoice as posted
  update public.vendor_invoices
  set status = 'posted'
  where id = _vendor_invoice_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.prevent_inventory_movment_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  raise exception 'Inventory movement are immutable';
end;
$function$;
CREATE OR REPLACE FUNCTION public.prevent_invoice_edit_after_issue()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.status = 'issued' then
    raise exception 'Issued invoice are immutable';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.prevent_payment_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  raise exception 'Payments cannot be modified; use void or reversal';
end;
$function$;
CREATE OR REPLACE FUNCTION public.prevent_vendor_invoice_edit_after_post()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.status = 'posted' then
    raise exception 'Posted vendor invoices are immutable';
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.return_inventory_for_invoice(_invoice_id uuid, _actor_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  mov record;
begin
  -- Loop through original COGS movements
  for mov in
    select * from public.inventory_movements
    where reference_id = _invoice_id and movement_type = 'out'
  loop
    -- Return stock to the same batch
    update public.inventory_batches
    set remaining_quantity = remaining_quantity + abs(mov.quantity_change)
    where id = mov.batch_id;

    -- Ledger: reverse movement
    insert into public.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type, reference_id, created_by_profile_id
    ) values (
      mov.shop_id, mov.product_id, mov.batch_id, abs(mov.quantity_change), 'in', _invoice_id, _actor_profile_id
    );
  end loop;
end;
$function$;
CREATE OR REPLACE FUNCTION public.shop_has_active_subscription(_shop_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from public.subscriptions s
    join public.shop_memberships sm on sm.profile_id = s.profile_id
    where sm.shop_id = _shop_id
      and sm.role = 'owner'
      and s.status in ('trialing', 'active', 'past_due')
  )
$function$;
CREATE OR REPLACE FUNCTION public.shop_has_feature(_shop_id uuid, _feature_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    join public.shop_memberships sm on sm.profile_id = s.profile_id
    where sm.shop_id = _shop_id
      and sm.role = 'owner'
      and s.status in ('trialing', 'active', 'past_due')
      and coalesce((p.features ->> _feature_key)::boolean, false) = true
  )
$function$;
CREATE OR REPLACE FUNCTION public.user_has_shop_permission(_shop_id uuid, _permission_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select
    -- owner shortcut
    exists (
      select 1 from public.shop_memberships sm
      join public.profiles p on p.id = sm.profile_id
      where sm.shop_id = _shop_id
        and sm.role = 'owner'
        and p.user_id = auth.uid()
    )

    -- OR employee with permission
    or exists (
      select 1 from public.membership_roles mr
      join public.role_permissions rp on rp.role_id = mr.role_id
      join public.permissions perm on perm.id = rp.permission_id
      join public.shop_memberships sm on sm.id = mr.membership_id
      join public.profiles p on p.id = sm.profile_id
      where sm.shop_id = _shop_id
        and p.user_id = auth.uid()
        and perm.key = _permission_key
    )
$function$;
CREATE OR REPLACE FUNCTION public.user_is_member_of_shop(_shop_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from public.shop_memberships sm
    join public.profiles p on p.id = sm.profile_id
    where sm.shop_id = _shop_id
      and p.user_id = auth.uid()
  )
$function$;
SET check_function_bodies = true;

CREATE VIEW shop_crm."cash_flow_daily" AS
SELECT shop_id,
    day,
    sum(net_amount) AS net_cash_flow
   FROM ( SELECT payments.shop_id,
            date_trunc('day'::text, payments.paid_at) AS day,
                CASE
                    WHEN payments.payment_direction = 'in'::payment_direction THEN payments.amount
                    ELSE - payments.amount
                END AS net_amount
           FROM shop_crm.payments
          WHERE payments.status = 'completed'::payment_status
        UNION ALL
         SELECT expenses.shop_id,
            date_trunc('day'::text, expenses.paid_at) AS day,
            - expenses.amount AS net_amount
           FROM shop_crm.expenses
          WHERE expenses.status = 'paid'::expense_status AND expenses.paid_at IS NOT NULL) t
  GROUP BY shop_id, day;
CREATE VIEW shop_crm."cash_flow_monthly" AS
SELECT shop_id,
    month,
    sum(net_amount) AS net_cash_flow
   FROM ( SELECT payments.shop_id,
            date_trunc('month'::text, payments.paid_at) AS month,
                CASE
                    WHEN payments.payment_direction = 'in'::payment_direction THEN payments.amount
                    ELSE - payments.amount
                END AS net_amount
           FROM shop_crm.payments
          WHERE payments.status = 'completed'::payment_status
        UNION ALL
         SELECT expenses.shop_id,
            date_trunc('month'::text, expenses.paid_at) AS month,
            - expenses.amount AS net_amount
           FROM shop_crm.expenses
          WHERE expenses.status = 'paid'::expense_status AND expenses.paid_at IS NOT NULL) t
  GROUP BY shop_id, month;
CREATE VIEW shop_crm."client_balances" AS
SELECT c.id AS client_id,
    c.shop_id,
    COALESCE(sum(i.total_amount), 0::numeric) - COALESCE(sum(p.amount), 0::numeric) AS balance
   FROM shop_crm.clients c
     LEFT JOIN shop_crm.invoices i ON i.client_id = c.id
     LEFT JOIN shop_crm.payments p ON p.client_id = c.id AND p.payment_direction = 'in'::payment_direction AND p.status = 'completed'::payment_status
  GROUP BY c.id, c.shop_id;
CREATE VIEW shop_crm."cogs_movements" AS
SELECT im.shop_id,
    im.reference_id AS invoice_id,
    im.product_id,
    im.batch_id,
    abs(im.quantity_change) AS quantity_sold,
    b.unit_cost,
    abs(im.quantity_change * b.unit_cost) AS cogs_amount,
    im.created_at
   FROM shop_crm.inventory_movements im
     JOIN shop_crm.inventory_batches b ON b.id = im.batch_id
  WHERE im.movement_type = 'out'::inventory_movement_type;
CREATE VIEW shop_crm."inventory_stock_batches" AS
SELECT shop_id,
    product_id,
    id AS batch_id,
    received_at,
    unit_cost,
    remaining_quantity,
    now() - received_at AS age_interval
   FROM shop_crm.inventory_batches
  WHERE remaining_quantity > 0::numeric;
CREATE VIEW shop_crm."invoice_paid_amounts" AS
SELECT i.id AS invoice_id,
    COALESCE(sum(p.amount), 0::numeric) AS paid_amount
   FROM shop_crm.invoices i
     LEFT JOIN shop_crm.payments p ON p.invoice_id = i.id AND p.payment_direction = 'in'::payment_direction AND p.status = 'completed'::payment_status
  GROUP BY i.id;
CREATE VIEW shop_crm."invoice_product_cogs" AS
SELECT invoice_id,
    product_id,
    sum(cogs_amount) AS product_cogs
   FROM shop_crm.cogs_movements
  GROUP BY invoice_id, product_id;
CREATE VIEW shop_crm."invoice_product_revenue" AS
SELECT invoice_id,
    sum(unit_price * quantity - COALESCE(discount_amount, 0::numeric)) AS product_revenue
   FROM shop_crm.invoice_items ii
  WHERE item_type = 'product'::invoice_item_type
  GROUP BY invoice_id;
CREATE VIEW shop_crm."product_average_inventory" AS
SELECT shop_id,
    product_id,
    avg(remaining_quantity) AS avg_quantity_on_hand
   FROM shop_crm.inventory_stock_batches
  GROUP BY shop_id, product_id;
CREATE VIEW shop_crm."product_last_sale" AS
SELECT shop_id,
    product_id,
    max(created_at) AS last_sold_at
   FROM shop_crm.inventory_movements im
  WHERE movement_type = 'out'::inventory_movement_type
  GROUP BY shop_id, product_id;
CREATE VIEW shop_crm."product_profitability" AS
SELECT ii.product_id,
    i.shop_id,
    sum(ii.unit_price * ii.quantity - COALESCE(ii.discount_amount, 0::numeric)) AS revenue,
    sum(cm.cogs_amount) AS cogs,
    sum(ii.unit_price * ii.quantity - COALESCE(ii.discount_amount, 0::numeric)) - sum(cm.cogs_amount) AS gross_profit
   FROM shop_crm.invoice_items ii
     JOIN shop_crm.invoices i ON i.id = ii.invoice_id
     JOIN shop_crm.cogs_movements cm ON cm.invoice_id = ii.invoice_id AND cm.product_id = ii.product_id
  WHERE ii.item_type = 'product'::invoice_item_type
  GROUP BY ii.product_id, i.shop_id;
CREATE VIEW shop_crm."product_sales_90d" AS
SELECT shop_id,
    product_id,
    sum(abs(quantity_change)) AS quantity_sold_90d
   FROM shop_crm.inventory_movements im
  WHERE movement_type = 'out'::inventory_movement_type AND created_at >= (now() - '90 days'::interval)
  GROUP BY shop_id, product_id;
CREATE VIEW shop_crm."vendor_balances" AS
SELECT v.id AS vendor_id,
    v.shop_id,
    COALESCE(sum(vi.total_amount), 0::numeric) - COALESCE(sum(p.amount), 0::numeric) AS balance
   FROM shop_crm.vendors v
     LEFT JOIN shop_crm.vendor_invoices vi ON vi.vendor_id = v.id
     LEFT JOIN shop_crm.payments p ON p.vendor_id = v.id AND p.payment_direction = 'out'::payment_direction AND p.status = 'completed'::payment_status
  GROUP BY v.id, v.shop_id;
CREATE VIEW shop_crm."vendor_invoice_paid_amounts" AS
SELECT vi.id AS vendor_invoice_id,
    COALESCE(sum(p.amount), 0::numeric) AS paid_amount
   FROM shop_crm.vendor_invoices vi
     LEFT JOIN shop_crm.payments p ON p.vendor_invoice_id = vi.id AND p.payment_direction = 'out'::payment_direction AND p.status = 'completed'::payment_status
  GROUP BY vi.id;
CREATE VIEW shop_crm."dead_stock" AS
SELECT sb.shop_id,
    sb.product_id,
    sum(sb.remaining_quantity) AS quantity_on_hand,
    max(sb.received_at) AS oldest_batch_date,
    pls.last_sold_at,
    now() - COALESCE(pls.last_sold_at, min(sb.received_at)) AS days_since_last_sale
   FROM shop_crm.inventory_stock_batches sb
     LEFT JOIN shop_crm.product_last_sale pls ON pls.shop_id = sb.shop_id AND pls.product_id = sb.product_id
  GROUP BY sb.shop_id, sb.product_id, pls.last_sold_at
 HAVING (now() - COALESCE(pls.last_sold_at, min(sb.received_at))) > '90 days'::interval;
CREATE VIEW shop_crm."inventory_aging" AS
SELECT shop_id,
    product_id,
    sum(
        CASE
            WHEN age_interval <= '30 days'::interval THEN remaining_quantity
            ELSE 0::numeric
        END) AS qty_0_30,
    sum(
        CASE
            WHEN age_interval > '30 days'::interval AND age_interval <= '60 days'::interval THEN remaining_quantity
            ELSE 0::numeric
        END) AS qty_31_60,
    sum(
        CASE
            WHEN age_interval > '60 days'::interval AND age_interval <= '90 days'::interval THEN remaining_quantity
            ELSE 0::numeric
        END) AS qty_61_90,
    sum(
        CASE
            WHEN age_interval > '90 days'::interval THEN remaining_quantity
            ELSE 0::numeric
        END) AS qty_90_plus
   FROM shop_crm.inventory_stock_batches
  GROUP BY shop_id, product_id;
CREATE VIEW shop_crm."inventory_aging_value" AS
SELECT shop_id,
    product_id,
    sum(
        CASE
            WHEN age_interval <= '30 days'::interval THEN remaining_quantity * unit_cost
            ELSE 0::numeric
        END) AS value_0_30,
    sum(
        CASE
            WHEN age_interval > '30 days'::interval AND age_interval <= '60 days'::interval THEN remaining_quantity * unit_cost
            ELSE 0::numeric
        END) AS value_31_60,
    sum(
        CASE
            WHEN age_interval > '60 days'::interval AND age_interval <= '90 days'::interval THEN remaining_quantity * unit_cost
            ELSE 0::numeric
        END) AS value_61_90,
    sum(
        CASE
            WHEN age_interval > '90 days'::interval THEN remaining_quantity * unit_cost
            ELSE 0::numeric
        END) AS value_90_plus
   FROM shop_crm.inventory_stock_batches
  GROUP BY shop_id, product_id;
CREATE VIEW shop_crm."inventory_turnover" AS
SELECT s.shop_id,
    s.product_id,
    s.quantity_sold_90d,
    COALESCE(ai.avg_quantity_on_hand, 0::numeric) AS avg_inventory,
        CASE
            WHEN COALESCE(ai.avg_quantity_on_hand, 0::numeric) = 0::numeric THEN NULL::numeric
            ELSE s.quantity_sold_90d / ai.avg_quantity_on_hand
        END AS turnover_ratio
   FROM shop_crm.product_sales_90d s
     LEFT JOIN shop_crm.product_average_inventory ai ON ai.shop_id = s.shop_id AND ai.product_id = s.product_id;
CREATE VIEW shop_crm."invoice_balances" AS
SELECT i.id AS invoice_id,
    i.shop_id,
    i.total_amount,
    COALESCE(pa.paid_amount, 0::numeric) AS paid_amount,
    i.total_amount - COALESCE(pa.paid_amount, 0::numeric) AS balance_due
   FROM shop_crm.invoices i
     LEFT JOIN shop_crm.invoice_paid_amounts pa ON pa.invoice_id = i.id;
CREATE VIEW shop_crm."invoice_cogs" AS
SELECT invoice_id,
    sum(product_cogs) AS total_cogs
   FROM shop_crm.invoice_product_cogs
  GROUP BY invoice_id;
CREATE VIEW shop_crm."invoice_gross_margin" AS
SELECT i.id AS invoice_id,
    i.shop_id,
    COALESCE(r.product_revenue, 0::numeric) AS revenue,
    COALESCE(c.total_cogs, 0::numeric) AS cogs,
    COALESCE(r.product_revenue, 0::numeric) - COALESCE(c.total_cogs, 0::numeric) AS gross_profit
   FROM shop_crm.invoices i
     LEFT JOIN shop_crm.invoice_product_revenue r ON r.invoice_id = i.id
     LEFT JOIN shop_crm.invoice_cogs c ON c.invoice_id = i.id;
CREATE VIEW shop_crm."monthly_cogs_margin" AS
SELECT i.shop_id,
    date_trunc('month'::text, i.issued_at) AS month,
    sum(ipr.product_revenue) AS revendue,
    sum(ic.total_cogs) AS cogs,
    sum(ipr.product_revenue) - sum(ic.total_cogs) AS gross_profit
   FROM shop_crm.invoices i
     JOIN shop_crm.invoice_product_revenue ipr ON ipr.invoice_id = i.id
     JOIN shop_crm.invoice_cogs ic ON ic.invoice_id = i.id
  GROUP BY i.shop_id, (date_trunc('month'::text, i.issued_at));
CREATE VIEW shop_crm."vendor_invoice_balances" AS
SELECT vi.id AS vendor_invoice_id,
    vi.shop_id,
    vi.total_amount,
    COALESCE(pa.paid_amount, 0::numeric) AS paid_amount,
    vi.total_amount - COALESCE(pa.paid_amount, 0::numeric) AS balance_due
   FROM shop_crm.vendor_invoices vi
     LEFT JOIN shop_crm.vendor_invoice_paid_amounts pa ON pa.vendor_invoice_id = vi.id;
CREATE VIEW shop_crm."daily_cogs_margin" AS
SELECT i.shop_id,
    date_trunc('day'::text, i.issued_at) AS day,
    sum(ipr.product_revenue) AS revenue,
    sum(ic.total_cogs) AS cogs,
    sum(ipr.product_revenue) - sum(ic.total_cogs) AS gross_profit
   FROM shop_crm.invoices i
     JOIN shop_crm.invoice_product_revenue ipr ON ipr.invoice_id = i.id
     JOIN shop_crm.invoice_cogs ic ON ic.invoice_id = i.id
  GROUP BY i.shop_id, (date_trunc('day'::text, i.issued_at));
CREATE VIEW shop_crm."net_profit" AS
SELECT gm.shop_id,
    gm.day,
    gm.gross_profit - COALESCE(e.total_expenses, 0::numeric) AS net_profit
   FROM shop_crm.daily_cogs_margin gm
     LEFT JOIN ( SELECT expenses.shop_id,
            date_trunc('day'::text, expenses.expense_date) AS day,
            sum(expenses.amount) AS total_expenses
           FROM shop_crm.expenses
          WHERE expenses.status = 'paid'::expense_status
          GROUP BY expenses.shop_id, (date_trunc('day'::text, expenses.expense_date))) e ON e.shop_id = gm.shop_id AND e.day = gm.day;

ALTER TABLE shop_crm."clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."expense_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."inventory_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."membership_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."portals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."shop_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."shops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."vendor_invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."vendor_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_crm."vendors" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_insert" ON shop_crm."clients" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'clients.manage'::text) AND (created_by_profile_id IN ( SELECT profiles.id
   FROM shop_crm.profiles
  WHERE (profiles.user_id = auth.uid())))));
CREATE POLICY "clients_select" ON shop_crm."clients" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'clients.view'::text)));
CREATE POLICY "clients_update" ON shop_crm."clients" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (user_is_member_of_shop(shop_id)) WITH CHECK ((shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'clients.manage'::text)));
CREATE POLICY "expense_categories_manage" ON shop_crm."expense_categories" AS PERMISSIVE FOR ALL TO PUBLIC USING (user_is_member_of_shop(shop_id)) WITH CHECK ((shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'expenses.manage'::text)));
CREATE POLICY "expense_categories_select" ON shop_crm."expense_categories" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'expenses.view'::text)));
CREATE POLICY "expenses_manage" ON shop_crm."expenses" AS PERMISSIVE FOR ALL TO PUBLIC USING (user_is_member_of_shop(shop_id)) WITH CHECK ((shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'expenses.manage'::text)));
CREATE POLICY "expenses_select" ON shop_crm."expenses" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'expenses.view'::text)));
CREATE POLICY "inventory_batches_insert_manage_only" ON shop_crm."inventory_batches" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_is_member_of_shop(shop_id) AND shop_has_feature(shop_id, 'inventory'::text) AND user_has_shop_permission(shop_id, 'inventory.manage'::text)));
CREATE POLICY "inventory_batches_select_with_access" ON shop_crm."inventory_batches" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_is_member_of_shop(shop_id) AND shop_has_feature(shop_id, 'inventory'::text) AND user_has_shop_permission(shop_id, 'inventory.view'::text)));
CREATE POLICY "inventory_batches_update_fifo_only" ON shop_crm."inventory_batches" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (shop_has_feature(shop_id, 'inventory'::text)) WITH CHECK ((shop_has_feature(shop_id, 'inventory'::text) AND user_has_shop_permission(shop_id, 'inventory.manage'::text)));
CREATE POLICY "inventory_movements_insert_manage_only" ON shop_crm."inventory_movements" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_is_member_of_shop(shop_id) AND shop_has_feature(shop_id, 'inventory'::text) AND user_has_shop_permission(shop_id, 'inventory.manage'::text)));
CREATE POLICY "inventory_movements_select_with_access" ON shop_crm."inventory_movements" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_is_member_of_shop(shop_id) AND shop_has_feature(shop_id, 'inventory'::text) AND user_has_shop_permission(shop_id, 'inventory.view'::text)));
CREATE POLICY "invoice_items_delete_via_invoice" ON shop_crm."invoice_items" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM shop_crm.invoices i
  WHERE (i.id = invoice_items.invoice_id))));
CREATE POLICY "invoice_items_insert_via_invoice" ON shop_crm."invoice_items" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM shop_crm.invoices i
  WHERE (i.id = invoice_items.invoice_id))));
CREATE POLICY "invoice_items_select_via_invoice" ON shop_crm."invoice_items" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM shop_crm.invoices i
  WHERE (i.id = invoice_items.invoice_id))));
CREATE POLICY "invoice_items_update_via_invoice" ON shop_crm."invoice_items" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM shop_crm.invoices i
  WHERE (i.id = invoice_items.invoice_id))));
CREATE POLICY "invoices_insert_with_permission" ON shop_crm."invoices" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'invoice.create'::text) AND (created_by_profile_id IN ( SELECT profiles.id
   FROM shop_crm.profiles
  WHERE (profiles.user_id = auth.uid()))) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1
   FROM shop_crm.clients c
  WHERE ((c.id = invoices.client_id) AND (c.shop_id = invoices.shop_id)))))));
CREATE POLICY "invoices_select_with_access" ON shop_crm."invoices" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'invoice.view'::text)));
CREATE POLICY "invoices_update_with_permission" ON shop_crm."invoices" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (user_is_member_of_shop(shop_id)) WITH CHECK ((shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'invoice.update'::text) AND ((client_id IS NULL) OR (EXISTS ( SELECT 1
   FROM shop_crm.clients c
  WHERE ((c.id = invoices.client_id) AND (c.shop_id = invoices.shop_id)))))));
CREATE POLICY "membership_roles_delete_owner_only" ON shop_crm."membership_roles" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM ((shop_crm.shop_memberships sm_owner
     JOIN shop_crm.shop_memberships sm_target ON ((sm_target.id = membership_roles.membership_id)))
     JOIN shop_crm.profiles p ON ((p.id = sm_owner.profile_id)))
  WHERE ((sm_owner.shop_id = sm_target.shop_id) AND (sm_owner.role = 'owner'::text) AND (p.user_id = auth.uid())))));
CREATE POLICY "membership_roles_insert_owner_only" ON shop_crm."membership_roles" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM ((shop_crm.shop_memberships sm_owner
     JOIN shop_crm.shop_memberships sm_target ON ((sm_target.id = membership_roles.membership_id)))
     JOIN shop_crm.profiles p ON ((p.id = sm_owner.profile_id)))
  WHERE ((sm_owner.shop_id = sm_target.shop_id) AND (sm_owner.role = 'owner'::text) AND (p.user_id = auth.uid())))));
CREATE POLICY "membership_roles_select_owner_of_self" ON shop_crm."membership_roles" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM (shop_crm.shop_memberships sm
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((sm.id = membership_roles.membership_id) AND (p.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM ((shop_crm.shop_memberships sm_owner
     JOIN shop_crm.shop_memberships sm_target ON ((sm_target.id = membership_roles.membership_id)))
     JOIN shop_crm.profiles p ON ((p.id = sm_owner.profile_id)))
  WHERE ((sm_owner.shop_id = sm_target.shop_id) AND (sm_owner.role = 'owner'::text) AND (p.user_id = auth.uid()))))));
CREATE POLICY "payments_insert" ON shop_crm."payments" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'payments.manage'::text) AND (created_by_profile_id IN ( SELECT profiles.id
   FROM shop_crm.profiles
  WHERE (profiles.user_id = auth.uid())))));
CREATE POLICY "payments_select" ON shop_crm."payments" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'payments.view'::text)));
CREATE POLICY "permissions_read_all" ON shop_crm."permissions" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "plans_read_public" ON shop_crm."plans" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((is_active = true) AND (is_public = true)));
CREATE POLICY "portals_read_all" ON shop_crm."portals" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "products_insert_with_inventory_permission" ON shop_crm."products" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_is_member_of_shop(shop_id) AND (created_by_profile_id IN ( SELECT profiles.id
   FROM shop_crm.profiles
  WHERE (profiles.user_id = auth.uid()))) AND shop_has_feature(shop_id, 'inventory'::text) AND user_has_shop_permission(shop_id, 'inventory.manage'::text)));
CREATE POLICY "products_select_with_inventory_access" ON shop_crm."products" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_is_member_of_shop(shop_id) AND shop_has_feature(shop_id, 'inventory'::text) AND user_has_shop_permission(shop_id, 'inventory.view'::text)));
CREATE POLICY "products_update_with_inventory_permission" ON shop_crm."products" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (user_is_member_of_shop(shop_id)) WITH CHECK ((shop_has_feature(shop_id, 'inventory'::text) AND user_has_shop_permission(shop_id, 'inventory.manage'::text)));
CREATE POLICY "profiles_insert_own" ON shop_crm."profiles" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "profiles_select_own" ON shop_crm."profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));
CREATE POLICY "profiles_update_own" ON shop_crm."profiles" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "role_permissions_delete_owner_only" ON shop_crm."role_permissions" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM ((shop_crm.roles r
     JOIN shop_crm.shop_memberships sm ON ((sm.shop_id = r.shop_id)))
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((r.id = role_permissions.role_id) AND (p.user_id = auth.uid())))));
CREATE POLICY "role_permissions_insert_owner_only" ON shop_crm."role_permissions" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM ((shop_crm.roles r
     JOIN shop_crm.shop_memberships sm ON ((sm.shop_id = r.shop_id)))
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((r.id = role_permissions.role_id) AND (p.user_id = auth.uid())))));
CREATE POLICY "role_permissions_select_visible_roles" ON shop_crm."role_permissions" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM ((shop_crm.roles r
     JOIN shop_crm.shop_memberships sm ON ((sm.shop_id = r.shop_id)))
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((r.id = role_permissions.role_id) AND (p.user_id = auth.uid())))));
CREATE POLICY "roles_delete_owner_only" ON shop_crm."roles" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (shop_crm.shop_memberships sm
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((sm.shop_id = roles.shop_id) AND (sm.role = 'owner'::text) AND (p.user_id = auth.uid())))));
CREATE POLICY "roles_insert_owner_only" ON shop_crm."roles" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM (shop_crm.shop_memberships sm
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((sm.shop_id = roles.shop_id) AND (sm.role = 'owner'::text) AND (p.user_id = auth.uid())))));
CREATE POLICY "roles_select_shop_members" ON shop_crm."roles" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (shop_crm.shop_memberships sm
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((sm.shop_id = roles.shop_id) AND (p.user_id = auth.uid())))));
CREATE POLICY "roles_update_owner_only" ON shop_crm."roles" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (shop_crm.shop_memberships sm
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((sm.shop_id = roles.shop_id) AND (sm.role = 'owner'::text) AND (p.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (shop_crm.shop_memberships sm
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((sm.shop_id = roles.shop_id) AND (sm.role = 'owner'::text) AND (p.user_id = auth.uid())))));
CREATE POLICY "services_insert" ON shop_crm."services" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'services.manage'::text) AND (created_by_profile_id IN ( SELECT profiles.id
   FROM shop_crm.profiles
  WHERE (profiles.user_id = auth.uid())))));
CREATE POLICY "services_select" ON shop_crm."services" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'services.view'::text)));
CREATE POLICY "services_update" ON shop_crm."services" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (user_is_member_of_shop(shop_id)) WITH CHECK ((shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'services.manage'::text)));
CREATE POLICY "membership_insert_owner" ON shop_crm."shop_memberships" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM (shop_crm.shop_memberships sm
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((sm.shop_id = shop_memberships.shop_id) AND (sm.role = 'owner'::text) AND (p.user_id = auth.uid())))));
CREATE POLICY "membership_select_self_or_owner" ON shop_crm."shop_memberships" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((profile_id IN ( SELECT profiles.id
   FROM shop_crm.profiles
  WHERE (profiles.user_id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM (shop_crm.shop_memberships sm
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((sm.shop_id = shop_memberships.shop_id) AND (sm.role = 'owner'::text) AND (p.user_id = auth.uid()))))));
CREATE POLICY "membership_update_owner" ON shop_crm."shop_memberships" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (shop_crm.shop_memberships sm
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((sm.shop_id = shop_memberships.shop_id) AND (sm.role = 'owner'::text) AND (p.user_id = auth.uid())))));
CREATE POLICY "shops_select_member" ON shop_crm."shops" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (shop_crm.shop_memberships sm
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((sm.shop_id = shops.id) AND (p.user_id = auth.uid())))));
CREATE POLICY "shops_update_owner" ON shop_crm."shops" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (shop_crm.shop_memberships sm
     JOIN shop_crm.profiles p ON ((p.id = sm.profile_id)))
  WHERE ((sm.shop_id = shops.id) AND (sm.role = 'owner'::text) AND (p.user_id = auth.uid())))));
CREATE POLICY "subscriptions_owner_only" ON shop_crm."subscriptions" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((profile_id IN ( SELECT profiles.id
   FROM shop_crm.profiles
  WHERE (profiles.user_id = auth.uid()))));
CREATE POLICY "subscriptions_update_owner" ON shop_crm."subscriptions" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((profile_id IN ( SELECT profiles.id
   FROM shop_crm.profiles
  WHERE (profiles.user_id = auth.uid()))));
CREATE POLICY "vendor_invoice_items_select" ON shop_crm."vendor_invoice_items" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM shop_crm.vendor_invoices vi
  WHERE (vi.id = vendor_invoice_items.vendor_invoice_id))));
CREATE POLICY "vendor_invoice_items_write" ON shop_crm."vendor_invoice_items" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM shop_crm.vendor_invoices vi
  WHERE (vi.id = vendor_invoice_items.vendor_invoice_id)))) WITH CHECK ((EXISTS ( SELECT 1
   FROM shop_crm.vendor_invoices vi
  WHERE (vi.id = vendor_invoice_items.vendor_invoice_id))));
CREATE POLICY "vendor_invoice_select" ON shop_crm."vendor_invoices" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'vendor_invoices.view'::text)));
CREATE POLICY "vendor_invoices_insert" ON shop_crm."vendor_invoices" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'vendor_invoices.manage'::text) AND (created_by_profile_id IN ( SELECT profiles.id
   FROM shop_crm.profiles
  WHERE (profiles.user_id = auth.uid()))) AND ((vendor_id IS NULL) OR (EXISTS ( SELECT 1
   FROM shop_crm.vendors v
  WHERE ((v.id = vendor_invoices.vendor_id) AND (v.shop_id = vendor_invoices.shop_id)))))));
CREATE POLICY "vendor_invoices_update" ON shop_crm."vendor_invoices" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (user_is_member_of_shop(shop_id)) WITH CHECK ((shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'vendor_invoices.manage'::text) AND ((vendor_id IS NULL) OR (EXISTS ( SELECT 1
   FROM shop_crm.vendors v
  WHERE ((v.id = vendor_invoices.vendor_id) AND (v.shop_id = vendor_invoices.shop_id)))))));
CREATE POLICY "vendors_insert" ON shop_crm."vendors" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'vendors.manage'::text) AND (created_by_profile_id IN ( SELECT profiles.id
   FROM shop_crm.profiles
  WHERE (profiles.user_id = auth.uid())))));
CREATE POLICY "vendors_select" ON shop_crm."vendors" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_is_member_of_shop(shop_id) AND shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'vendors.view'::text)));
CREATE POLICY "vendors_update" ON shop_crm."vendors" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (user_is_member_of_shop(shop_id)) WITH CHECK ((shop_has_active_subscription(shop_id) AND user_has_shop_permission(shop_id, 'vendors.manage'::text)));

CREATE TRIGGER trg_check_expense_period BEFORE INSERT ON shop_crm.expenses FOR EACH ROW EXECUTE FUNCTION check_expense_period();
CREATE TRIGGER trg_prevent_inventory_movement_update BEFORE DELETE OR UPDATE ON shop_crm.inventory_movements FOR EACH ROW EXECUTE FUNCTION prevent_inventory_movment_mutation();
CREATE TRIGGER trg_check_invoice_period BEFORE INSERT ON shop_crm.invoices FOR EACH ROW WHEN (new.status = 'issued'::invoice_status) EXECUTE FUNCTION check_invoice_period();
CREATE TRIGGER trg_prevent_invoice_edit BEFORE UPDATE ON shop_crm.invoices FOR EACH ROW EXECUTE FUNCTION prevent_invoice_edit_after_issue();
CREATE TRIGGER trg_check_payment_period BEFORE INSERT ON shop_crm.payments FOR EACH ROW EXECUTE FUNCTION check_payment_period();
CREATE TRIGGER trg_prevent_payment_update BEFORE DELETE OR UPDATE ON shop_crm.payments FOR EACH ROW EXECUTE FUNCTION prevent_payment_update();
CREATE TRIGGER trg_prevent_vendor_invoice_edit BEFORE UPDATE ON shop_crm.vendor_invoices FOR EACH ROW EXECUTE FUNCTION prevent_vendor_invoice_edit_after_post();

GRANT USAGE ON SCHEMA shop_crm TO anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA shop_crm FROM anon, authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."accounting_periods" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."accounting_periods" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."cash_flow_daily" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."cash_flow_daily" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."cash_flow_monthly" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."cash_flow_monthly" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."client_balances" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."client_balances" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."clients" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."clients" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."cogs_movements" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."cogs_movements" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."daily_cogs_margin" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."daily_cogs_margin" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."dead_stock" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."dead_stock" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."expense_categories" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."expense_categories" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."expenses" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."expenses" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_aging" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_aging" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_aging_value" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_aging_value" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_batches" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_batches" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_movements" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_movements" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_stock_batches" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_stock_batches" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_turnover" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."inventory_turnover" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_balances" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_balances" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_cogs" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_cogs" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_gross_margin" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_gross_margin" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_items" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_items" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_paid_amounts" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_paid_amounts" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_product_cogs" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_product_cogs" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_product_revenue" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoice_product_revenue" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoices" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."invoices" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."membership_roles" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."membership_roles" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."monthly_cogs_margin" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."monthly_cogs_margin" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."net_profit" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."net_profit" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."payments" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."payments" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."permissions" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."permissions" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."plans" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."plans" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."portals" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."portals" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."product_average_inventory" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."product_average_inventory" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."product_last_sale" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."product_last_sale" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."product_profitability" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."product_profitability" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."product_sales_90d" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."product_sales_90d" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."products" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."products" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."profiles" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."profiles" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."role_permissions" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."role_permissions" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."roles" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."roles" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."services" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."services" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."shop_memberships" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."shop_memberships" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."shops" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."shops" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."subscriptions" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."subscriptions" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendor_balances" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendor_balances" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendor_invoice_balances" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendor_invoice_balances" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendor_invoice_items" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendor_invoice_items" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendor_invoice_paid_amounts" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendor_invoice_paid_amounts" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendor_invoices" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendor_invoices" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendors" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE shop_crm."vendors" TO "authenticated";



-- Preserved source step: 20260918171948_shop_crm_read_isolation.sql
-- Shop Suit task 03: establish a safe read boundary before exposing shop_crm.
-- This migration intentionally grants no browser writes. Subsequent feature
-- migrations must add controlled, tenant-checked write functions and tests.

create schema if not exists shop_private;
revoke all on schema shop_private from public, anon, authenticated;
grant usage on schema shop_private to authenticated;

-- The functions bypass membership-table RLS to avoid policy recursion. Every
-- result is tied to auth.uid(), an active shop profile and active membership.
create or replace function shop_private.is_member(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from shop_crm.shop_memberships m
    join shop_crm.profiles p on p.id = m.profile_id
    join shop_crm.shops s on s.id = m.shop_id and s.portal_id = p.portal_id
    where m.shop_id = p_shop_id
      and p.user_id = (select auth.uid())
      and p.status = 'active'::public.profile_status
      and m.status = 'active'::public.shop_membership_status
  );
$$;

create or replace function shop_private.is_owner(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from shop_crm.shop_memberships m
    join shop_crm.profiles p on p.id = m.profile_id
    join shop_crm.shops s on s.id = m.shop_id and s.portal_id = p.portal_id
    where m.shop_id = p_shop_id
      and m.role = 'owner'
      and p.user_id = (select auth.uid())
      and p.status = 'active'::public.profile_status
      and m.status = 'active'::public.shop_membership_status
  );
$$;

create or replace function shop_private.has_permission(
  p_shop_id uuid, p_permission_key text
) returns boolean language sql stable security definer set search_path = '' as $$
  select shop_private.is_owner(p_shop_id) or exists (
    select 1
    from shop_crm.shop_memberships m
    join shop_crm.profiles p on p.id = m.profile_id
    join shop_crm.shops s on s.id = m.shop_id and s.portal_id = p.portal_id
    join shop_crm.membership_roles mr on mr.membership_id = m.id
    join shop_crm.roles r on r.id = mr.role_id and r.shop_id = m.shop_id
    join shop_crm.role_permissions rp on rp.role_id = r.id
    join shop_crm.permissions perm on perm.id = rp.permission_id
      and perm.portal_id = s.portal_id
    where m.shop_id = p_shop_id
      and p.user_id = (select auth.uid())
      and p.status = 'active'::public.profile_status
      and m.status = 'active'::public.shop_membership_status
      and perm.key = p_permission_key
  );
$$;

-- A closed accounting period must be checked regardless of the caller's
-- permission to read the accounting_periods table.
create or replace function shop_private.assert_period_is_open(
  p_shop_id uuid, p_when timestamptz
) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_shop_id is null or p_when is null then
    raise exception 'ACCOUNTING_PERIOD_ARGUMENT_REQUIRED';
  end if;
  if exists (
    select 1 from shop_crm.accounting_periods ap
    where ap.shop_id = p_shop_id
      and ap.is_closed
      and p_when::date between ap.period_start and ap.period_end
  ) then
    raise exception 'ACCOUNTING_PERIOD_CLOSED';
  end if;
end;
$$;

revoke all on all functions in schema shop_private from public, anon, authenticated;
grant execute on function shop_private.is_member(uuid),
  shop_private.is_owner(uuid), shop_private.has_permission(uuid, text),
  shop_private.assert_period_is_open(uuid, timestamptz) to authenticated;

-- Existing trigger functions pointed at nonexistent public shop tables. Keep
-- their signatures for the attached triggers, but use the private period check.
create or replace function public.assert_period_is_open(
  _shop_id uuid, _date timestamptz
) returns void language plpgsql set search_path = '' as $$
begin
  perform shop_private.assert_period_is_open(_shop_id, _date);
end;
$$;

create or replace function public.check_expense_period()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'paid'::public.expense_status then
    perform shop_private.assert_period_is_open(new.shop_id, new.expense_date);
  end if;
  return new;
end;
$$;

create or replace function public.check_invoice_period()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform shop_private.assert_period_is_open(new.shop_id, new.issued_at);
  return new;
end;
$$;

create or replace function public.check_payment_period()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform shop_private.assert_period_is_open(new.shop_id, new.paid_at);
  return new;
end;
$$;

-- Legacy shop functions have no reliable tenant checks and several reference
-- nonexistent public tables. They remain for forensic compatibility but cannot
-- be called through the exposed public RPC API by browser roles.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'assert_period_is_open', 'check_expense_period', 'check_invoice_period',
      'check_payment_period', 'deduct_inventory_fifo',
      'issue_invoice_and_deduct_inventory', 'post_vendor_invoice_and_create_batches',
      'prevent_inventory_movment_mutation', 'prevent_invoice_edit_after_issue',
      'prevent_payment_update', 'prevent_vendor_invoice_edit_after_post',
      'return_inventory_for_invoice', 'shop_has_active_subscription',
      'shop_has_feature', 'user_has_shop_permission', 'user_is_member_of_shop'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated',
      f.signature);
  end loop;
end;
$$;

-- Views owned by postgres otherwise bypass underlying RLS. They are not yet
-- granted to browser roles; later report work can grant selected safe views.
do $$
declare v record;
begin
  for v in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'shop_crm' and c.relkind = 'v'
  loop
    execute format('alter view shop_crm.%I set (security_invoker = true)', v.relname);
  end loop;
end;
$$;

-- Replace every permissive policy as one atomic migration. Accounting periods
-- had RLS disabled. All shop data reads remain available to authorized members
-- after a trial lapses; product writes are separately disabled by grants.
do $$
declare p record;
begin
  for p in select tablename from pg_tables where schemaname = 'shop_crm' loop
    execute format('alter table shop_crm.%I enable row level security', p.tablename);
  end loop;
  for p in select tablename, policyname from pg_policies where schemaname = 'shop_crm' loop
    execute format('drop policy %I on shop_crm.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

create policy portal_catalog_read on shop_crm.portals for select
  to anon, authenticated using (key = 'shop-crm' and is_active);
create policy plan_catalog_read on shop_crm.plans for select
  to anon, authenticated using (
    is_active and is_public and exists (
      select 1 from shop_crm.portals p
      where p.id = portal_id and p.key = 'shop-crm' and p.is_active
    )
  );
create policy profile_self_read on shop_crm.profiles for select
  to authenticated using (user_id = (select auth.uid()));
create policy shop_member_read on shop_crm.shops for select
  to authenticated using (shop_private.is_member(id));
create policy membership_self_or_owner_read on shop_crm.shop_memberships for select
  to authenticated using (
    shop_private.is_owner(shop_id) or exists (
      select 1 from shop_crm.profiles p
      where p.id = profile_id and p.user_id = (select auth.uid())
    )
  );
create policy subscription_owner_read on shop_crm.subscriptions for select
  to authenticated using (
    exists (
      select 1 from shop_crm.shop_memberships m
      where m.profile_id = subscriptions.profile_id
        and m.role = 'owner' and shop_private.is_owner(m.shop_id)
    )
  );
create policy role_member_read on shop_crm.roles for select
  to authenticated using (shop_private.is_member(shop_id));
create policy permission_portal_read on shop_crm.permissions for select
  to authenticated using (
    exists (
      select 1 from shop_crm.profiles p
      where p.portal_id = permissions.portal_id
        and p.user_id = (select auth.uid())
        and p.status = 'active'::public.profile_status
    )
  );
create policy membership_role_self_or_owner_read on shop_crm.membership_roles for select
  to authenticated using (
    exists (
      select 1 from shop_crm.shop_memberships m
      where m.id = membership_roles.membership_id
        and (shop_private.is_owner(m.shop_id) or exists (
          select 1 from shop_crm.profiles p
          where p.id = m.profile_id and p.user_id = (select auth.uid())
        ))
    )
  );
create policy role_permission_member_read on shop_crm.role_permissions for select
  to authenticated using (
    exists (
      select 1 from shop_crm.roles r
      where r.id = role_permissions.role_id and shop_private.is_member(r.shop_id)
    )
  );
create policy period_owner_read on shop_crm.accounting_periods for select
  to authenticated using (shop_private.is_owner(shop_id));

create policy products_permission_read on shop_crm.products for select
  to authenticated using (shop_private.has_permission(shop_id, 'inventory.view'));
create policy services_permission_read on shop_crm.services for select
  to authenticated using (shop_private.has_permission(shop_id, 'services.view'));
create policy clients_permission_read on shop_crm.clients for select
  to authenticated using (shop_private.has_permission(shop_id, 'clients.view'));
create policy vendors_permission_read on shop_crm.vendors for select
  to authenticated using (shop_private.has_permission(shop_id, 'vendors.view'));
create policy invoice_permission_read on shop_crm.invoices for select
  to authenticated using (shop_private.has_permission(shop_id, 'invoice.view'));
create policy vendor_invoice_permission_read on shop_crm.vendor_invoices for select
  to authenticated using (shop_private.has_permission(shop_id, 'vendor_invoices.view'));
create policy payment_permission_read on shop_crm.payments for select
  to authenticated using (shop_private.has_permission(shop_id, 'payments.view'));
create policy expense_permission_read on shop_crm.expenses for select
  to authenticated using (shop_private.has_permission(shop_id, 'expenses.view'));
create policy expense_category_permission_read on shop_crm.expense_categories for select
  to authenticated using (shop_private.has_permission(shop_id, 'expenses.view'));
create policy inventory_batch_permission_read on shop_crm.inventory_batches for select
  to authenticated using (shop_private.has_permission(shop_id, 'inventory.view'));
create policy inventory_movement_permission_read on shop_crm.inventory_movements for select
  to authenticated using (shop_private.has_permission(shop_id, 'inventory.view'));
create policy invoice_item_permission_read on shop_crm.invoice_items for select
  to authenticated using (
    exists (select 1 from shop_crm.invoices i where i.id = invoice_id
      and shop_private.has_permission(i.shop_id, 'invoice.view'))
  );
create policy vendor_invoice_item_permission_read on shop_crm.vendor_invoice_items for select
  to authenticated using (
    exists (select 1 from shop_crm.vendor_invoices vi where vi.id = vendor_invoice_id
      and shop_private.has_permission(vi.shop_id, 'vendor_invoices.view'))
  );

-- Remove all browser table/view privileges, including TRUNCATE. Allow only
-- the specific reads above. No INSERT/UPDATE/DELETE/EXECUTE path is granted
-- for business mutations by this migration.
revoke all on all tables in schema shop_crm from public, anon, authenticated;
grant usage on schema shop_crm to anon, authenticated;

do $$
declare t record;
begin
  for t in select tablename from pg_tables
    where schemaname = 'shop_crm'
      and tablename not in ('portals', 'plans', 'subscriptions')
  loop
    execute format('grant select on table shop_crm.%I to authenticated', t.tablename);
  end loop;
end;
$$;

grant select (id, key, name, is_active) on shop_crm.portals to anon, authenticated;
grant select (
  id, portal_id, name, slug, price_amount, currency, billing_interval,
  trial_days, features, sort_order, is_active, is_public, is_coming_soon
) on shop_crm.plans to anon, authenticated;
grant select (
  id, profile_id, plan_id, status, trial_start_at, trial_end_at,
  current_period_start, current_period_end, trial_consumed, locked_at,
  created_at, updated_at
) on shop_crm.subscriptions to authenticated;


-- Preserved source step: 20260918172432_shop_crm_private_trigger_grants.sql
-- The invoker trigger functions need the private period check when a trusted
-- service_role write eventually posts an invoice, payment or expense.
grant usage on schema shop_private to service_role;
grant execute on function shop_private.assert_period_is_open(uuid, timestamptz)
  to service_role;


-- Preserved source step: 20260918172641_shop_crm_legacy_function_paths.sql
-- Existing public shop helpers remain revoked from browser roles until their
-- business logic is rebuilt. Pin their search paths to remove role-dependent
-- object lookup, including the attached immutable/period trigger helpers.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'assert_period_is_open', 'check_expense_period', 'check_invoice_period',
      'check_payment_period', 'deduct_inventory_fifo',
      'issue_invoice_and_deduct_inventory', 'post_vendor_invoice_and_create_batches',
      'prevent_inventory_movment_mutation', 'prevent_invoice_edit_after_issue',
      'prevent_payment_update', 'prevent_vendor_invoice_edit_after_post',
      'return_inventory_for_invoice', 'shop_has_active_subscription',
      'shop_has_feature', 'user_has_shop_permission', 'user_is_member_of_shop'
    ])
  loop
    execute format('alter function %s set search_path = %L', f.signature, '');
  end loop;
end;
$$;


-- Preserved source step: 20260918183601_expose_shop_crm_data_api.sql
-- The hosted project already exposes public and graphql_public. Keep both and
-- add the isolated Shop Suit schema for Supabase Client requests.
-- All shop_crm tables have RLS; browser grants are scoped in Task 03.
-- This role setting takes precedence over the Dashboard exposed-schema list.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, shop_crm';
notify pgrst, 'reload config';


-- Preserved source step: 20260918184551_bootstrap_owner_shop.sql
-- A single, authenticated first-shop transaction. The privileged body stays
-- outside exposed schemas; the Data API sees only an invoker wrapper.
create function shop_private.create_owner_shop(
  p_shop_name text,
  p_plan_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_display_name text;
  v_portal_id uuid;
  v_profile_id uuid;
  v_profile_status text;
  v_existing_shop_id uuid;
  v_shop_id uuid;
  v_plan_id uuid;
  v_trial_days integer;
  v_started_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_shop_name is null or length(btrim(p_shop_name)) < 2
     or length(btrim(p_shop_name)) > 120 then
    raise exception 'INVALID_SHOP_NAME' using errcode = '22023';
  end if;

  -- Serialize retries from this identity, including concurrent browser tabs.
  select u.email, nullif(btrim(u.raw_user_meta_data ->> 'display_name'), '')
    into v_email, v_display_name
  from auth.users u
  where u.id = v_user_id
  for update;
  if not found then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select p.id into v_portal_id
  from shop_crm.portals p
  where p.key = 'shop-crm' and p.is_active;
  if v_portal_id is null then
    raise exception 'PORTAL_UNAVAILABLE';
  end if;

  select p.id, p.status::text into v_profile_id, v_profile_status
  from shop_crm.profiles p
  where p.user_id = v_user_id and p.portal_id = v_portal_id;
  if v_profile_id is null then
    insert into shop_crm.profiles (
      user_id, portal_id, display_name, email_snapshot
    ) values (
      v_user_id, v_portal_id, v_display_name, v_email
    ) returning id into v_profile_id;
  elsif v_profile_status <> 'active' then
    raise exception 'PROFILE_INACTIVE';
  end if;

  -- A repeated submit returns the first shop without extending its trial or
  -- changing its plan. This also prevents a second self-service shop for now.
  select m.shop_id into v_existing_shop_id
  from shop_crm.shop_memberships m
  where m.profile_id = v_profile_id and m.role = 'owner'
  order by m.created_at, m.id
  limit 1;
  if v_existing_shop_id is not null then
    return v_existing_shop_id;
  end if;
  if exists (
    select 1 from shop_crm.subscriptions s where s.profile_id = v_profile_id
  ) then
    raise exception 'SUBSCRIPTION_REQUIRES_REVIEW';
  end if;

  select p.id, p.trial_days into v_plan_id, v_trial_days
  from shop_crm.plans p
  where p.portal_id = v_portal_id
    and p.slug = p_plan_slug
    and p.is_active and p.is_public and not p.is_coming_soon
    and p.trial_days > 0;
  if v_plan_id is null then
    raise exception 'PLAN_UNAVAILABLE' using errcode = '22023';
  end if;

  insert into shop_crm.shops (portal_id, name)
  values (v_portal_id, btrim(p_shop_name))
  returning id into v_shop_id;

  insert into shop_crm.shop_memberships (shop_id, profile_id, role)
  values (v_shop_id, v_profile_id, 'owner');

  insert into shop_crm.subscriptions (
    profile_id, plan_id, status, trial_start_at, trial_end_at,
    current_period_start, current_period_end, trial_consumed
  ) values (
    v_profile_id, v_plan_id, 'trialing', v_started_at,
    v_started_at + v_trial_days * interval '1 day',
    v_started_at, v_started_at + v_trial_days * interval '1 day', true
  );

  return v_shop_id;
end;
$$;

revoke all on function shop_private.create_owner_shop(text, text)
  from public, anon, authenticated;
grant usage on schema shop_private to authenticated;
grant execute on function shop_private.create_owner_shop(text, text)
  to authenticated;

create function shop_crm.create_owner_shop(
  p_shop_name text,
  p_plan_slug text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.create_owner_shop(p_shop_name, p_plan_slug);
$$;

revoke all on function shop_crm.create_owner_shop(text, text)
  from public, anon, authenticated;
grant execute on function shop_crm.create_owner_shop(text, text)
  to authenticated;

notify pgrst, 'reload schema';


-- Preserved source step: 20260918185827_shop_product_catalog.sql
-- First daily workflow: a sale price and a quota-checked product catalog.
alter table shop_crm.products
  add column sale_price numeric(12, 2) not null default 0;
alter table shop_crm.products
  add constraint products_sale_price_nonnegative check (sale_price >= 0);
create unique index products_shop_active_sku_unique
  on shop_crm.products (shop_id, lower(sku))
  where is_active and sku is not null;

-- These initial Shop Suit catalog caps are stored with each commercial plan,
-- not in the browser. Existing feature keys are preserved.
update shop_crm.plans p
set features = jsonb_set(p.features, '{max_products}', to_jsonb(100), true)
where p.slug = 'basic'
  and p.portal_id = (select id from shop_crm.portals where key = 'shop-crm')
  and not (p.features ? 'max_products');
update shop_crm.plans p
set features = jsonb_set(p.features, '{max_products}', to_jsonb(1000), true)
where p.slug = 'pro'
  and p.portal_id = (select id from shop_crm.portals where key = 'shop-crm')
  and not (p.features ? 'max_products');

create function shop_private.assert_shop_write_access(
  p_shop_id uuid,
  p_permission_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  select m.profile_id into v_profile_id
  from shop_crm.shop_memberships m
  join shop_crm.profiles p on p.id = m.profile_id
  join shop_crm.shops s on s.id = m.shop_id and s.portal_id = p.portal_id
  where m.shop_id = p_shop_id and p.user_id = auth.uid()
    and m.status = 'active' and p.status = 'active' and s.status = 'active';
  if v_profile_id is null
    or not shop_private.has_permission(p_shop_id, p_permission_key) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from shop_crm.shop_memberships owner_member
    join shop_crm.profiles owner_profile
      on owner_profile.id = owner_member.profile_id
    join shop_crm.subscriptions sub
      on sub.profile_id = owner_member.profile_id
    where owner_member.shop_id = p_shop_id
      and owner_member.role = 'owner'
      and owner_member.status = 'active'
      and owner_profile.status = 'active'
      and (
        (sub.status = 'trialing' and sub.trial_end_at > now())
        or (sub.status = 'active' and sub.current_period_end > now())
      )
  ) then
    raise exception 'SHOP_SUBSCRIPTION_INACTIVE' using errcode = '42501';
  end if;
  return v_profile_id;
end;
$$;
revoke all on function shop_private.assert_shop_write_access(uuid, text)
  from public, anon, authenticated;

create function shop_private.save_product(
  p_shop_id uuid,
  p_product_id uuid,
  p_name text,
  p_sku text,
  p_barcode text,
  p_sale_price numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_product_id uuid;
  v_limit integer;
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );
  if p_name is null or length(btrim(p_name)) < 2
     or length(btrim(p_name)) > 160
     or p_sale_price is null or p_sale_price < 0
     or p_sale_price > 999999999.99
     or (p_sku is not null and length(btrim(p_sku)) > 80)
     or (p_barcode is not null and length(btrim(p_barcode)) > 80) then
    raise exception 'INVALID_PRODUCT' using errcode = '22023';
  end if;

  -- One lock coordinates quota-increasing calls for this shop.
  perform 1 from shop_crm.shops s where s.id = p_shop_id for update;
  if not found then
    raise exception 'SHOP_NOT_FOUND';
  end if;
  perform shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );

  if p_product_id is null then
    select (plan.features ->> 'max_products')::integer into v_limit
    from shop_crm.shop_memberships m
    join shop_crm.subscriptions sub on sub.profile_id = m.profile_id
    join shop_crm.plans plan on plan.id = sub.plan_id
    where m.shop_id = p_shop_id and m.role = 'owner'
      and m.status = 'active';
    if v_limit is null or v_limit < 1 then
      raise exception 'PRODUCT_LIMIT_UNCONFIGURED';
    end if;
    if (select count(*) from shop_crm.products
        where shop_id = p_shop_id and is_active) >= v_limit then
      raise exception 'PRODUCT_LIMIT_REACHED' using errcode = '23514';
    end if;
    insert into shop_crm.products (
      shop_id, name, sku, barcode, sale_price, created_by_profile_id
    ) values (
      p_shop_id, btrim(p_name), nullif(btrim(p_sku), ''),
      nullif(btrim(p_barcode), ''), p_sale_price, v_profile_id
    ) returning id into v_product_id;
  else
    update shop_crm.products
    set name = btrim(p_name), sku = nullif(btrim(p_sku), ''),
        barcode = nullif(btrim(p_barcode), ''), sale_price = p_sale_price,
        updated_at = now()
    where id = p_product_id and shop_id = p_shop_id and is_active
    returning id into v_product_id;
    if v_product_id is null then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;
  end if;
  return v_product_id;
end;
$$;
revoke all on function shop_private.save_product(uuid, uuid, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function shop_private.save_product(uuid, uuid, text, text, text, numeric)
  to authenticated;

create function shop_crm.save_product(
  p_shop_id uuid,
  p_product_id uuid,
  p_name text,
  p_sku text,
  p_barcode text,
  p_sale_price numeric
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.save_product(
    p_shop_id, p_product_id, p_name, p_sku, p_barcode, p_sale_price
  );
$$;
revoke all on function shop_crm.save_product(uuid, uuid, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function shop_crm.save_product(uuid, uuid, text, text, text, numeric)
  to authenticated;

create function shop_private.archive_product(p_shop_id uuid, p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );
  update shop_crm.products
  set is_active = false, updated_at = now()
  where id = p_product_id and shop_id = p_shop_id and is_active;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
end;
$$;
revoke all on function shop_private.archive_product(uuid, uuid)
  from public, anon, authenticated;
grant execute on function shop_private.archive_product(uuid, uuid)
  to authenticated;

create function shop_crm.archive_product(p_shop_id uuid, p_product_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select shop_private.archive_product(p_shop_id, p_product_id);
$$;
revoke all on function shop_crm.archive_product(uuid, uuid)
  from public, anon, authenticated;
grant execute on function shop_crm.archive_product(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';


-- Preserved source step: 20260918190537_shop_inventory_adjustments.sql
-- Idempotent manual stock intake/write-off. Sales and supplier posting will use
-- the same product lock and FIFO batch order in later migrations.
alter table shop_crm.inventory_movements
  add column unit_cost_snapshot numeric(12, 2);
alter table shop_crm.inventory_movements
  add constraint inventory_movement_nonzero check (quantity_change <> 0);
alter table shop_crm.inventory_batches
  add constraint inventory_batch_positive_received check (quantity_received > 0);

create table shop_crm.stock_adjustment_requests (
  id uuid primary key,
  shop_id uuid not null references shop_crm.shops(id) on delete cascade,
  product_id uuid not null references shop_crm.products(id) on delete restrict,
  quantity_change numeric not null check (quantity_change <> 0),
  unit_cost numeric(12, 2),
  note text,
  created_by_profile_id uuid not null references shop_crm.profiles(id),
  created_at timestamptz not null default now()
);
alter table shop_crm.stock_adjustment_requests enable row level security;
revoke all on table shop_crm.stock_adjustment_requests from public, anon, authenticated;

create view shop_crm.product_stock
with (security_invoker = true)
as
select p.shop_id, p.id as product_id, p.name, p.sku, p.sale_price,
  coalesce(sum(b.remaining_quantity), 0)::numeric as quantity_on_hand
from shop_crm.products p
left join shop_crm.inventory_batches b
  on b.product_id = p.id and b.shop_id = p.shop_id
where p.is_active
group by p.shop_id, p.id, p.name, p.sku, p.sale_price;
revoke all on shop_crm.product_stock from public, anon, authenticated;
grant select on shop_crm.product_stock to authenticated;

create function shop_private.adjust_stock(
  p_request_id uuid,
  p_shop_id uuid,
  p_product_id uuid,
  p_quantity_change numeric,
  p_unit_cost numeric,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_existing shop_crm.stock_adjustment_requests%rowtype;
  v_batch record;
  v_batch_id uuid;
  v_remaining numeric;
  v_take numeric;
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );
  if p_request_id is null or p_product_id is null
    or p_quantity_change is null or p_quantity_change = 0
    or abs(p_quantity_change) > 1000000
    or round(p_quantity_change, 3) <> p_quantity_change
    or (p_quantity_change > 0 and
        (p_unit_cost is null or p_unit_cost < 0 or p_unit_cost > 999999999.99))
    or (p_quantity_change < 0 and
        (p_unit_cost is not null or p_note is null
         or length(btrim(p_note)) < 3))
    or (p_note is not null and length(btrim(p_note)) > 500) then
    raise exception 'INVALID_STOCK_ADJUSTMENT' using errcode = '22023';
  end if;

  -- All batch mutations for a product serialize here.
  perform 1 from shop_crm.products p
  where p.id = p_product_id and p.shop_id = p_shop_id and p.is_active
  for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  perform shop_private.assert_shop_write_access(
    p_shop_id, 'inventory.manage'
  );

  if not exists (
    select 1 from shop_crm.shop_memberships m
    join shop_crm.subscriptions sub on sub.profile_id = m.profile_id
    join shop_crm.plans plan on plan.id = sub.plan_id
    where m.shop_id = p_shop_id and m.role = 'owner'
      and m.status = 'active'
      and coalesce((plan.features ->> 'inventory')::boolean, false)
  ) then
    raise exception 'INVENTORY_NOT_IN_PLAN' using errcode = '42501';
  end if;

  select * into v_existing
  from shop_crm.stock_adjustment_requests
  where id = p_request_id;
  if found then
    if v_existing.shop_id = p_shop_id
      and v_existing.product_id = p_product_id
      and v_existing.quantity_change = p_quantity_change
      and v_existing.unit_cost is not distinct from p_unit_cost
      and v_existing.note is not distinct from nullif(btrim(p_note), '') then
      return p_request_id;
    end if;
    raise exception 'STOCK_REQUEST_CONFLICT' using errcode = '23505';
  end if;

  insert into shop_crm.stock_adjustment_requests (
    id, shop_id, product_id, quantity_change, unit_cost, note,
    created_by_profile_id
  ) values (
    p_request_id, p_shop_id, p_product_id, p_quantity_change,
    case when p_quantity_change > 0 then p_unit_cost else null end,
    nullif(btrim(p_note), ''), v_profile_id
  );

  if p_quantity_change > 0 then
    insert into shop_crm.inventory_batches (
      shop_id, product_id, quantity_received, remaining_quantity,
      unit_cost, source_type, received_at
    ) values (
      p_shop_id, p_product_id, p_quantity_change, p_quantity_change,
      p_unit_cost, 'manual', clock_timestamp()
    ) returning id into v_batch_id;
    insert into shop_crm.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type,
      reference_id, created_by_profile_id, unit_cost_snapshot
    ) values (
      p_shop_id, p_product_id, v_batch_id, p_quantity_change, 'in',
      p_request_id, v_profile_id, p_unit_cost
    );
  else
    v_remaining := -p_quantity_change;
    for v_batch in
      select id, remaining_quantity, unit_cost
      from shop_crm.inventory_batches
      where shop_id = p_shop_id and product_id = p_product_id
        and remaining_quantity > 0
      order by received_at, id
      for update
    loop
      v_take := least(v_remaining, v_batch.remaining_quantity);
      update shop_crm.inventory_batches
      set remaining_quantity = remaining_quantity - v_take
      where id = v_batch.id;
      insert into shop_crm.inventory_movements (
        shop_id, product_id, batch_id, quantity_change, movement_type,
        reference_id, created_by_profile_id, unit_cost_snapshot
      ) values (
        p_shop_id, p_product_id, v_batch.id, -v_take, 'adjustment',
        p_request_id, v_profile_id, v_batch.unit_cost
      );
      v_remaining := v_remaining - v_take;
      exit when v_remaining = 0;
    end loop;
    if v_remaining > 0 then
      raise exception 'INSUFFICIENT_STOCK' using errcode = '23514';
    end if;
  end if;
  return p_request_id;
end;
$$;
revoke all on function shop_private.adjust_stock(uuid, uuid, uuid, numeric, numeric, text)
  from public, anon, authenticated;
grant execute on function shop_private.adjust_stock(uuid, uuid, uuid, numeric, numeric, text)
  to authenticated;

create function shop_crm.adjust_stock(
  p_request_id uuid,
  p_shop_id uuid,
  p_product_id uuid,
  p_quantity_change numeric,
  p_unit_cost numeric,
  p_note text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.adjust_stock(
    p_request_id, p_shop_id, p_product_id, p_quantity_change,
    p_unit_cost, p_note
  );
$$;
revoke all on function shop_crm.adjust_stock(uuid, uuid, uuid, numeric, numeric, text)
  from public, anon, authenticated;
grant execute on function shop_crm.adjust_stock(uuid, uuid, uuid, numeric, numeric, text)
  to authenticated;

notify pgrst, 'reload schema';


-- Preserved source step: 20260918191550_shop_service_catalog.sql
-- A bounded service catalog using the existing shop_crm price and discount shape.
alter table shop_crm.services
  add constraint services_price_nonnegative
    check (base_sale_price is not null and base_sale_price >= 0),
  add constraint services_discount_valid
    check (
      default_discount_type is not null
      and default_discount_value is not null
      and default_discount_value >= 0
      and (
        (default_discount_type = 'percent' and default_discount_value <= 100)
        or (default_discount_type = 'amount' and default_discount_value <= base_sale_price)
      )
    );

update shop_crm.plans p
set features = jsonb_set(p.features, '{max_services}', to_jsonb(50), true)
where p.slug = 'basic'
  and p.portal_id = (select id from shop_crm.portals where key = 'shop-crm')
  and not (p.features ? 'max_services');
update shop_crm.plans p
set features = jsonb_set(p.features, '{max_services}', to_jsonb(500), true)
where p.slug = 'pro'
  and p.portal_id = (select id from shop_crm.portals where key = 'shop-crm')
  and not (p.features ? 'max_services');

create function shop_private.save_service(
  p_shop_id uuid,
  p_service_id uuid,
  p_name text,
  p_description text,
  p_base_sale_price numeric,
  p_discount_type text,
  p_discount_value numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_service_id uuid;
  v_limit integer;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'services.manage');
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160
    or (p_description is not null and length(btrim(p_description)) > 1000)
    or p_base_sale_price is null or p_base_sale_price < 0 or p_base_sale_price > 999999999.99
    or p_discount_type not in ('amount', 'percent') or p_discount_type is null
    or p_discount_value is null or p_discount_value < 0
    or (p_discount_type = 'percent' and p_discount_value > 100)
    or (p_discount_type = 'amount' and p_discount_value > p_base_sale_price) then
    raise exception 'INVALID_SERVICE' using errcode = '22023';
  end if;

  perform 1 from shop_crm.shops where id = p_shop_id for update;
  if not found then raise exception 'SHOP_NOT_FOUND'; end if;
  perform shop_private.assert_shop_write_access(p_shop_id, 'services.manage');

  if p_service_id is null then
    select (plan.features ->> 'max_services')::integer into v_limit
    from shop_crm.shop_memberships m
    join shop_crm.subscriptions sub on sub.profile_id = m.profile_id
    join shop_crm.plans plan on plan.id = sub.plan_id
    where m.shop_id = p_shop_id and m.role = 'owner' and m.status = 'active';
    if v_limit is null or v_limit < 1 then
      raise exception 'SERVICE_LIMIT_UNCONFIGURED' using errcode = '23514';
    end if;
    if (select count(*) from shop_crm.services
        where shop_id = p_shop_id and is_active) >= v_limit then
      raise exception 'SERVICE_LIMIT_REACHED' using errcode = '23514';
    end if;
    insert into shop_crm.services (
      shop_id, name, description, base_sale_price,
      default_discount_type, default_discount_value, created_by_profile_id
    ) values (
      p_shop_id, btrim(p_name), nullif(btrim(p_description), ''), p_base_sale_price,
      p_discount_type, p_discount_value, v_profile_id
    ) returning id into v_service_id;
  else
    update shop_crm.services
    set name = btrim(p_name), description = nullif(btrim(p_description), ''),
      base_sale_price = p_base_sale_price,
      default_discount_type = p_discount_type,
      default_discount_value = p_discount_value, updated_at = now()
    where id = p_service_id and shop_id = p_shop_id and is_active
    returning id into v_service_id;
    if v_service_id is null then raise exception 'SERVICE_NOT_FOUND'; end if;
  end if;
  return v_service_id;
end;
$$;
revoke all on function shop_private.save_service(uuid,uuid,text,text,numeric,text,numeric)
  from public, anon, authenticated;
grant execute on function shop_private.save_service(uuid,uuid,text,text,numeric,text,numeric)
  to authenticated;

create function shop_crm.save_service(
  p_shop_id uuid, p_service_id uuid, p_name text, p_description text,
  p_base_sale_price numeric, p_discount_type text, p_discount_value numeric
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.save_service(
    p_shop_id, p_service_id, p_name, p_description,
    p_base_sale_price, p_discount_type, p_discount_value
  );
$$;
revoke all on function shop_crm.save_service(uuid,uuid,text,text,numeric,text,numeric)
  from public, anon, authenticated;
grant execute on function shop_crm.save_service(uuid,uuid,text,text,numeric,text,numeric)
  to authenticated;

create function shop_private.archive_service(p_shop_id uuid, p_service_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform shop_private.assert_shop_write_access(p_shop_id, 'services.manage');
  update shop_crm.services set is_active = false, updated_at = now()
  where id = p_service_id and shop_id = p_shop_id and is_active;
  if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
end;
$$;
revoke all on function shop_private.archive_service(uuid,uuid)
  from public, anon, authenticated;
grant execute on function shop_private.archive_service(uuid,uuid) to authenticated;

create function shop_crm.archive_service(p_shop_id uuid, p_service_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select shop_private.archive_service(p_shop_id, p_service_id);
$$;
revoke all on function shop_crm.archive_service(uuid,uuid)
  from public, anon, authenticated;
grant execute on function shop_crm.archive_service(uuid,uuid) to authenticated;

notify pgrst, 'reload schema';


-- Preserved source step: 20260918192529_shop_expense_ledger.sql
-- Paid shop expenses with same-shop category resolution and retry-safe creation.
alter table shop_crm.expenses add column request_id uuid;
create unique index expenses_shop_request_unique
  on shop_crm.expenses (shop_id, request_id) where request_id is not null;
create unique index expense_categories_shop_active_name_unique
  on shop_crm.expense_categories (shop_id, lower(name)) where is_active;

create function shop_private.save_expense(
  p_shop_id uuid, p_expense_id uuid, p_request_id uuid, p_title text,
  p_amount numeric, p_category_name text, p_expense_date date, p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_category_id uuid;
  v_expense_id uuid;
  v_existing shop_crm.expenses%rowtype;
  v_date timestamp with time zone;
  v_title text;
  v_category text;
  v_notes text;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'expenses.manage');
  v_title := btrim(p_title);
  v_category := btrim(p_category_name);
  v_notes := nullif(btrim(p_notes), '');
  if v_title is null or length(v_title) < 2 or length(v_title) > 160
    or v_category is null or length(v_category) < 2 or length(v_category) > 80
    or (v_notes is not null and length(v_notes) > 1000)
    or p_amount is null or p_amount <= 0 or p_amount > 999999999.99
    or round(p_amount, 2) <> p_amount
    or p_expense_date is null
    or (p_expense_id is null and p_request_id is null) then
    raise exception 'INVALID_EXPENSE' using errcode = '22023';
  end if;
  v_date := (p_expense_date::timestamp + interval '12 hours') at time zone 'UTC';

  perform 1 from shop_crm.shops where id = p_shop_id for update;
  if not found then raise exception 'SHOP_NOT_FOUND'; end if;
  perform shop_private.assert_shop_write_access(p_shop_id, 'expenses.manage');

  select id into v_category_id
  from shop_crm.expense_categories
  where shop_id = p_shop_id and is_active and lower(name) = lower(v_category);
  if v_category_id is null then
    insert into shop_crm.expense_categories (
      shop_id, name, created_by_profile_id
    ) values (p_shop_id, v_category, v_profile_id)
    returning id into v_category_id;
  end if;

  if p_expense_id is null then
    select * into v_existing from shop_crm.expenses
    where shop_id = p_shop_id and request_id = p_request_id;
    if found then
      if v_existing.title = v_title and v_existing.amount = p_amount
        and v_existing.category_id = v_category_id
        and v_existing.expense_date = v_date
        and v_existing.notes is not distinct from v_notes
        and v_existing.status = 'paid' then
        return v_existing.id;
      end if;
      raise exception 'EXPENSE_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    perform shop_private.assert_period_is_open(p_shop_id, v_date);
    insert into shop_crm.expenses (
      shop_id, category_id, title, amount, status, expense_date,
      paid_at, notes, created_by_profile_id, request_id
    ) values (
      p_shop_id, v_category_id, v_title, p_amount, 'paid', v_date,
      now(), v_notes, v_profile_id, p_request_id
    ) returning id into v_expense_id;
  else
    select * into v_existing from shop_crm.expenses
    where id = p_expense_id and shop_id = p_shop_id for update;
    if not found or v_existing.status <> 'paid' then
      raise exception 'EXPENSE_NOT_FOUND';
    end if;
    perform shop_private.assert_period_is_open(p_shop_id, v_existing.expense_date);
    perform shop_private.assert_period_is_open(p_shop_id, v_date);
    update shop_crm.expenses
    set category_id = v_category_id, title = v_title, amount = p_amount,
      expense_date = v_date, notes = v_notes
    where id = p_expense_id and shop_id = p_shop_id
    returning id into v_expense_id;
  end if;
  return v_expense_id;
end;
$$;
revoke all on function shop_private.save_expense(uuid,uuid,uuid,text,numeric,text,date,text)
  from public, anon, authenticated;
grant execute on function shop_private.save_expense(uuid,uuid,uuid,text,numeric,text,date,text)
  to authenticated;

create function shop_crm.save_expense(
  p_shop_id uuid, p_expense_id uuid, p_request_id uuid, p_title text,
  p_amount numeric, p_category_name text, p_expense_date date, p_notes text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select shop_private.save_expense(
    p_shop_id, p_expense_id, p_request_id, p_title, p_amount,
    p_category_name, p_expense_date, p_notes
  );
$$;
revoke all on function shop_crm.save_expense(uuid,uuid,uuid,text,numeric,text,date,text)
  from public, anon, authenticated;
grant execute on function shop_crm.save_expense(uuid,uuid,uuid,text,numeric,text,date,text)
  to authenticated;

create function shop_private.void_expense(p_shop_id uuid, p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense shop_crm.expenses%rowtype;
begin
  perform shop_private.assert_shop_write_access(p_shop_id, 'expenses.manage');
  select * into v_expense from shop_crm.expenses
  where id = p_expense_id and shop_id = p_shop_id for update;
  if not found then raise exception 'EXPENSE_NOT_FOUND'; end if;
  if v_expense.status = 'void' then return; end if;
  if v_expense.status <> 'paid' then raise exception 'EXPENSE_NOT_PAID'; end if;
  perform shop_private.assert_period_is_open(p_shop_id, v_expense.expense_date);
  update shop_crm.expenses set status = 'void'
  where id = p_expense_id and shop_id = p_shop_id;
end;
$$;
revoke all on function shop_private.void_expense(uuid,uuid)
  from public, anon, authenticated;
grant execute on function shop_private.void_expense(uuid,uuid) to authenticated;

create function shop_crm.void_expense(p_shop_id uuid, p_expense_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select shop_private.void_expense(p_shop_id, p_expense_id);
$$;
revoke all on function shop_crm.void_expense(uuid,uuid)
  from public, anon, authenticated;
grant execute on function shop_crm.void_expense(uuid,uuid) to authenticated;

notify pgrst, 'reload schema';


COMMIT;
