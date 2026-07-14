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

`TODO_AFTER_HOSTING`

## GitHub repository

`TODO_AFTER_GITHUB_PUSH`

## Category

Mainnet (after successful Testnet verification and low-value Mainnet deployment)

## Contract address

`TODO_AFTER_MAINNET_DEPLOYMENT`

## Demo video

`TODO_AFTER_RECORDING` (public URL, under 3 minutes)

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
