import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { LoanManager, Token } from "../typechain-types";

describe("LoanManager", function () {
  async function deployLoanManagerFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const LoanManager = await ethers.getContractFactory("LoanManager");
    const loanManager = await LoanManager.deploy();

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy("Test Token", "TST");

    return { loanManager, token, owner, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { loanManager, owner } = await loadFixture(deployLoanManagerFixture);
      expect(await loanManager.owner()).to.equal(owner.address);
    });
  });

  describe("Collateral Management", function () {
    it("Should update collateral when depositing", async function () {
      const { loanManager, token, user1 } = await loadFixture(deployLoanManagerFixture);
      const amount = ethers.parseEther("100");

      await expect(loanManager.updateCollateral(user1.address, token.target, amount, true))
        .to.emit(loanManager, "CollateralUpdated")
        .withArgs(user1.address, token.target, amount, true);

      expect(await loanManager.getCollateralAmount(user1.address, token.target)).to.equal(amount);
    });

    it("Should update collateral when withdrawing", async function () {
      const { loanManager, token, user1 } = await loadFixture(deployLoanManagerFixture);
      const depositAmount = ethers.parseEther("100");
      const withdrawAmount = ethers.parseEther("50");

      await loanManager.updateCollateral(user1.address, token.target, depositAmount, true);

      await expect(loanManager.updateCollateral(user1.address, token.target, withdrawAmount, false))
        .to.emit(loanManager, "CollateralUpdated")
        .withArgs(user1.address, token.target, withdrawAmount, false);

      expect(await loanManager.getCollateralAmount(user1.address, token.target)).to.equal(depositAmount - withdrawAmount);
    });

    it("Should revert when withdrawing more than deposited", async function () {
      const { loanManager, token, user1 } = await loadFixture(deployLoanManagerFixture);
      const depositAmount = ethers.parseEther("100");
      const withdrawAmount = ethers.parseEther("150");

      await loanManager.updateCollateral(user1.address, token.target, depositAmount, true);

      await expect(loanManager.updateCollateral(user1.address, token.target, withdrawAmount, false))
        .to.be.revertedWith("insufficient collateral");
    });
  });

  describe("Loan Management", function () {
    it("Should update loan when borrowing", async function () {
      const { loanManager, token, user1 } = await loadFixture(deployLoanManagerFixture);
      const amount = ethers.parseEther("100");

      await expect(loanManager.updateLoan(user1.address, token.target, amount, true))
        .to.emit(loanManager, "LoanUpdated")
        .withArgs(user1.address, token.target, amount, true);

      expect(await loanManager.getLoanAmount(user1.address, token.target)).to.equal(amount);
    });

    it("Should update loan when repaying", async function () {
      const { loanManager, token, user1 } = await loadFixture(deployLoanManagerFixture);
      const borrowAmount = ethers.parseEther("100");
      const repayAmount = ethers.parseEther("50");

      await loanManager.updateLoan(user1.address, token.target, borrowAmount, true);

      await expect(loanManager.updateLoan(user1.address, token.target, repayAmount, false))
        .to.emit(loanManager, "LoanUpdated")
        .withArgs(user1.address, token.target, repayAmount, false);

      expect(await loanManager.getLoanAmount(user1.address, token.target)).to.be.closeTo(borrowAmount - repayAmount, ethers.parseEther("0.01"));
    });

    it("Should revert when repaying more than borrowed", async function () {
      const { loanManager, token, user1 } = await loadFixture(deployLoanManagerFixture);
      const borrowAmount = ethers.parseEther("100");
      const repayAmount = ethers.parseEther("150");

      await loanManager.updateLoan(user1.address, token.target, borrowAmount, true);

      await expect(loanManager.updateLoan(user1.address, token.target, repayAmount, false))
        .to.be.revertedWith("Repayment amount too high");
    });
  });

  describe("Interest Calculation", function () {
    it("Should calculate interest correctly", async function () {
      const { loanManager, token, user1 } = await loadFixture(deployLoanManagerFixture);
      const borrowAmount = ethers.parseEther("100");

      await loanManager.updateLoan(user1.address, token.target, borrowAmount, true);

      // Increase time by 1 year
      await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      const interest = await loanManager.calculateInterest(user1.address, token.target);
      expect(interest).to.be.closeTo(ethers.parseEther("5"), ethers.parseEther("0.01")); // 5% annual interest
    });
  });

  describe("Loan Clearing", function () {
    it("Should clear loan and collateral", async function () {
      const { loanManager, token, user1 } = await loadFixture(deployLoanManagerFixture);
      const collateralAmount = ethers.parseEther("150");
      const borrowAmount = ethers.parseEther("100");

      await loanManager.updateCollateral(user1.address, token.target, collateralAmount, true);
      await loanManager.updateLoan(user1.address, token.target, borrowAmount, true);

      await expect(loanManager.clearLoan(user1.address, token.target, token.target))
        .to.emit(loanManager, "LoanCleared")
        .withArgs(user1.address, token.target, token.target);

      expect(await loanManager.getCollateralAmount(user1.address, token.target)).to.equal(0);
      expect(await loanManager.getLoanAmount(user1.address, token.target)).to.equal(0);
    });
  });
});

