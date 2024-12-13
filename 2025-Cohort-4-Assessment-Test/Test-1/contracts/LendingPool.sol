// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AuctionManager.sol";
import "./LoanManager.sol";

contract LendingPool is Ownable {
    AuctionManager public immutable auctionManager;
    LoanManager public immutable loanManager;

    mapping(address => bool) public whitelistedTokens;
    mapping(address => uint256) public tokenPrices;

    uint256 public constant COLLATERALIZATION_RATIO = 150; // 150%
    uint256 public constant FLASH_LOAN_FEE = 9; // 0.09%
    uint256 public constant TRANSFER_FEE = 800; // 8%

    uint256 public rewardPool;

    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Borrow(address indexed user, address indexed token, uint256 amount);
    event Repay(address indexed user, address indexed token, uint256 amount);
    event FlashLoan(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event Liquidation(
        address indexed user,
        address indexed collateralToken,
        address indexed debtToken,
        uint256 amount
    );
    event PriceUpdated(address indexed token, uint256 price);

    constructor() Ownable(msg.sender) {
        auctionManager = new AuctionManager();
        loanManager = new LoanManager();
    }

    function deposit(address token, uint256 amount) external {
        require(whitelistedTokens[token], "Token not whitelisted");
        require(
            IERC20(token).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        loanManager.updateCollateral(msg.sender, token, amount, true);
        emit Deposit(msg.sender, token, amount);
    }

    function borrow(
        address collateralToken,
        address borrowToken,
        uint256 borrowAmount
    ) external {
        require(
            whitelistedTokens[collateralToken] &&
                whitelistedTokens[borrowToken],
            "Tokens not whitelisted"
        );

        uint256 collateralAmount = loanManager.getCollateralAmount(
            msg.sender,
            collateralToken
        );
        uint256 collateralValue = (collateralAmount *
            tokenPrices[collateralToken]) / 1e18;
        uint256 borrowValue = (borrowAmount * tokenPrices[borrowToken]) / 1e18;

        require(
            collateralValue >= (borrowValue * COLLATERALIZATION_RATIO) / 100,
            "not enough collateral to cover loan"
        );

        loanManager.updateLoan(msg.sender, borrowToken, borrowAmount, true);

        uint256 transferFeeAmount = (borrowAmount * TRANSFER_FEE) / 10000;
        uint256 amountAfterFee = borrowAmount - transferFeeAmount;

        require(
            IERC20(borrowToken).transfer(msg.sender, amountAfterFee),
            "Transfer failed"
        );
        require(
            IERC20(borrowToken).transfer(
                address(auctionManager),
                transferFeeAmount
            ),
            "Fee transfer failed"
        );

        emit Borrow(msg.sender, borrowToken, borrowAmount);
    }

    function repay(address token, uint256 amount) external {
        uint256 loanAmount = loanManager.getLoanAmount(msg.sender, token);
        require(loanAmount > 0, "No active loan");

        uint256 interest = loanManager.calculateInterest(msg.sender, token);
        uint256 totalDue = loanAmount + interest;
        require(amount <= totalDue, "Repayment amount too high");

        require(
            IERC20(token).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        loanManager.updateLoan(msg.sender, token, amount, false);

        uint256 feeAmount = (interest * TRANSFER_FEE) / 10000;
        rewardPool += feeAmount;

        emit Repay(msg.sender, token, amount);
    }

    function flashLoan(address token, uint256 amount) external {
        require(whitelistedTokens[token], "Token not whitelisted");
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        require(balanceBefore >= amount, "Insufficient balance");

        IERC20(token).transfer(msg.sender, amount);

        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        uint256 fee = (amount * FLASH_LOAN_FEE) / 10000;
        require(balanceAfter >= balanceBefore + fee, "Flash loan not repaid");

        rewardPool += fee;
        emit FlashLoan(msg.sender, token, amount);
    }

    function liquidate(
        address user,
        address collateralToken,
        address debtToken
    ) external {
        uint256 collateralAmount = loanManager.getCollateralAmount(
            user,
            collateralToken
        );
        uint256 loanAmount = loanManager.getLoanAmount(user, debtToken);
        require(loanAmount > 0, "No active loan");

        uint256 collateralValue = (collateralAmount *
            tokenPrices[collateralToken]) / 1e18;
        uint256 debtValue = (loanAmount * tokenPrices[debtToken]) / 1e18;

        require(
            collateralValue < (debtValue * COLLATERALIZATION_RATIO) / 100,
            "not enough collateral to cover loan"
        );

        uint256 collateralToLiquidate = (loanAmount * tokenPrices[debtToken]) /
            tokenPrices[collateralToken];

        require(
            IERC20(debtToken).transferFrom(
                msg.sender,
                address(this),
                loanAmount
            ),
            "Debt transfer failed"
        );

        IERC20(collateralToken).transfer(msg.sender, collateralToLiquidate);
        IERC20(collateralToken).transfer(
            address(auctionManager),
            collateralAmount - collateralToLiquidate
        );

        loanManager.clearLoan(user, collateralToken, debtToken);

        auctionManager.createAuction(
            collateralToken,
            collateralAmount - collateralToLiquidate
        );

        emit Liquidation(user, collateralToken, debtToken, loanAmount);
    }

    function whitelistToken(address token) external onlyOwner {
        whitelistedTokens[token] = true;
    }

    function updatePrice(address token, uint256 price) external onlyOwner {
        tokenPrices[token] = price;
        emit PriceUpdated(token, price);
    }

    function distributeRewards() external onlyOwner {
        require(rewardPool > 0, "No rewards to distribute");
        IERC20(address(auctionManager)).transfer(msg.sender, rewardPool);
        rewardPool = 0;
    }
}
