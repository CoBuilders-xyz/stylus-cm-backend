import { ethers, Contract, Wallet, JsonRpcProvider } from 'ethers';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const CMA_ABI_PATH = path.resolve(
  __dirname,
  '../../src/common/abis/cacheManagerAutomation/CacheManagerAutomation.json',
);
const ARB_WASM_ABI_PATH = path.resolve(
  __dirname,
  '../../src/common/abis/arbWasm/ArbWasm.json',
);

const ARB_OWNER_ABI = [
  'function setWasmExpiryDays(uint16 _days)',
  'function setWasmKeepaliveDays(uint16 _days)',
];

const CACHE_MANAGER_ABI = [
  'function placeBid(address program) payable',
  'function evictAll()',
  'function setCacheSize(uint64 newSize)',
  'function getMinBid(address program) view returns (uint192)',
  'function getMinBid(bytes32 codehash) view returns (uint192)',
  'function getEntries() view returns (tuple(bytes32 code, uint64 size, uint192 bid)[])',
];

export class ChainClient {
  readonly provider: JsonRpcProvider;
  readonly wallet: Wallet;
  readonly l2OwnerWallet: Wallet;
  private rpcUrl: string;
  private fundedPk: string;
  private l2OwnerPk: string;

  constructor(rpcUrl: string, fundedPk: string, l2OwnerPk: string) {
    this.rpcUrl = rpcUrl;
    this.fundedPk = fundedPk;
    this.l2OwnerPk = l2OwnerPk;
    this.provider = new JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(fundedPk, this.provider);
    this.l2OwnerWallet = new Wallet(l2OwnerPk, this.provider);
  }

  /**
   * Get a fresh wallet+provider pair to avoid ethers nonce caching issues.
   */
  private freshL2OwnerWallet(): Wallet {
    return new Wallet(this.l2OwnerPk, new JsonRpcProvider(this.rpcUrl));
  }

  private freshFundedWallet(): Wallet {
    return new Wallet(this.fundedPk, new JsonRpcProvider(this.rpcUrl));
  }

  get address(): string {
    return this.wallet.address;
  }

  getCMAContract(cmaAddress: string, signer?: Wallet): Contract {
    const artifact = JSON.parse(fs.readFileSync(CMA_ABI_PATH, 'utf-8'));
    return new Contract(cmaAddress, artifact.abi, signer || this.wallet);
  }

  getArbWasm(signer?: Wallet): Contract {
    const artifact = JSON.parse(fs.readFileSync(ARB_WASM_ABI_PATH, 'utf-8'));
    return new Contract(
      '0x0000000000000000000000000000000000000071',
      artifact.abi,
      signer || this.l2OwnerWallet,
    );
  }

  getArbOwner(signer?: Wallet): Contract {
    return new Contract(
      '0x0000000000000000000000000000000000000070',
      ARB_OWNER_ABI,
      signer || this.l2OwnerWallet,
    );
  }

  getCacheManager(address: string, signer?: Wallet): Contract {
    return new Contract(
      address,
      CACHE_MANAGER_ABI,
      signer || this.l2OwnerWallet,
    );
  }

  /**
   * Activate a Stylus program via ArbWasm precompile.
   * Must be called before caching. Requires a small ETH value for dataFee.
   */
  async activateProgram(
    contractAddress: string,
    value = ethers.parseEther('0.01'),
  ): Promise<ethers.TransactionReceipt> {
    const signer = this.freshL2OwnerWallet();
    const arbWasm = this.getArbWasm(signer);
    const tx = await arbWasm.activateProgram(contractAddress, { value });
    return (await tx.wait())!;
  }

  /**
   * Register a contract in CMA with insertContract.
   */
  async insertContract(
    cmaAddress: string,
    contractAddress: string,
    opts: {
      maxBid?: bigint;
      biddingEnabled?: boolean;
      autoActivate?: boolean;
      maxActivationCost?: bigint;
      funding?: bigint;
    } = {},
  ): Promise<ethers.TransactionReceipt> {
    const cma = this.getCMAContract(cmaAddress, this.freshFundedWallet());
    const tx = await cma.insertContract(
      contractAddress,
      opts.maxBid ?? ethers.parseEther('0.001'),
      opts.biddingEnabled ?? true,
      opts.autoActivate ?? false,
      opts.maxActivationCost ?? 0n,
      { value: opts.funding ?? ethers.parseEther('0.005') },
    );
    return (await tx.wait())!;
  }

  /**
   * Fund the CMA escrow balance.
   */
  async fundBalance(
    cmaAddress: string,
    amount = ethers.parseEther('0.01'),
  ): Promise<ethers.TransactionReceipt> {
    const cma = this.getCMAContract(cmaAddress, this.freshFundedWallet());
    const tx = await cma.fundBalance({ value: amount });
    return (await tx.wait())!;
  }

  /**
   * Call placeBids on CMA.
   */
  async placeBids(
    cmaAddress: string,
    bids: Array<{ user: string; address: string }>,
  ): Promise<ethers.TransactionReceipt> {
    const cma = this.getCMAContract(cmaAddress, this.freshFundedWallet());
    const args = bids.map((b) => [b.user, b.address]);
    const tx = await cma.placeBids(args, { gasLimit: 12_000_000 });
    return (await tx.wait())!;
  }

  /**
   * Call placeActivations on CMA.
   */
  async placeActivations(
    cmaAddress: string,
    activations: Array<{ user: string; address: string }>,
  ): Promise<ethers.TransactionReceipt> {
    const cma = this.getCMAContract(cmaAddress, this.freshFundedWallet());
    const args = activations.map((a) => [a.user, a.address]);
    const tx = await cma.placeActivations(args, { gasLimit: 12_000_000 });
    return (await tx.wait())!;
  }

  /**
   * Update a contract in CMA.
   * Signature (CMA v2.0): updateContract(address, uint256 maxBid, bool biddingEnabled, bool autoActivate, uint256 maxActivationCost)
   */
  async updateContract(
    cmaAddress: string,
    contractAddress: string,
    opts: {
      maxBid: bigint;
      biddingEnabled: boolean;
      autoActivate: boolean;
      maxActivationCost: bigint;
    },
  ): Promise<ethers.TransactionReceipt> {
    const cma = this.getCMAContract(cmaAddress, this.freshFundedWallet());
    const tx = await cma.updateContract(
      contractAddress,
      opts.maxBid,
      opts.biddingEnabled,
      opts.autoActivate,
      opts.maxActivationCost,
    );
    return (await tx.wait())!;
  }

  /**
   * Remove a contract from CMA.
   */
  async removeContract(
    cmaAddress: string,
    contractAddress: string,
  ): Promise<ethers.TransactionReceipt> {
    const cma = this.getCMAContract(cmaAddress, this.freshFundedWallet());
    const tx = await cma.removeContract(contractAddress);
    return (await tx.wait())!;
  }

  /**
   * Set WASM expiry to a short duration for testing.
   */
  async setWasmExpiryDays(days: number): Promise<void> {
    const signer = this.freshL2OwnerWallet();
    const arbOwner = this.getArbOwner(signer);
    const tx = await arbOwner.setWasmExpiryDays(days);
    await tx.wait();
  }

  /**
   * Set WASM keepalive days (0 disables keepalive protection).
   */
  async setWasmKeepaliveDays(days: number): Promise<void> {
    const signer = this.freshL2OwnerWallet();
    const arbOwner = this.getArbOwner(signer);
    const tx = await arbOwner.setWasmKeepaliveDays(days);
    await tx.wait();
  }

  /**
   * Check programTimeLeft for a contract.
   * Returns seconds remaining, or -1 if ProgramExpired, or -2 if ProgramNotActivated.
   */
  async programTimeLeft(contractAddress: string): Promise<bigint> {
    const arbWasm = this.getArbWasm(this.wallet);
    try {
      return await arbWasm.programTimeLeft(contractAddress);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('ProgramExpired') || msg.includes('0xc9b12e52'))
        return -1n;
      if (msg.includes('ProgramNotActivated')) return -2n;
      throw error;
    }
  }

  /**
   * Check if a contract is in the Stylus cache via ArbWasmCache precompile.
   */
  async isCached(contractAddress: string): Promise<boolean> {
    const arbWasmCache = new Contract(
      '0x0000000000000000000000000000000000000072',
      ['function codehashIsCached(bytes32 codehash) view returns (bool)'],
      this.provider,
    );
    const code = await this.provider.getCode(contractAddress);
    const codehash = ethers.keccak256(code);
    return arbWasmCache.codehashIsCached(codehash);
  }

  /**
   * Set the CacheManager cache size. Requires chain owner.
   */
  async setCacheSize(
    cacheManagerAddress: string,
    newSize: bigint,
  ): Promise<ethers.TransactionReceipt> {
    const cm = this.getCacheManager(
      cacheManagerAddress,
      this.freshL2OwnerWallet(),
    );
    const tx = await cm.setCacheSize(newSize);
    return (await tx.wait())!;
  }

  /**
   * Evict all entries from the Stylus cache. Requires chain owner.
   */
  async evictAll(
    cacheManagerAddress: string,
  ): Promise<ethers.TransactionReceipt> {
    const cm = this.getCacheManager(
      cacheManagerAddress,
      this.freshL2OwnerWallet(),
    );
    const tx = await cm.evictAll();
    return (await tx.wait())!;
  }

  /**
   * Get the minimum bid for a program address from the CacheManager.
   */
  async getMinBid(
    cacheManagerAddress: string,
    programAddress: string,
  ): Promise<bigint> {
    const cm = this.getCacheManager(cacheManagerAddress);
    return cm['getMinBid(address)'](programAddress);
  }

  /**
   * Send a dummy tx to advance the chain clock.
   */
  async sendDummyTx(): Promise<void> {
    const signer = this.freshFundedWallet();
    const tx = await signer.sendTransaction({
      to: signer.address,
      value: 0n,
    });
    await tx.wait();
  }

  /**
   * Get the user's CMA escrow balance.
   * Uses a static call to depositsOf(walletAddress) on the BiddingEscrow contract.
   */
  async getUserBalance(cmaAddress: string): Promise<bigint> {
    const cma = this.getCMAContract(cmaAddress);
    const escrowAddress: string = await cma.escrow();
    const escrow = new Contract(
      escrowAddress,
      ['function depositsOf(address) view returns (uint256)'],
      this.provider,
    );
    return BigInt((await escrow.depositsOf(this.wallet.address)) as string);
  }

  /**
   * Withdraw all CMA escrow balance, draining it to zero.
   */
  async withdrawBalance(
    cmaAddress: string,
  ): Promise<ethers.TransactionReceipt> {
    const cma = this.getCMAContract(cmaAddress, this.freshFundedWallet());
    const tx = await cma.withdrawBalance();
    return (await tx.wait())!;
  }

  /**
   * Deploy dummy WASM contracts by calling the deployment script
   * in the contracts repo.
   */
  deployDummyWASM(amount = 1): string[] {
    const contractsRoot = path.resolve(
      __dirname,
      '../../../stylus-cm-contracts',
    );
    const scriptPath = path.join(
      contractsRoot,
      'test/utils/deploy-dummy-wasm.sh',
    );

    if (!fs.existsSync(scriptPath)) {
      throw new Error(
        `deploy-dummy-wasm.sh not found at ${scriptPath}. ` +
          'Ensure the stylus-cm-contracts submodule is initialized.',
      );
    }

    const rpcUrl = this.provider._getConnection().url;
    const pk = this.wallet.privateKey;
    const output = execSync(`bash "${scriptPath}" -e .env -i ${amount}`, {
      cwd: contractsRoot,
      encoding: 'utf-8',
      timeout: 120000,
      env: {
        ...process.env,
        ARBPRE_PK: pk,
        RPC: rpcUrl,
      },
    });

    const ansiRegex = /\x1B\[[0-9;]*[mK]/g;
    const cleaned = output.replace(ansiRegex, '').trim();
    const addresses = cleaned
      .split('\n')
      .filter((line) => line.startsWith('0x'));

    if (addresses.length === 0) {
      throw new Error(
        `deploy-dummy-wasm.sh produced no addresses. Output:\n${cleaned}`,
      );
    }

    return addresses;
  }
}
