-- Reset blockchain data for resync
-- Parameters: BLOCKCHAIN_ID, PSQL_URL
-- Usage: psql "PSQL_URL" -v blockchain_id="'your-blockchain-id'" -f reset_blockchain_data.sql

\echo 'Starting blockchain data reset for blockchain ID:' :blockchain_id

-- Begin transaction for data consistency
BEGIN;

-- Store count of events to be deleted for reporting
SELECT COUNT(*) as events_to_delete FROM blockchain_event be 
INNER JOIN blockchain b ON be."blockchainId" = b.id 
WHERE b.id = :blockchain_id;

-- Delete all blockchain events for the specified blockchain
DELETE FROM blockchain_event 
WHERE "blockchainId" = :blockchain_id;

\echo 'Deleted blockchain events'

-- Reset contract table values for the specified blockchain
UPDATE contract 
SET 
    "lastBid" = '0',
    "bidPlusDecay" = '0',
    "totalBidInvestment" = '0'
WHERE "blockchainId" = :blockchain_id;

\echo 'Updated contract table records'

-- Reset bytecode table values for the specified blockchain  
UPDATE bytecode 
SET 
    "lastBid" = '0',
    "lastEvictionBid" = '0',
    "bidPlusDecay" = '0',
    "totalBidInvestment" = '0',
    "isCached" = false
WHERE "blockchainId" = :blockchain_id;

\echo 'Updated bytecode table records'

-- Reset blockchain table values for the specified blockchain
UPDATE blockchain 
SET 
    "lastSyncedBlock" = 0,
    "lastProcessedBlockNumber" = 0
WHERE id = :blockchain_id;

\echo 'Updated blockchain table record'

-- Display counts of affected records
SELECT 
    (SELECT COUNT(*) FROM contract WHERE "blockchainId" = :blockchain_id) as contracts_reset,
    (SELECT COUNT(*) FROM bytecode WHERE "blockchainId" = :blockchain_id) as bytecodes_reset,
    (SELECT COUNT(*) FROM blockchain WHERE id = :blockchain_id) as blockchain_records_reset;

\echo 'Summary: All blockchain events deleted, contract/bytecode values reset to 0/false, blockchain sync blocks reset to 0'

-- Commit the transaction
COMMIT;

\echo 'Blockchain data reset completed successfully for blockchain ID:' :blockchain_id 