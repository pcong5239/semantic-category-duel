import type { Address } from './types';

export const contractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS ?? '') as Address;
