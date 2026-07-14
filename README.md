# Daman

**Inspect it. Scan it. Settle it.**

Daman is non-custodial escrow for in-person deals arranged through WhatsApp, Instagram, Telegram, or other messaging apps. A seller shares a deal link, the buyer locks the exact payment on Monad, and the buyer releases it only after inspecting the item at handoff.

**Live app:** [daman-nine.vercel.app](https://daman-nine.vercel.app)

## Why Daman

Informal marketplace deals have a trust gap: buyers do not want to pay before seeing the item, and sellers do not want to travel or hand over an item without knowing the money exists. Daman makes the agreement and funds independently verifiable without becoming another marketplace or holding user money in a company account.

## Core flow

1. Seller creates a deal with a price, deadline, terms, and optional designated buyer.
2. Seller shares the generated link in the chat where the deal started.
3. Buyer locks the exact MON amount in `DamanEscrow`.
4. Seller verifies the funded status before meeting or handing over the item.
5. Buyer inspects the item and confirms the handoff from their wallet (or scans the seller's handoff QR).
6. The contract transfers payment directly to the seller.
7. If handoff does not happen, the seller can refund immediately or anyone can execute the buyer refund after expiry.

## Contract guarantees

- Funds are never held by an admin or upgradeable proxy.
- Only the buyer can complete a funded handoff.
- A designated buyer prevents another wallet from taking a private deal.
- The exact advertised price must be funded.
- The seller can refund but cannot withdraw a funded payment.
- Expired funded deals return payment only to the buyer.
- Checks-effects-interactions and a reentrancy guard protect settlement paths.
- Completed or refunded deals cannot settle twice.
- Deal deadlines are limited to 30 days.

> Daman has not received a third-party security audit. Use small amounts for the hackathon demonstration. The current product is limited to in-person handoffs and intentionally does not claim to solve shipping or subjective disputes.

## Live deployments

- **Monad Mainnet:** [`0x6edc1ec5b362823de96f522c3ac37403e026866b`](https://monadscan.com/address/0x6edc1ec5b362823de96f522c3ac37403e026866b)
- **Verified source:** [Full match on MonadVision](https://monadvision.com/contracts/full_match/143/0x6edc1ec5b362823de96f522c3ac37403e026866b/)
- **Deployment transaction:** [`0x25f5c822…ad2f239`](https://monadscan.com/tx/0x25f5c8223b0f44d10cc5a62b52262434487fe2f729c28007eb8bc850aad2f239)
- **Monad Testnet:** [`0x5de920b800e781c648cae2600c351892f7ba7bf2`](https://testnet.monadscan.com/address/0x5de920b800e781c648cae2600c351892f7ba7bf2)

## Stack

- React, TypeScript, Vite
- Viem wallet and contract integration
- Solidity 0.8.28
- Hardhat 2, Ethers, Chai
- Monad Testnet (`10143`) and Mainnet (`143`)

## Local setup

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
cp .env.example .env
pnpm test
pnpm dev
```

The UI enters build-preview mode until `VITE_DAMAN_CONTRACT_ADDRESS` contains a deployed address.

## Deploy and verify

Never paste a private key into source code or a `VITE_` variable. Put a dedicated, low-value deployment wallet in `.env`:

```dotenv
DEPLOYER_PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=...
```

Testnet first:

```bash
pnpm contract:deploy:testnet
pnpm contract:verify:testnet -- 0xDEPLOYED_ADDRESS
```

Mainnet only after the tests and a full Testnet handoff:

```bash
pnpm contract:deploy:mainnet
pnpm contract:verify:mainnet -- 0xDEPLOYED_ADDRESS
```

Then configure the frontend:

```dotenv
VITE_DAMAN_NETWORK=mainnet
VITE_DAMAN_CONTRACT_ADDRESS=0x6edc1ec5b362823de96f522c3ac37403e026866b
```

Build the hosted app with `pnpm build` and deploy `dist/` or connect the repository to Vercel.

## Testing

```bash
pnpm test
pnpm build
```

The contract suite covers creation, designated and open buyers, exact funding, successful settlement, seller refunds, expiry refunds, cancellation safety, and double-settlement prevention.

## Privacy

Deal titles and terms are public blockchain data. The interface warns users not to enter phone numbers, addresses, or other private information. Daman does not run a database and does not collect user profiles.

## License

MIT
