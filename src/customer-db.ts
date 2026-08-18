/**
 * A tiny mock customer database. This file is provided for you - the
 * exercise is about shaping the *responses* around this data, not about
 * building the data layer itself.
 */

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  tier: 'standard' | 'premium' | 'enterprise';
}

export const customers: CustomerRecord[] = [
  { id: 'CUST-1001', name: 'Ava Thompson', email: 'ava.thompson@example.com', tier: 'premium' },
  { id: 'CUST-1002', name: 'Marcus Lee', email: 'marcus.lee@example.com', tier: 'standard' },
  { id: 'CUST-1003', name: 'Priya Nair', email: 'priya.nair@example.com', tier: 'enterprise' },
];

/** Returns the matching customer, or undefined if no such customer exists. */
export function findCustomerById(customerId: string): CustomerRecord | undefined {
  return customers.find((c) => c.id === customerId);
}
