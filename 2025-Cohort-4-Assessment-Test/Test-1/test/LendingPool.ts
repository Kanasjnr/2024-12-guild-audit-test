import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  LendingPool,
  Token,
  AuctionManager,
  LoanManager,
} from "../typechain-types";

describe("LendingPool", function () {
  async function deployLendingPoolFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const LendingPool = await ethers.getContractFactory("LendingPool");
    const lendingPool = await LendingPool.deploy();

    const Token = await ethers.getContractFactory("Token");
    const token1 = await Token.deploy("Token1", "TKN1");
    const token2 = await Token.deploy("Token2", "TKN2");

    await lendingPool.whitelistToken(token1.target);
    await lendingPool.whitelistToken(token2.target);
    await lendingPool.updatePrice(token1.target, ethers.parseEther("1"));
    await lendingPool.updatePrice(token2.target, ethers.parseEther("2"));

    const auctionManager = await ethers.getContractAt(
      "AuctionManager",
      await lendingPool.auctionManager()
    );
    const loanManager = await ethers.getContractAt(
      "LoanManager",
      await lendingPool.loanManager()
    );

    return {
      lendingPool,
      token1,
      token2,
      auctionManager,
      loanManager,
      owner,
      user1,
      user2,
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { lendingPool, owner } = await loadFixture(
        deployLendingPoolFixture
      );
      expect(await lendingPool.owner()).to.equal(owner.address);
    });

    it("Should deploy AuctionManager and LoanManager", async function () {
      const { lendingPool, auctionManager, loanManager } = await loadFixture(
        deployLendingPoolFixture
      );
      expect(await lendingPool.auctionManager()).to.equal(
        auctionManager.target
      );
      expect(await lendingPool.loanManager()).to.equal(loanManager.target);
    });
  });

  describe("Token Management", function () {
    it("Should whitelist tokens", async function () {
      const { lendingPool, token1 } = await loadFixture(
        deployLendingPoolFixture
      );
      expect(await lendingPool.whitelistedTokens(token1.target)).to.be.true;
    });

    it("Should update token prices", async function () {
      const { lendingPool, token1 } = await loadFixture(
        deployLendingPoolFixture
      );
      const newPrice = ethers.parseEther("1.5");
      await expect(lendingPool.updatePrice(token1.target, newPrice))
        .to.emit(lendingPool, "PriceUpdated")
        .withArgs(token1.target, newPrice);
      expect(await lendingPool.tokenPrices(token1.target)).to.equal(newPrice);
    });

    it("Should not allow non-owner to whitelist tokens", async function () {
      const { lendingPool, token1, user1 } = await loadFixture(
        deployLendingPoolFixture
      );
      await expect(lendingPool.connect(user1).whitelistToken(token1.target))
        .to.be.revertedWithCustomError(
          lendingPool,
          "OwnableUnauthorizedAccount"
        )
        .withArgs(user1.address);
    });

    it("Should not allow non-owner to update token prices", async function () {
      const { lendingPool, token1, user1 } = await loadFixture(
        deployLendingPoolFixture
      );
      await expect(
        lendingPool
          .connect(user1)
          .updatePrice(token1.target, ethers.parseEther("2"))
      )
        .to.be.revertedWithCustomError(
          lendingPool,
          "OwnableUnauthorizedAccount"
        )
        .withArgs(user1.address);
    });
  });

  describe("Deposit", function () {
    it("Should allow deposit of whitelisted tokens", async function () {
      const { lendingPool, token1, user1 } = await loadFixture(
        deployLendingPoolFixture
      );
      const amount = ethers.parseEther("100");
      await token1.mint(user1.address, amount);
      await token1.connect(user1).approve(lendingPool.target, amount);

      await expect(lendingPool.connect(user1).deposit(token1.target, amount))
        .to.emit(lendingPool, "Deposit")
        .withArgs(user1.address, token1.target, amount);
    });

    it("Should not allow deposit of non-whitelisted tokens", async function () {
      const { lendingPool, user1 } = await loadFixture(
        deployLendingPoolFixture
      );
      const Token = await ethers.getContractFactory("Token");
      const nonWhitelistedToken = await Token.deploy("NonWhitelisted", "NWT");
      const amount = ethers.parseEther("100");

      await nonWhitelistedToken.mint(user1.address, amount);
      await nonWhitelistedToken
        .connect(user1)
        .approve(lendingPool.target, amount);

      await expect(
        lendingPool.connect(user1).deposit(nonWhitelistedToken.target, amount)
      ).to.be.revertedWith("Token not whitelisted");
    });
  });

  describe("Borrow", function () {
    it("Should allow borrowing with sufficient collateral", async function () {
      const { lendingPool, token1, token2, user1 } = await loadFixture(
        deployLendingPoolFixture
      );
      const depositAmount = ethers.parseEther("150");
      const borrowAmount = ethers.parseEther("50");

      await token1.mint(user1.address, depositAmount);
      await token1.connect(user1).approve(lendingPool.target, depositAmount);
      await lendingPool.connect(user1).deposit(token1.target, depositAmount);

      await token2.mint(lendingPool.target, borrowAmount);

      await expect(
        lendingPool
          .connect(user1)
          .borrow(token1.target, token2.target, borrowAmount)
      )
        .to.emit(lendingPool, "Borrow")
        .withArgs(user1.address, token2.target, borrowAmount);
    });

    it("Should not allow borrowing with insufficient collateral", async function () {
      const { lendingPool, token1, token2, user1 } = await loadFixture(
        deployLendingPoolFixture
      );
      const depositAmount = ethers.parseEther("50");
      const borrowAmount = ethers.parseEther("50");

      await token1.mint(user1.address, depositAmount);
      await token1.connect(user1).approve(lendingPool.target, depositAmount);
      await lendingPool.connect(user1).deposit(token1.target, depositAmount);

      await token2.mint(lendingPool.target, borrowAmount);

      await expect(
        lendingPool
          .connect(user1)
          .borrow(token1.target, token2.target, borrowAmount)
      ).to.be.revertedWith("not enough collateral to cover loan");
    });
  });

 

   

  describe("Liquidation", function () {
    it("Should not allow liquidation of healthy positions", async function () {
      const { lendingPool, token1, user1, user2 } = await loadFixture(
        deployLendingPoolFixture
      );
      const depositAmount = ethers.parseEther("150");
      const borrowAmount = ethers.parseEther("100");

      await token1.mint(user1.address, depositAmount);
      await token1.connect(user1).approve(lendingPool.target, depositAmount);
      await lendingPool.connect(user1).deposit(token1.target, depositAmount);
      await lendingPool
        .connect(user1)
        .borrow(token1.target, token1.target, borrowAmount);

      await token1.mint(user2.address, borrowAmount);
      await token1.connect(user2).approve(lendingPool.target, borrowAmount);

      await expect(
        lendingPool
          .connect(user2)
          .liquidate(user1.address, token1.target, token1.target)
      ).to.be.revertedWith("not enough collateral to cover loan");
    });
  });

  describe("Reward Distribution", function () {
    it("Should not allow non-owner to distribute rewards", async function () {
      const { lendingPool, user1 } = await loadFixture(
        deployLendingPoolFixture
      );
      await expect(lendingPool.connect(user1).distributeRewards())
        .to.be.revertedWithCustomError(
          lendingPool,
          "OwnableUnauthorizedAccount"
        )
        .withArgs(user1.address);
    });
  });
});
