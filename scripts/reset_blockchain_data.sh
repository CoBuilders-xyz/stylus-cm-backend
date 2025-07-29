#!/bin/bash

# Reset blockchain data for resync
# Usage: ./reset_blockchain_data.sh <BLOCKCHAIN_ID> <PSQL_URL>
# 
# This script will:
# - DELETE all blockchain events for the specified blockchain
# - RESET contract values (lastBid, bidPlusDecay, totalBidInvestment) to '0'
# - RESET bytecode values (lastBid, lastEvictionBid, bidPlusDecay, totalBidInvestment) to '0' and isCached to false
# - RESET blockchain sync values (lastSyncedBlock, lastProcessedBlockNumber) to 0

set -e  # Exit on any error

# Check if correct number of arguments provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <BLOCKCHAIN_ID> <PSQL_URL>"
    echo "Example: $0 'abc-123-def' 'postgresql://scm-db-user:scm-db-pwd@localhost:5432/scm_db'"
    echo ""
    echo "This script will:"
    echo "  - DELETE all blockchain events for the blockchain"
    echo "  - RESET contract bid values to 0"
    echo "  - RESET bytecode bid values to 0 and isCached to false"  
    echo "  - RESET blockchain sync blocks to 0"
    exit 1
fi

BLOCKCHAIN_ID="$1"
PSQL_URL="$2"

# Validate that blockchain ID is provided
if [ -z "$BLOCKCHAIN_ID" ]; then
    echo "Error: BLOCKCHAIN_ID cannot be empty"
    exit 1
fi

# Validate that PSQL URL is provided
if [ -z "$PSQL_URL" ]; then
    echo "Error: PSQL_URL cannot be empty"
    exit 1
fi

echo "=========================================="
echo "Blockchain Database Reset Script"
echo "=========================================="
echo "Blockchain ID: $BLOCKCHAIN_ID"
echo "Database URL: ${PSQL_URL%/*}/*** (credentials hidden)"
echo ""
echo "This will:"
echo "  • DELETE all blockchain events"
echo "  • RESET all contract bid data to 0"
echo "  • RESET all bytecode bid data to 0"
echo "  • SET all bytecode isCached to false" 
echo "  • RESET blockchain sync blocks to 0"
echo "=========================================="

# Confirm before proceeding
read -p "Are you sure you want to reset data for this blockchain? This action cannot be undone. (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 1
fi

echo "Executing reset script..."

# Execute the SQL script with parameters
psql "$PSQL_URL" -v blockchain_id="'$BLOCKCHAIN_ID'" -f scripts/reset_blockchain_data.sql

echo "=========================================="
echo "Reset completed successfully!"
echo "==========================================" 