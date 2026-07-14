# Spark submission draft

## Name

Daman

## Description

Inspect it. Scan it. Settle it. Daman is non-custodial escrow for in-person deals that start in DMs.

## Problem

People regularly arrange purchases through WhatsApp, Instagram, Telegram, and local marketplace listings. The buyer does not want to pay before inspecting the item, while the seller does not want to travel or hand over the item without knowing payment is secured. Informal chat promises leave both sides exposed.

## Solution

Daman lets a seller create a deal and share one link in the original chat. The buyer locks the exact payment in a Monad smart contract. At the physical handoff, the buyer inspects the item and confirms from their wallet or scans the seller's QR. The contract releases payment directly to the seller. If the meetup never happens, the seller can refund immediately or the payment automatically becomes refundable to the buyer after the deadline.

Daman deliberately solves one narrow problem well: safe in-person handoffs. It has no admin custody, marketplace listings, token, subjective arbitration, or fake success states. Every lifecycle action is a real contract transaction.

## Project URL

https://daman-nine.vercel.app

## GitHub repository

https://github.com/m7mdd77/daman

## Category

Mainnet

## Contract address

[`0x6edc1ec5b362823de96f522c3ac37403e026866b`](https://monadscan.com/address/0x6edc1ec5b362823de96f522c3ac37403e026866b)

- [Full-match source verification](https://monadvision.com/contracts/full_match/143/0x6edc1ec5b362823de96f522c3ac37403e026866b/)
- [Mainnet deployment transaction](https://monadscan.com/tx/0x25f5c8223b0f44d10cc5a62b52262434487fe2f729c28007eb8bc850aad2f239)
- [Completed Testnet escrow contract](https://testnet.monadscan.com/address/0x5de920b800e781c648cae2600c351892f7ba7bf2)

## Demo video

https://daman-nine.vercel.app/daman-demo.mp4 (84 seconds, publicly accessible)

## Social post

`TODO_AFTER_POSTING`

## Technical highlights

- Monad-native MON escrow with no admin withdrawal path
- Designated-buyer and open-link deal modes
- Mobile-first buyer and seller flows
- Shareable WhatsApp links and QR handoff confirmation
- Automatic post-deadline refunds
- Public onchain deal history and explorer links
- Solidity tests for all money-moving paths

## Eligibility/history note

This project and repository were created from scratch during the Spark hackathon. It does not reuse a prior product repository or prior contract.
