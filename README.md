# Requirements
* Only the team can deposit the rewards
* Each time the rewards are deposited it should be a way for stakers to withraws is share of the reward (with their money).
* In every withraw stakers unstake their share plus the rewards


# Assumptions
* Whenever the team deposits it take a snap of the current stakers to share the rewards according to their share of the pool, not taking into account the exact time when they decided to stake. Example:
1. The ETHPool contract is deployed the 01/01
1. **A** deposits 1 ETH the day 02/01
1. **B** deposit 1 ETH the day 03/01
1. **T** deposit a reward of 2 ETH, if **A** or **B** want to usntake their part they will recive 2 ETH

# Aproches
## Naive for loop aproach
Using a loop for through an array of the stakers to decide their part of the reward by the team would be super expensive. This happens because the team would have to pay for the transactions.

## Snapshot aproach
The idea is to take into account when the stakers do their stake, when rewards are deposited, the amount already staked when rewards are deposited and save most of the data when:
* The staker do its stake
* The team deposit rewards