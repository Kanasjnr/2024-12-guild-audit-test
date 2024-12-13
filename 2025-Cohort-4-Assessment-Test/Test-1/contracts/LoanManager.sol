// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

contract LoanManager is Ownable {
    struct Loan {
        uint256 amount;
        uint256 lastInterestUpdate;
    }

    mapping(address => mapping(address => uint256)) public collateral;
    mapping(address => mapping(address => Loan)) public loans;

    uint256 public constant INTEREST_RATE = 5; // 5% annual interest rate
    uint256 public constant SECONDS_PER_YEAR = 31536000;

    event CollateralUpdated(address indexed user, address indexed token, uint256 amount, bool isDeposit);
    event LoanUpdated(address indexed user, address indexed token, uint256 amount, bool isBorrow);
    event LoanCleared(address indexed user, address indexed collateralToken, address indexed debtToken);

    function updateCollateral(address user, address token, uint256 amount, bool isDeposit) external onlyOwner {
        if (isDeposit) {
            collateral[user][token] += amount;
        } else {
            require(collateral[user][token] >= amount, "insufficient collateral");
            collateral[user][token] -= amount;
        }
        emit CollateralUpdated(user, token, amount, isDeposit);
    }

    function updateLoan(address user, address token, uint256 amount, bool isBorrow) external onlyOwner {
        Loan storage loan = loans[user][token];

        if (isBorrow) {
            if (loan.amount == 0) {
                loan.lastInterestUpdate = block.timestamp;
            } else {
                uint256 interest = calculateInterest(user, token);
                loan.amount += interest;
                loan.lastInterestUpdate = block.timestamp;
            }
            loan.amount += amount;
        } else {
            require(loan.amount >= amount, "Repayment amount too high");
            uint256 interest = calculateInterest(user, token);
            loan.amount += interest;
            loan.amount -= amount;
            loan.lastInterestUpdate = block.timestamp;
        }

        emit LoanUpdated(user, token, amount, isBorrow);
    }

    function calculateInterest(address user, address token) public view returns (uint256) {
        Loan storage loan = loans[user][token];
        if (loan.amount == 0) return 0;

        uint256 timeElapsed = block.timestamp - loan.lastInterestUpdate;
        return (loan.amount * INTEREST_RATE * timeElapsed) / (SECONDS_PER_YEAR * 100);
    }

    function getCollateralAmount(address user, address token) external view returns (uint256) {
        return collateral[user][token];
    }

    function getLoanAmount(address user, address token) external view returns (uint256) {
        return loans[user][token].amount;
    }

    function clearLoan(address user, address collateralToken, address debtToken) external onlyOwner {
        delete collateral[user][collateralToken];
        delete loans[user][debtToken];
        emit LoanCleared(user, collateralToken, debtToken);
    }

    constructor() Ownable(msg.sender) {}
}

