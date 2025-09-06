import type { Contact } from '../types';

export async function getAllContacts(): Promise<Contact[]> {
  const response = await fetch('/contact.json');
  if (!response.ok) throw new Error('Failed to fetch contact list');
  return response.json();
} 