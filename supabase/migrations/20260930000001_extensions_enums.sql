-- Ijari: extensions and enums
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.member_role as enum ('admin', 'accountant', 'collector', 'viewer', 'owner');
create type public.property_type as enum ('residential', 'investment', 'mixed', 'industrial');
create type public.unit_type as enum (
  'apartment', 'shop', 'room', 'basement', 'basement_front_half', 'basement_back_half',
  'roof', 'office', 'warehouse', 'plot', 'other'
);
create type public.contract_type as enum ('residential', 'investment');
create type public.contract_status as enum ('draft', 'active', 'notice_given', 'ended', 'terminated', 'renewed');
create type public.utilities_party as enum ('owner', 'tenant');
create type public.deposit_status as enum ('none', 'held', 'refunded', 'forfeited_partially', 'forfeited');
create type public.increase_kind as enum ('percent', 'fixed');
create type public.charge_kind as enum ('rent', 'free', 'electricity_fixed', 'penalty', 'maintenance_recharge', 'other');
create type public.payment_method as enum ('cash', 'knet', 'bank_transfer', 'cheque', 'link');
create type public.adjustment_kind as enum ('discount', 'write_off', 'correction');
create type public.expense_category_type as enum ('operating', 'capital', 'payroll', 'owner_draw');
create type public.beneficiary_kind as enum ('staff', 'vendor', 'asset', 'other');
create type public.paid_from as enum ('cash_box', 'bank', 'cheque');
create type public.voucher_status as enum ('draft', 'posted', 'void');
create type public.allocation_mode as enum ('single', 'split_even', 'split_by_units', 'split_by_rent', 'manual_percent', 'manual_amount');
create type public.deposit_destination as enum ('owner_bank', 'office_bank', 'cash_to_owner');
create type public.legal_case_type as enum ('eviction', 'rent_claim', 'other');
create type public.legal_status as enum ('none', 'filed', 'in_progress', 'judgment', 'enforcement', 'closed');
create type public.commission_kind as enum ('percent', 'fixed');
create type public.reminder_channel as enum ('whatsapp', 'copy', 'sms', 'call');
