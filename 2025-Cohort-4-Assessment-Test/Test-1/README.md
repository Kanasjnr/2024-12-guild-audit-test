

## Task 1: Building

## Project: Lending and Borrowing Protocol  
**Objective:** Build a platform where users can:  
- Deposit tokens as collateral to borrow other tokens.  
- Execute flash loans to leverage arbitrage, liquidation opportunities, or other DeFi strategies.  
- Manage lending, borrowing, and collateralization parameters efficiently and securely.  

This project will encompass advanced DeFi concepts like:  
1. **Interest Rate Calculations** and **Collateral Management**  
2. **Flash Loans** to provide participants with a deeper understanding of lending protocols.  

Make sure to follow the follow the instructions below;

Core Features to Implement  
**Deposit and Collateralization**  
- **Token Support:** Users can deposit whitelisted ERC20 tokens as collateral(Create a list of whitelisted tokens).  
- **Mock Price Oracle:** Collateral values are assessed using a mock price oracle to simulate real-world price feeds.  
- **Transfer Fees:** The lending protocol will only lend specific tokens that incur an **8% transfer fee**. This fee is redirected to a dedicated **auction contract** within the protocol, in addition to the lending fees.  

 **Borrowing**  
- **Collateralization Ratio:** Enforce a **150% collateralization ratio** to maintain platform security.  
- **Whitelisted Tokens:** Any whitelisted token can be used as collateral for borrowing operations.  
- **Interest Accumulation:** Apply a **time-based interest model** to borrowed tokens, ensuring dynamic interest growth over time.  

**Flash Loans**  
- **Collateral-Free Loans:** Users can borrow tokens for a single transaction without collateral.  
- **Fee Structure:** A **0.09% fee** is applied to flash loans, which is collected upon loan repayment. For instance, borrowing 10,000 DAI requires repaying **10,009 DAI** (principal + fee).

**Liquidation Mechanism**  
- **Auction Integration:** Users with active loan positions can enter a **perpetual auction** tied to their positions. If the user repays the loan, they can claim **rewards** from the position and withdraw their collateral.  
- **Unhealthy Positions:** For under-collateralized positions, liquidators can:  
  - Liquidate the position.  
  - Claim rewards from the auction.  
  - Transfer the remaining collateral to the **protocol** or **lender**.  
- **Reward Pool:** Funded by a percentage of **platform fees** and **accumulated interest** to incentivize liquidation participants.  

**Platform Fees and Rewards**  
- **Fee Distribution:** The protocol charges fees on:  
  - Interest earned on borrowed tokens.  
  - Flash loan repayments.  
- **Token Holder Rewards:** Distribute a portion of these fees as rewards to token holders, enhancing protocol engagement.  

Additional Notes  
- Ensure all code and concepts are original. Copied or plagiarized work will result in disqualification.  
- Write comprehensive unit tests to cover every potential edge case.  
