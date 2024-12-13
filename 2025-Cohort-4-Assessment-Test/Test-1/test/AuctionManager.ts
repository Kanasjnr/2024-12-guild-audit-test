import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { AuctionManager, Token } from "../typechain-types";

describe("AuctionManager", function () {
  async function deployAuctionManagerFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const AuctionManager = await ethers.getContractFactory("AuctionManager");
    const auctionManager = await AuctionManager.deploy();

    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy("Auction Token", "AUT");

    return { auctionManager, token, owner, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { auctionManager, owner } = await loadFixture(deployAuctionManagerFixture);
      expect(await auctionManager.owner()).to.equal(owner.address);
    });
  });

  describe("Create Auction", function () {
    it("Should allow owner to create an auction", async function () {
      const { auctionManager, token, owner } = await loadFixture(deployAuctionManagerFixture);
      const amount = ethers.parseEther("100");

      await expect(auctionManager.createAuction(token.target, amount))
        .to.emit(auctionManager, "AuctionCreated")
        .withArgs(0, token.target, amount);

      const auction = await auctionManager.auctions(0);
      expect(auction.token).to.equal(token.target);
      expect(auction.amount).to.equal(amount);
    });

    it("Should not allow non-owner to create an auction", async function () {
      const { auctionManager, token, user1 } = await loadFixture(deployAuctionManagerFixture);
      const amount = ethers.parseEther("100");

      await expect(auctionManager.connect(user1).createAuction(token.target, amount))
        .to.be.revertedWithCustomError(auctionManager, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });
  });

  describe("Place Bid", function () {
    it("Should allow users to place bids", async function () {
      const { auctionManager, token, owner, user1 } = await loadFixture(deployAuctionManagerFixture);
      const auctionAmount = ethers.parseEther("100");
      const bidAmount = ethers.parseEther("1");

      await auctionManager.createAuction(token.target, auctionAmount);

      await expect(auctionManager.connect(user1).placeBid(0, { value: bidAmount }))
        .to.emit(auctionManager, "BidPlaced")
        .withArgs(0, user1.address, bidAmount);

      const auction = await auctionManager.auctions(0);
      expect(auction.highestBidder).to.equal(user1.address);
      expect(auction.highestBid).to.equal(bidAmount);
    });

    it("Should not allow bids lower than the current highest bid", async function () {
      const { auctionManager, token, owner, user1, user2 } = await loadFixture(deployAuctionManagerFixture);
      const auctionAmount = ethers.parseEther("100");
      const bidAmount1 = ethers.parseEther("1");
      const bidAmount2 = ethers.parseEther("0.5");

      await auctionManager.createAuction(token.target, auctionAmount);
      await auctionManager.connect(user1).placeBid(0, { value: bidAmount1 });

      await expect(auctionManager.connect(user2).placeBid(0, { value: bidAmount2 }))
        .to.be.revertedWith("Bid too low");
    });
  });

  describe("End Auction", function () {
    it("Should allow owner to end auction after 1 day", async function () {
      const { auctionManager, token, owner, user1 } = await loadFixture(deployAuctionManagerFixture);
      const auctionAmount = ethers.parseEther("100");
      const bidAmount = ethers.parseEther("1");

      await auctionManager.createAuction(token.target, auctionAmount);
      await auctionManager.connect(user1).placeBid(0, { value: bidAmount });

      await ethers.provider.send("evm_increaseTime", [86400]); // Increase time by 1 day
      await ethers.provider.send("evm_mine", []);

      await token.mint(auctionManager.target, auctionAmount);

      await expect(auctionManager.endAuction(0))
        .to.emit(auctionManager, "AuctionEnded")
        .withArgs(0, user1.address, bidAmount);

      const auction = await auctionManager.auctions(0);
      expect(auction.ended).to.be.true;
    });

    it("Should not allow ending auction before 1 day has passed", async function () {
      const { auctionManager, token, owner } = await loadFixture(deployAuctionManagerFixture);
      const auctionAmount = ethers.parseEther("100");

      await auctionManager.createAuction(token.target, auctionAmount);

      await expect(auctionManager.endAuction(0))
        .to.be.revertedWith("Auction not ended yet");
    });
  });

  describe("Withdraw Funds", function () {
    it("Should allow owner to withdraw funds", async function () {
      const { auctionManager, token, owner, user1 } = await loadFixture(deployAuctionManagerFixture);
      const auctionAmount = ethers.parseEther("100");
      const bidAmount = ethers.parseEther("1");

      await auctionManager.createAuction(token.target, auctionAmount);
      await auctionManager.connect(user1).placeBid(0, { value: bidAmount });

      await ethers.provider.send("evm_increaseTime", [86400]); // Increase time by 1 day
      await ethers.provider.send("evm_mine", []);

      await token.mint(auctionManager.target, auctionAmount);
      await auctionManager.endAuction(0);

      const initialBalance = await ethers.provider.getBalance(owner.address);
      await auctionManager.withdrawFunds();
      const finalBalance = await ethers.provider.getBalance(owner.address);

      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should not allow non-owner to withdraw funds", async function () {
      const { auctionManager, user1 } = await loadFixture(deployAuctionManagerFixture);

      await expect(auctionManager.connect(user1).withdrawFunds())
        .to.be.revertedWithCustomError(auctionManager, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });
  });
});

