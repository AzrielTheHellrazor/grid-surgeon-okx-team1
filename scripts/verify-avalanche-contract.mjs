#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const backendRequire = createRequire(
  path.join(ROOT_DIR, 'backend', 'package.json')
);
const {
  decodeFunctionData,
  encodeFunctionData,
  keccak256,
  recoverMessageAddress,
  toHex,
  verifyMessage,
} = backendRequire('viem');
const { generatePrivateKey, privateKeyToAccount } =
  backendRequire('viem/accounts');
const solc = backendRequire('solc');

const COMPILED_JSON_PATH = path.join(
  ROOT_DIR,
  'contracts',
  'GridSurgeonRegistry.compiled.json'
);
const SOL_SOURCE_PATH = path.join(
  ROOT_DIR,
  'contracts',
  'GridSurgeonRegistry.sol'
);
const WALLET_FILE_PATH = path.join(
  ROOT_DIR,
  '.data',
  'avalanche-wallet.json'
);

async function main() {
  console.log('=== GridSurgeonRegistry Avalanche Contract & Border 4 Verifier ===');

  // 1. Load & validate contracts/GridSurgeonRegistry.compiled.json
  assert.ok(
    fs.existsSync(COMPILED_JSON_PATH),
    `Missing compiled artifact at ${COMPILED_JSON_PATH}`
  );
  const compiled = JSON.parse(fs.readFileSync(COMPILED_JSON_PATH, 'utf8'));

  assert.equal(
    compiled.contractName,
    'GridSurgeonRegistry',
    'contractName must be GridSurgeonRegistry'
  );
  assert.equal(compiled.compiler, '0.8.20', 'compiler must be 0.8.20');
  assert.ok(Array.isArray(compiled.abi) && compiled.abi.length > 0, 'ABI must be non-empty array');
  assert.equal(typeof compiled.bytecode, 'string', 'bytecode must be a string');
  assert.match(
    compiled.bytecode,
    /^0x[0-9a-fA-F]+$/,
    'bytecode must be valid 0x-prefixed hex'
  );
  assert.equal(
    compiled.bytecode.length % 2,
    0,
    'bytecode hex length must be even'
  );
  assert.ok(
    compiled.bytecode.length > 1000,
    `bytecode must be full compiled EVM bytecode (got length ${compiled.bytecode.length})`
  );

  // Verify live solc compilation matches artifact
  const source = fs.readFileSync(SOL_SOURCE_PATH, 'utf8');
  const solcInput = {
    language: 'Solidity',
    sources: {
      'GridSurgeonRegistry.sol': { content: source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  };
  const solcOutput = JSON.parse(solc.compile(JSON.stringify(solcInput)));
  const freshContract =
    solcOutput?.contracts?.['GridSurgeonRegistry.sol']?.['GridSurgeonRegistry'];
  assert.ok(freshContract?.evm?.bytecode?.object, 'solc compilation must succeed');
  assert.equal(
    compiled.bytecode,
    `0x${freshContract.evm.bytecode.object}`,
    'Artifact bytecode must match fresh solc compilation'
  );
  console.log(
    `[PASS] 1. Artifact verified: ${compiled.contractName} (solc ${compiled.compiler}), ABI items=${compiled.abi.length}, bytecode=${(compiled.bytecode.length - 2) / 2} bytes`
  );

  // 2. Test keccak256 reasoningHash & ABI encoding for recordDecision
  const samplePayload = JSON.stringify({
    timestamp: '2026-10-15T21:12:35.000Z',
    instId: 'AVAX-USDT',
    lastPx: 24.85,
    regime: 'BULL_TRAP_SHORT',
    regimeIndex: 1,
    dTrap: 1.42,
    trapScoreBps: -1420,
    avaxPriceE4: 248500,
    navUsdtE2: 105420,
    lockedEarnUsdtE2: 1250,
    okxAlgoOrOrdId: 'okx-algo-78912345',
    actionExecuted: 'GRID_SURGERY_AND_EARN_SWEEP',
  });
  const reasoningHash = keccak256(toHex(samplePayload));
  assert.match(reasoningHash, /^0x[0-9a-fA-F]{64}$/, 'reasoningHash must be 32-byte hex');

  const recordDecisionArgs = [
    1, // MarketRegime.BULL_TRAP_SHORT (uint8)
    BigInt(-1420), // _trapScoreBps (int256)
    BigInt(248500), // _avaxPriceE4 (uint256)
    BigInt(105420), // _navUsdtE2 (uint256)
    BigInt(1250), // _lockedEarnUsdtE2 (uint256)
    'okx-algo-78912345', // _okxAlgoOrOrdId (string)
    reasoningHash, // _reasoningHash (bytes32)
  ];

  const encodedDecision = encodeFunctionData({
    abi: compiled.abi,
    functionName: 'recordDecision',
    args: recordDecisionArgs,
  });
  assert.match(encodedDecision, /^0x74b044db[0-9a-fA-F]+$/, 'recordDecision selector must be 0x74b044db');

  const decodedDecision = decodeFunctionData({
    abi: compiled.abi,
    data: encodedDecision,
  });
  assert.equal(decodedDecision.functionName, 'recordDecision');
  assert.equal(Number(decodedDecision.args[0]), 1);
  assert.equal(decodedDecision.args[1], BigInt(-1420));
  assert.equal(decodedDecision.args[2], BigInt(248500));
  assert.equal(decodedDecision.args[3], BigInt(105420));
  assert.equal(decodedDecision.args[4], BigInt(1250));
  assert.equal(decodedDecision.args[5], 'okx-algo-78912345');
  assert.equal(decodedDecision.args[6], reasoningHash);
  console.log(
    `[PASS] 2. ABI encode/decode verified for recordDecision (selector=${encodedDecision.slice(0, 10)}, bytes=${(encodedDecision.length - 2) / 2})`
  );

  // 3. Test ABI encoding for recordGridSurgery
  const recordGridSurgeryArgs = [
    'okx-algo-78912345',
    BigInt(235000), // $23.5000 * 1e4
    BigInt(262000), // $26.2000 * 1e4
  ];
  const encodedSurgery = encodeFunctionData({
    abi: compiled.abi,
    functionName: 'recordGridSurgery',
    args: recordGridSurgeryArgs,
  });
  assert.match(encodedSurgery, /^0xb02c35c6[0-9a-fA-F]+$/, 'recordGridSurgery selector must be 0xb02c35c6');

  const decodedSurgery = decodeFunctionData({
    abi: compiled.abi,
    data: encodedSurgery,
  });
  assert.equal(decodedSurgery.functionName, 'recordGridSurgery');
  assert.equal(decodedSurgery.args[0], 'okx-algo-78912345');
  assert.equal(decodedSurgery.args[1], BigInt(235000));
  assert.equal(decodedSurgery.args[2], BigInt(262000));
  console.log(
    `[PASS] 3. ABI encode/decode verified for recordGridSurgery (selector=${encodedSurgery.slice(0, 10)}, bytes=${(encodedSurgery.length - 2) / 2})`
  );

  // 4. Verify EIP-191 signature generation & recovery (matching phase4Anchor.ts)
  let privateKey = generatePrivateKey();
  if (fs.existsSync(WALLET_FILE_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(WALLET_FILE_PATH, 'utf8'));
      if (saved?.privateKey) {
        privateKey = saved.privateKey;
      }
    } catch {
      // Use ephemeral key if wallet file is unreadable
    }
  }
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signMessage({
    message: { raw: reasoningHash },
  });
  assert.match(signature, /^0x[0-9a-fA-F]{130}$/, 'EIP-191 ECDSA signature must be 65-byte hex');

  const recoveredAddress = await recoverMessageAddress({
    message: { raw: reasoningHash },
    signature,
  });
  assert.equal(
    recoveredAddress.toLowerCase(),
    account.address.toLowerCase(),
    'Recovered EIP-191 signer address must match operator account address'
  );

  const isValidSig = await verifyMessage({
    address: account.address,
    message: { raw: reasoningHash },
    signature,
  });
  assert.equal(isValidSig, true, 'verifyMessage must return true');
  console.log(
    `[PASS] 4. EIP-191 signature recovery verified for operator ${account.address} (reasoningHash=${reasoningHash.slice(0, 14)}...)`
  );

  console.log('=== ALL AVALANCHE CONTRACT & BORDER 4 CHECKS PASSED (100%) ===');
}

main().catch((err) => {
  console.error('[FAIL] Avalanche contract verification failed:', err);
  process.exit(1);
});
