// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title PaymentRouter
/// @notice USDC micropayment router for agent-to-agent payments.
/// @dev    Skims a fixed fee to treasury and sends the net amount to the recipient.
contract PaymentRouter {
    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant DEFAULT_FEE_BPS = 100; // 1%

    address public immutable usdc;
    address public treasury;
    uint16 public feeBps;

    event Paid(
        address indexed payer,
        address indexed recipient,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 netAmount,
        string memo
    );
    event TreasuryChanged(address indexed oldTreasury, address indexed newTreasury);
    event FeeBpsChanged(uint16 oldFeeBps, uint16 newFeeBps);

    error InvalidAmount();
    error InvalidRecipient();
    error InvalidTreasury();
    error FeeTooHigh();
    error NotTreasury();
    error TransferFailed();

    constructor(address usdc_, address treasury_) {
        if (usdc_ == address(0)) revert InvalidRecipient();
        if (treasury_ == address(0)) revert InvalidTreasury();
        usdc = usdc_;
        treasury = treasury_;
        feeBps = DEFAULT_FEE_BPS;
    }

    function pay(address recipient, uint256 amount, string calldata memo)
        external
        returns (uint256 feeAmount, uint256 netAmount)
    {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        feeAmount = (amount * feeBps) / BPS_DENOMINATOR;
        netAmount = amount - feeAmount;

        if (feeAmount > 0) {
            _safeTransferFrom(usdc, msg.sender, treasury, feeAmount);
        }
        _safeTransferFrom(usdc, msg.sender, recipient, netAmount);

        emit Paid(msg.sender, recipient, amount, feeAmount, netAmount, memo);
    }

    function setTreasury(address newTreasury) external {
        if (msg.sender != treasury) revert NotTreasury();
        if (newTreasury == address(0)) revert InvalidTreasury();
        emit TreasuryChanged(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setFeeBps(uint16 newFeeBps) external {
        if (msg.sender != treasury) revert NotTreasury();
        if (newFeeBps > 1_000) revert FeeTooHigh(); // hard cap at 10%
        emit FeeBpsChanged(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(bytes4(keccak256("transferFrom(address,address,uint256)")), from, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }
}
