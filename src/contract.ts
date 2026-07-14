import { defineChain, http, createPublicClient, isAddress } from 'viem'

const isMainnet = import.meta.env.VITE_DAMAN_NETWORK === 'mainnet'

export const damanChain = isMainnet
  ? defineChain({
      id: 143,
      name: 'Monad Mainnet',
      nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
      rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
      blockExplorers: { default: { name: 'Monadscan', url: 'https://monadscan.com' } },
    })
  : defineChain({
      id: 10143,
      name: 'Monad Testnet',
      nativeCurrency: { name: 'Testnet MON', symbol: 'MON', decimals: 18 },
      rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
      blockExplorers: { default: { name: 'Monadscan', url: 'https://testnet.monadscan.com' } },
      testnet: true,
    })

export const publicClient = createPublicClient({ chain: damanChain, transport: http() })

const configuredAddress = import.meta.env.VITE_DAMAN_CONTRACT_ADDRESS
export const contractAddress =
  configuredAddress && isAddress(configuredAddress) ? configuredAddress : undefined

export const damanAbi = [
  {
    type: 'function',
    name: 'createDeal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'terms', type: 'string' },
      { name: 'designatedBuyer', type: 'address' },
      { name: 'price', type: 'uint128' },
      { name: 'deadline', type: 'uint64' },
    ],
    outputs: [{ name: 'dealId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'fundDeal',
    stateMutability: 'payable',
    inputs: [{ name: 'dealId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'completeHandoff',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'dealId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refundBySeller',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'dealId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refundExpiredDeal',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'dealId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelUnfundedDeal',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'dealId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getDeal',
    stateMutability: 'view',
    inputs: [{ name: 'dealId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'seller', type: 'address' },
          { name: 'buyer', type: 'address' },
          { name: 'price', type: 'uint128' },
          { name: 'deadline', type: 'uint64' },
          { name: 'status', type: 'uint8' },
          { name: 'title', type: 'string' },
          { name: 'terms', type: 'string' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getSellerDealIds',
    stateMutability: 'view',
    inputs: [{ name: 'seller', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'getBuyerDealIds',
    stateMutability: 'view',
    inputs: [{ name: 'buyer', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    type: 'event',
    name: 'DealCreated',
    inputs: [
      { name: 'dealId', type: 'uint256', indexed: true },
      { name: 'seller', type: 'address', indexed: true },
      { name: 'designatedBuyer', type: 'address', indexed: true },
      { name: 'price', type: 'uint256', indexed: false },
      { name: 'deadline', type: 'uint256', indexed: false },
      { name: 'title', type: 'string', indexed: false },
    ],
  },
] as const

export type Deal = {
  seller: `0x${string}`
  buyer: `0x${string}`
  price: bigint
  deadline: bigint
  status: number
  title: string
  terms: string
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
