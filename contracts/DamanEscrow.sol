// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title DamanEscrow
/// @notice Non-custodial escrow for in-person deals arranged through messaging apps.
/// @dev The buyer inspects the item and completes the handoff from their own wallet.
contract DamanEscrow {
    enum DealStatus {
        None,
        Open,
        Funded,
        Completed,
        Refunded,
        Cancelled
    }

    struct Deal {
        address payable seller;
        address buyer;
        uint128 price;
        uint64 deadline;
        DealStatus status;
        string title;
        string terms;
    }

    error DealNotFound();
    error InvalidBuyer();
    error InvalidDeadline();
    error InvalidPrice();
    error InvalidText();
    error InvalidStatus();
    error IncorrectPayment();
    error NotSeller();
    error NotBuyer();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error TransferFailed();
    error ReentrantCall();

    event DealCreated(
        uint256 indexed dealId,
        address indexed seller,
        address indexed designatedBuyer,
        uint256 price,
        uint256 deadline,
        string title
    );
    event DealFunded(uint256 indexed dealId, address indexed buyer, uint256 amount);
    event DealCompleted(uint256 indexed dealId, address indexed buyer, address indexed seller, uint256 amount);
    event DealRefunded(uint256 indexed dealId, address indexed buyer, uint256 amount);
    event DealCancelled(uint256 indexed dealId);

    uint256 public nextDealId = 1;
    mapping(uint256 => Deal) private deals;
    mapping(address => uint256[]) private sellerDealIds;
    mapping(address => uint256[]) private buyerDealIds;
    uint256 private unlocked = 1;

    modifier nonReentrant() {
        if (unlocked != 1) revert ReentrantCall();
        unlocked = 2;
        _;
        unlocked = 1;
    }

    modifier existingDeal(uint256 dealId) {
        if (deals[dealId].status == DealStatus.None) revert DealNotFound();
        _;
    }

    /// @param designatedBuyer Optional buyer address. Use address(0) for an open payment link.
    function createDeal(
        string calldata title,
        string calldata terms,
        address designatedBuyer,
        uint128 price,
        uint64 deadline
    ) external returns (uint256 dealId) {
        uint256 titleLength = bytes(title).length;
        uint256 termsLength = bytes(terms).length;
        if (titleLength == 0 || titleLength > 80 || termsLength == 0 || termsLength > 500) {
            revert InvalidText();
        }
        if (price == 0) revert InvalidPrice();
        if (deadline <= block.timestamp || deadline > block.timestamp + 30 days) revert InvalidDeadline();
        if (designatedBuyer == msg.sender) revert InvalidBuyer();

        dealId = nextDealId++;
        deals[dealId] = Deal({
            seller: payable(msg.sender),
            buyer: designatedBuyer,
            price: price,
            deadline: deadline,
            status: DealStatus.Open,
            title: title,
            terms: terms
        });
        sellerDealIds[msg.sender].push(dealId);

        emit DealCreated(dealId, msg.sender, designatedBuyer, price, deadline, title);
    }

    function fundDeal(uint256 dealId) external payable existingDeal(dealId) {
        Deal storage deal = deals[dealId];
        if (deal.status != DealStatus.Open) revert InvalidStatus();
        if (block.timestamp >= deal.deadline) revert DeadlinePassed();
        if (deal.buyer != address(0) && deal.buyer != msg.sender) revert NotBuyer();
        if (msg.sender == deal.seller) revert InvalidBuyer();
        if (msg.value != deal.price) revert IncorrectPayment();

        if (deal.buyer == address(0)) deal.buyer = msg.sender;
        deal.status = DealStatus.Funded;
        buyerDealIds[msg.sender].push(dealId);

        emit DealFunded(dealId, msg.sender, msg.value);
    }

    /// @notice Buyer confirms the in-person handoff and releases payment.
    function completeHandoff(uint256 dealId) external nonReentrant existingDeal(dealId) {
        Deal storage deal = deals[dealId];
        if (deal.status != DealStatus.Funded) revert InvalidStatus();
        if (msg.sender != deal.buyer) revert NotBuyer();

        deal.status = DealStatus.Completed;
        uint256 amount = deal.price;
        (bool sent, ) = deal.seller.call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit DealCompleted(dealId, deal.buyer, deal.seller, amount);
    }

    /// @notice Seller can return a funded deal at any time if the handoff cannot happen.
    function refundBySeller(uint256 dealId) external nonReentrant existingDeal(dealId) {
        Deal storage deal = deals[dealId];
        if (msg.sender != deal.seller) revert NotSeller();
        if (deal.status != DealStatus.Funded) revert InvalidStatus();
        _refund(dealId, deal);
    }

    /// @notice Anyone may execute an expired refund, but funds always return to the buyer.
    function refundExpiredDeal(uint256 dealId) external nonReentrant existingDeal(dealId) {
        Deal storage deal = deals[dealId];
        if (deal.status != DealStatus.Funded) revert InvalidStatus();
        if (block.timestamp < deal.deadline) revert DeadlineNotPassed();
        _refund(dealId, deal);
    }

    function cancelUnfundedDeal(uint256 dealId) external existingDeal(dealId) {
        Deal storage deal = deals[dealId];
        if (msg.sender != deal.seller) revert NotSeller();
        if (deal.status != DealStatus.Open) revert InvalidStatus();
        deal.status = DealStatus.Cancelled;
        emit DealCancelled(dealId);
    }

    function getDeal(uint256 dealId) external view existingDeal(dealId) returns (Deal memory) {
        return deals[dealId];
    }

    function getSellerDealIds(address seller) external view returns (uint256[] memory) {
        return sellerDealIds[seller];
    }

    function getBuyerDealIds(address buyer) external view returns (uint256[] memory) {
        return buyerDealIds[buyer];
    }

    function _refund(uint256 dealId, Deal storage deal) private {
        deal.status = DealStatus.Refunded;
        uint256 amount = deal.price;
        address buyer = deal.buyer;
        (bool sent, ) = payable(buyer).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit DealRefunded(dealId, buyer, amount);
    }
}
