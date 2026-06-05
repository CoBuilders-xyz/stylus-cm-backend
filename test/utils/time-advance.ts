import { execSync } from 'child_process';
import * as path from 'path';
import { ChainClient } from './chain-client';

const SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../../scripts/multipass-testnode.sh',
);

/**
 * Check if the multipass VM is reachable.
 */
export function isMultipassAvailable(vmName: string): boolean {
  try {
    const output = execSync(`multipass info "${vmName}" 2>&1`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return output.includes('Running');
  } catch {
    return false;
  }
}

/**
 * Advance the VM system clock by the given number of hours.
 * Uses the multipass-testnode.sh script which properly disables NTP,
 * advances the clock, and sends a dummy tx.
 */
export async function advanceVmTime(
  _vmName: string,
  hours: number,
  chain: ChainClient,
): Promise<void> {
  try {
    execSync(`bash "${SCRIPT_PATH}" time-advance ${hours}`, {
      encoding: 'utf-8',
      timeout: 30000,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to advance VM time: ${msg}`);
  }
  // Send a few more dummy txs to ensure blocks with new timestamps propagate
  for (let i = 0; i < 3; i++) {
    await chain.sendDummyTx();
  }
}

/**
 * Reset the VM clock back to real time.
 * Uses the multipass-testnode.sh script which re-enables NTP,
 * restarts containers, and waits for the sequencer.
 */
export async function resetVmTime(): Promise<void> {
  try {
    execSync(`bash "${SCRIPT_PATH}" time-reset`, {
      encoding: 'utf-8',
      timeout: 120000,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to reset VM time: ${msg}`);
  }
}

/**
 * Get the current system time inside the VM.
 */
export function getVmTime(vmName: string): Date {
  const output = execSync(
    `multipass exec "${vmName}" -- bash -lc 'date -u +%Y-%m-%dT%H:%M:%SZ'`,
    { encoding: 'utf-8', timeout: 10000 },
  );
  return new Date(output.trim());
}
