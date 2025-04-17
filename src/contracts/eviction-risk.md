# Contract Eviction Risk and Suggested Bids

This document explains how the contract eviction risk assessment and suggested bids functionality works in our system. These features help users understand the risk of their contracts being evicted from the cache and recommend appropriate bid levels.

## Table of Contents

- [Overview](#overview)
- [Eviction Risk Assessment](#eviction-risk-assessment)
- [Suggested Bids](#suggested-bids)
- [Risk Multipliers](#risk-multipliers)
- [Cache Statistics](#cache-statistics)
- [Technical Implementation](#technical-implementation)

## Overview

On the Stylus platform, contracts must bid to secure space in the cache. If a contract's effective bid becomes too low compared to other contracts, it risks being evicted from the cache. Our system helps users understand:

1. What is the current risk level of their contract being evicted?
2. What bid amounts should they consider to reduce this risk?

These features are crucial for users who want to ensure their contracts remain in the cache and operate efficiently.

## Eviction Risk Assessment

The eviction risk assessment evaluates how likely a contract is to be evicted from the cache based on its current effective bid compared to recommended bid levels.

### How It Works

1. **Effective Bid Calculation**:

   - The system takes the contract's last bid amount
   - Applies a decay penalty based on time elapsed since the last bid
   - Formula: `effectiveBid = lastBid - (timeElapsed * decayRate)`

2. **Risk Level Determination**:

   - Compares the effective bid to three threshold levels: high risk, mid risk, and low risk
   - Assigns a risk level of "high", "medium", or "low" based on where the effective bid falls

3. **Risk Categories**:
   - **High Risk**: The contract is likely to be evicted soon if the cache becomes competitive
   - **Medium Risk**: The contract has a reasonable chance of staying cached but could be evicted under pressure
   - **Low Risk**: The contract will likely remain cached even under competitive conditions

### Example

If a contract has an effective bid of 100 wei, and the suggested bids are:

- High Risk: 90 wei
- Mid Risk: 135 wei
- Low Risk: 225 wei

Then the contract would be assigned a "high" risk level because its effective bid (100) is below the mid risk threshold (135).

## Suggested Bids

Suggested bids are recommended bid amounts for different risk tolerance levels, calculated based on contract size and current cache conditions.

### How Suggested Bids Are Calculated

1. **Base Calculation**: Starts with the minimum acceptable bid for the contract's size
2. **Risk Adjustments**: Applies multipliers to this base amount:
   - **High Risk**: 1.0x (minimum bid, just enough to get in)
   - **Mid Risk**: ~1.5x (adjusted for cache conditions)
   - **Low Risk**: ~2.5x (adjusted for cache conditions)
3. **Dynamic Adjustments**: The mid and low risk multipliers are adjusted based on cache statistics:
   - Higher cache utilization increases suggested bids
   - Higher eviction rates increase suggested bids
   - More competitive environments increase suggested bids

### Example

If the minimum bid for a contract is 100 wei and the cache is moderately competitive (adjustment factor of 1.2):

- High Risk Bid: `100 wei (always minimum bid)`
- Mid Risk Bid: `100 * 1.5 * 1.2 = 180 wei`
- Low Risk Bid: `100 * 2.5 * 1.2 = 300 wei`

## Risk Multipliers

Risk multipliers determine how much higher than the minimum bid a contract should bid to achieve a particular risk level.

### Base Multipliers

- **High Risk**: 1.0x - Minimum viable bid (bare minimum to get in the cache)
- **Mid Risk**: 1.5x - Better chance of staying cached
- **Low Risk**: 2.5x - Very likely to stay cached

### Dynamic Adjustments

These base multipliers are adjusted based on three key factors:

1. **Utilization Factor**: `1 + cacheUtilization`

   - Increases as the cache becomes more full
   - A 90% full cache would have a utilization factor of 1.9

2. **Eviction Factor**: `1 + min(evictionRate / 10, 0.5)`

   - Increases when the eviction rate is higher
   - Capped at a maximum increase of 50%

3. **Competitiveness Factor**: `1 + competitiveness`
   - Increases with overall cache competition
   - Based on a combination of utilization and eviction rate

The final adjustment is calculated as:

```
combinedAdjustment = (utilizationFactor * 0.5) + (evictionFactor * 0.3) + (competitivenessFactor * 0.2)
```

## Cache Statistics

Cache statistics provide context for understanding the current state of the cache and are used to adjust risk multipliers.

### Key Metrics

- **Utilization**: What percentage of the total cache space is currently in use (0-1)
- **Eviction Rate**: How many contracts are being evicted per day
- **Median Bid Per Byte**: The median bid amount per byte of all cached contracts
- **Competitiveness**: A measure of how competitive the cache environment is (0-1)
- **Cache Size**: Total available cache size in bytes
- **Used Cache Size**: How much of the cache is currently used in bytes

### How They Impact Risk Assessment

- Higher utilization means more competition for space → higher risk
- Higher eviction rate means more contracts being removed → higher risk
- Higher competitiveness means bids need to be higher to stay safe → higher risk

## Technical Implementation

The system conditionally applies different calculations based on whether a contract is currently cached or not:

### For Cached Contracts

When a contract is cached (`contract.bytecode.isCached` is `true`), the system calculates:

1. **Effective Bid**: The current remaining bid value after decay
2. **Eviction Risk**: The risk assessment comparing the effective bid to suggested bids

### For Non-Cached Contracts

When a contract is not cached (`contract.bytecode.isCached` is `false`), the system only provides:

1. **Suggested Bids**: Recommended bid levels based on the contract's size and current cache conditions

### Main Methods

The system uses two main methods to perform these calculations:

#### 1. `calculateEvictionRisk`

This method in `ContractsUtilsService` calculates the eviction risk for a cached contract. It:

- Retrieves the contract's bid, size, and timestamp
- Calculates the effective bid after decay
- Gets suggested bids for the contract's size
- Compares the effective bid to suggested bids
- Determines the risk level
- Returns detailed information about the risk assessment

#### 2. `getSuggestedBids`

This method calculates appropriate bid levels for a given contract size based on current cache conditions. It:

- Gets the minimum bid from the cache manager contract
- Retrieves current cache statistics
- Calculates dynamic risk multipliers based on cache conditions
- Applies these multipliers to generate suggested bid levels
- Returns the suggested bid amounts and cache statistics

#### 3. `processContract`

This method ties everything together by:

- Checking if the contract is cached
- For cached contracts: calculating effective bid and eviction risk
- For non-cached contracts: calculating suggested bids only
- Optionally including bidding history if requested

These methods work together to provide users with actionable information about their contracts' risk status and recommended bidding strategies based on whether the contract is already in the cache or not.

---

By monitoring eviction risk and following suggested bid recommendations, users can optimize their bidding strategy to maintain an appropriate balance between cost and cache reliability.
