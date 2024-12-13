// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AuctionManager is Ownable {
    struct Auction {
        address token;
        uint256 amount;
        uint256 startTime;
        address highestBidder;
        uint256 highestBid;
        bool ended;
    }

    mapping(uint256 => Auction) public auctions;
    uint256 public auctionCount;

    event AuctionCreated(uint256 indexed auctionId, address indexed token, uint256 amount);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed auctionId, address indexed winner, uint256 amount);

    function createAuction(address token, uint256 amount) external onlyOwner {
        uint256 auctionId = auctionCount++;
        auctions[auctionId] = Auction({
            token: token,
            amount: amount,
            startTime: block.timestamp,
            highestBidder: address(0),
            highestBid: 0,
            ended: false
        });

        emit AuctionCreated(auctionId, token, amount);
    }

    function placeBid(uint256 auctionId) external payable {
        Auction storage auction = auctions[auctionId];
        require(!auction.ended, "Auction ended");
        require(msg.value > auction.highestBid, "Bid too low");

        if (auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit BidPlaced(auctionId, msg.sender, msg.value);
    }

    function endAuction(uint256 auctionId) external onlyOwner {
        Auction storage auction = auctions[auctionId];
        require(!auction.ended, "Auction already ended");
        require(block.timestamp >= auction.startTime + 1 days, "Auction not ended yet");

        auction.ended = true;

        if (auction.highestBidder != address(0)) {
            IERC20(auction.token).transfer(auction.highestBidder, auction.amount);
            emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
        } else {
            emit AuctionEnded(auctionId, address(0), 0);
        }
    }

    function withdrawFunds() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    constructor() Ownable(msg.sender) {}
}

