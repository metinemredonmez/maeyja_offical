import { apiGet } from '@/lib/api.server';
import type { Address } from '@/lib/types';
import { AddressBook } from '@/components/account/address-book';

export default async function AddressesPage() {
  const addresses = await apiGet<Address[]>('/me/addresses', { auth: true }).catch(() => []);
  return <AddressBook initial={addresses} />;
}
