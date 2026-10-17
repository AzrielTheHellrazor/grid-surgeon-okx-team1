/**
 * ERC-8004 Agent Configuration (ava-labs/8004-boilerplate standard)
 *
 * Configured for Grid-Surgeon (Autonomous OKX ATK Bot Surgeon & Trap Hunter on AVAX)
 */

module.exports = {
  // Agent Identity
  agent: {
    name: "Grid-Surgeon",
    description:
      "Autonomous self-healing OKX ATK grid bot surgeon, retail-vs-whale divergence trap hunter, and high-water mark Simple Earn profit sweeper on AVAX.",
    // ERC-8004 Agent Registration JSON endpoint
    metadataURI:
      "https://raw.githubusercontent.com/AzrielTheHellrazor/grid-surgeon-okx-team1/main/.well-known/agent-card.json",
  },

  // Task Types & Pricing (in native token - AVAX)
  tasks: {
    types: [
      { id: 0, name: "In-Flight Grid Bot Surgery (okx bot grid amend)", price: "0.001" },
      { id: 1, name: "Retail-vs-Whale Bull/Bear Trap Audit", price: "0.002" },
      { id: 2, name: "High-Water Mark Simple Earn Profit Sweep", price: "0.001" },
      { id: 3, name: "Macro CPI/FOMC Bunker De-Leverage", price: "0.002" },
      { id: 4, name: "Full 4-Border Autonomous OKX Cycle", price: "0.003" },
    ],
  },

  // Network Configuration (Official Ava Labs ERC-8004 Registries)
  networks: {
    fuji: {
      name: "Avalanche Fuji Testnet",
      chainId: 43113,
      rpc: "https://api.avax-test.network/ext/bc/C/rpc",
      explorer: "https://testnet.snowtrace.io",
      registries: {
        // Official Ava Labs ERC-8004 registries on Fuji
        identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
        reputation: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
        // Validation Registry is deployed per-agent
        validation: null,
      },
    },
    avalanche: {
      name: "Avalanche Mainnet",
      chainId: 43114,
      rpc: "https://api.avax.network/ext/bc/C/rpc",
      explorer: "https://snowtrace.io",
      registries: {
        // Official Ava Labs ERC-8004 registries on Avalanche C-Chain Mainnet
        identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
        reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
        validation: null,
      },
    },
  },

  // Agent Backend Configuration
  backend: {
    pollInterval: 20000,
    processorEndpoint: "http://localhost:4001/api/cycle",
    useLocalHandler: true,
  },
};
