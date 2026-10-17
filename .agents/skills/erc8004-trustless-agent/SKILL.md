---
name: erc8004-trustless-agent
description: Manages ERC-8004 ("Trustless Agents") Identity Registry, Validation Registry, Reputation Registry, and official /.well-known/agent-card.json specification on Avalanche Fuji / C-Chain for Grid-Surgeon.
---

# ERC-8004 Trustless Agent Skill (`ERC8004TrustValidator`)

This skill governs **Border 4 (Avalanche C-Chain & ERC-8004 Trustless Agent Anchor)** in **Grid-Surgeon**.

## 1. The 3 Core ERC-8004 Registries Implemented in `contracts/GridSurgeonRegistry.sol`
1. **Identity Registry (`getERC8004Identity`)**
   - `ERC8004_AGENT_ID = 1`
   - `agentDomain = "grid-surgeon.okx.avax"`
   - `agentCardURI = "/.well-known/agent-card.json"`
   - Emits `ERC8004AgentRegistered(uint256 indexed agentId, address indexed operator, string agentDomain, string agentCardURI)`
2. **Validation Registry (`verifyTaskValidation`)**
   - Stores cryptographic `keccak256` `reasoningHash` proofs signed via EIP-191 ECDSA by the autonomous operator wallet (`0x07Ee05d717EBC2E47c0A97ad327d56A635920348`).
   - Emits `ERC8004ValidationRecorded(uint256 indexed agentId, uint256 indexed decisionIndex, bytes32 indexed reasoningHash, address validator, bool verified)`
3. **Reputation Registry (`getERC8004Reputation`)**
   - Tracks on-chain `reputationScore` (`96–99 / 100`), `reputationFeedbackCount`, and `totalSurgeriesValidated`.
   - Emits `ERC8004ReputationUpdated(uint256 indexed agentId, uint8 newScore, uint256 feedbackCount, string tag, bytes32 proofHash)`

## 2. Live Avalanche Fuji Deployment
- **ERC-8004 Registry Contract:** `0x7c52f6b7b588698700abbac6cbe37f3cfca305cd`
- **Agent Operator Wallet:** `0x07Ee05d717EBC2E47c0A97ad327d56A635920348`
- **Standard Agent Card Endpoint:** `http://localhost:4001/.well-known/agent-card.json`
- **Passport Inspection Endpoint:** `http://localhost:4001/api/erc8004`
