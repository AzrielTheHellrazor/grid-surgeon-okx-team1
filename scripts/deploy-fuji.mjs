#!/usr/bin/env node
/**
 * One-Command Avalanche Fuji Testnet (43113) Contract Deployer & Initializer
 * Deploys `contracts/GridSurgeonRegistry.compiled.json` and updates `.data/avalanche-wallet.json` + `.data/surgeon-state.json`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const require = createRequire(path.join(ROOT_DIR, 'backend', 'package.json'));

const {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  encodeFunctionData,
  keccak256,
  toHex,
} = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { avalancheFuji } = require('viem/chains');

const WALLET_FILE = path.join(ROOT_DIR, '.data', 'avalanche-wallet.json');
const STATE_FILE = path.join(ROOT_DIR, '.data', 'surgeon-state.json');
const COMPILED_FILE = path.join(
  ROOT_DIR,
  'contracts',
  'GridSurgeonRegistry.compiled.json'
);
const RPC_URL =
  process.env.AVALANCHE_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';

async function main() {
  console.log('==============================================================');
  console.log('  GRID-SURGEON: AVALANCHE FUJI ON-CHAIN CONTRACT DEPLOYER');
  console.log('==============================================================');

  if (!fs.existsSync(COMPILED_FILE)) {
    console.error(`Missing compiled artifact: ${COMPILED_FILE}`);
    process.exit(1);
  }
  const compiled = JSON.parse(fs.readFileSync(COMPILED_FILE, 'utf8'));

  let walletData = {};
  if (fs.existsSync(WALLET_FILE)) {
    walletData = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
  }

  const rawPk = (
    process.env.OPERATOR_PRIVATE_KEY ||
    process.argv[2] ||
    walletData.privateKey ||
    ''
  ).trim();

  if (!rawPk) {
    console.error('No operator private key found in .data/avalanche-wallet.json');
    process.exit(1);
  }

  const privateKey = rawPk.startsWith('0x') ? rawPk : `0x${rawPk}`;
  const account = privateKeyToAccount(privateKey);

  // Persist if a custom private key was supplied
  if (rawPk !== walletData.privateKey) {
    walletData.privateKey = privateKey;
    walletData.address = account.address;
    walletData.updatedAt = new Date().toISOString();
    fs.writeFileSync(WALLET_FILE, JSON.stringify(walletData, null, 2), 'utf8');
  }

  const publicClient = createPublicClient({
    chain: avalancheFuji,
    transport: http(RPC_URL, { timeout: 15000 }),
  });

  const balanceWei = await publicClient.getBalance({ address: account.address });
  const balanceAvax = formatEther(balanceWei);

  console.log(`Operator Wallet : ${account.address}`);
  console.log(`Fuji Balance    : ${balanceAvax} AVAX`);

  if (balanceWei < 2_000_000_000_000_000n) {
    console.log('\n⚠️  Wallet balance on Avalanche Fuji Testnet (43113) is currently 0 AVAX.');
    console.log(`   Send Fuji Testnet AVAX to: ${account.address}`);
    console.log('   Or run: node scripts/deploy-fuji.mjs <YOUR_TESTNET_PRIVATE_KEY>');
    process.exit(2);
  }

  const walletClient = createWalletClient({
    account,
    chain: avalancheFuji,
    transport: http(RPC_URL, { timeout: 20000 }),
  });

  console.log('\n[1/2] Deploying GridSurgeonRegistry.sol to Avalanche Fuji (43113)...');
  const deployHash = await walletClient.deployContract({
    abi: compiled.abi,
    bytecode: compiled.bytecode,
    args: [],
  });
  console.log(`      Deploy Tx Sent: https://testnet.snowtrace.io/tx/${deployHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: deployHash,
    timeout: 45000,
  });
  const contractAddress = receipt.contractAddress;
  console.log(`      ✅ Contract Deployed at: ${contractAddress}`);
  console.log(`      Explorer: https://testnet.snowtrace.io/address/${contractAddress}`);

  // Save deployed contract address to wallet & state files
  walletData.deployedContractAddress = contractAddress;
  walletData.deployTxHash = deployHash;
  walletData.deployedAt = new Date().toISOString();
  fs.writeFileSync(WALLET_FILE, JSON.stringify(walletData, null, 2), 'utf8');

  if (fs.existsSync(STATE_FILE)) {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    state.contractAddress = contractAddress;
    if (state.latestCycle?.border4Anchor) {
      state.latestCycle.border4Anchor.contractInfo.address = contractAddress;
      state.latestCycle.border4Anchor.anchorRecord.contractAddress = contractAddress;
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  }

  console.log('\n[2/2] Anchoring genesis decision on-chain via recordDecision(...)...');
  const genesisHash = keccak256(
    toHex(
      JSON.stringify({
        event: 'GENESIS_GRID_SURGEON_DEPLOY',
        operator: account.address,
        timestamp: new Date().toISOString(),
      })
    )
  );
  const calldata = encodeFunctionData({
    abi: compiled.abi,
    functionName: 'recordDecision',
    args: [
      0, // RANGING_GRID
      1800n, // +0.18 trap score bps
      93400n, // $9.3400 AVAX E4
      173790n, // $1,737.90 NAV E2
      31240n, // $312.40 Simple Earn E2
      '78492015839201',
      genesisHash,
    ],
  });

  const anchorTxHash = await walletClient.sendTransaction({
    to: contractAddress,
    data: calldata,
  });
  await publicClient.waitForTransactionReceipt({
    hash: anchorTxHash,
    timeout: 30000,
  });

  console.log(`      ✅ Genesis Decision Anchored! Tx: https://testnet.snowtrace.io/tx/${anchorTxHash}`);

  if (fs.existsSync(STATE_FILE)) {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (state.latestCycle?.border4Anchor?.anchorRecord) {
      state.latestCycle.border4Anchor.anchorRecord.txHash = anchorTxHash;
      state.latestCycle.border4Anchor.anchorRecord.status = 'BROADCAST_ON_CHAIN';
    }
    if (Array.isArray(state.anchorHistory) && state.anchorHistory[0]) {
      state.anchorHistory[0].txHash = anchorTxHash;
      state.anchorHistory[0].status = 'BROADCAST_ON_CHAIN';
      state.anchorHistory[0].contractAddress = contractAddress;
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  }

  console.log('\n==============================================================');
  console.log('  🎉 100% LIVE ON AVALANCHE FUJI TESTNET!');
  console.log('==============================================================');
}

main().catch((err) => {
  console.error('Deployment Error:', err.message || err);
  process.exit(1);
});
