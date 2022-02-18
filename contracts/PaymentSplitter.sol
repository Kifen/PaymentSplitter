//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract PaymentSplitter {
  address public admin;
  uint256 constant FEE = 100000000000000000; // 0.1% scaled to 18

  IERC20[] public allTokens;
  mapping(IERC20 => bool) private tokens;

  event SendEth(
    address indexed from,
    address[] indexed to,
    uint256 indexed amount,
    uint256 fee
  );
  event SendToken(
    address indexed from,
    address[] indexed to,
    uint256 indexed amount,
    uint256 fee
  );
  event WithdrawFees(address recipient, uint256 indexed ethAmount);

  constructor() {
    admin = msg.sender;
  }

  /**
   * @notice sender sends ETH ERC20  token to be didtributed equally amount `payees`
   * @param payees recipient addresses to distribute payments
   * @param token ERC20 token to distribute
   * @param amount amount of tokens or ETH to distribute
   */
  function sendPayment(
    address[] memory payees,
    IERC20 token,
    uint256 amount
  ) external payable {
    require(payees.length > 0, "PaymentSplitter: zero payees");
    uint256 ethValue = msg.value;

    if (ethValue > 0) {
      _checkAmount(amount, ethValue);
      _sendEth(payees, ethValue);
    } else if (address(token) != address(0)) {
      _checkAmount(amount, token.allowance(msg.sender, address(this)));
      _sendTokens(payees, token, amount);
    }
  }

  /**
   * @notice admin withdraws all fees from contract
   * @param account recipient account to send fees to
   */
  function withdrawFees(address account) external {
    require(msg.sender == admin, "PaymentSplitter: unauthorized");

    _withdrawTokens(account);
    uint256 ethWithdrawn = _withdrawEth(payable(account));

    emit WithdrawFees(account, ethWithdrawn);
  }

  // Internal helper functions

  function _sendEth(address[] memory payees, uint256 amount) internal {
    (uint256 fee, uint256 amountToShare) = _share(amount, payees.length);

    for (uint256 i = 0; i < payees.length; i++) {
      address payable payee = payable(payees[i]);
      payee.transfer(amountToShare);
    }

    emit SendEth(msg.sender, payees, amountToShare, fee);
  }

  function _sendTokens(
    address[] memory payees,
    IERC20 token,
    uint256 amount
  ) internal {
    require(
      token.allowance(msg.sender, address(this)) >= amount,
      "PaymentSplitter: zero token allowance"
    );

    (uint256 fee, uint256 amountToShare) = _share(amount, payees.length);

    token.transferFrom(msg.sender, address(this), fee);
    for (uint256 i = 0; i < payees.length; i++) {
      address payee = payees[i];
      token.transferFrom(msg.sender, payee, amountToShare);
    }

    bool exists = tokens[token];
    if (!exists) {
      tokens[token] = true;
      allTokens.push(token);
    }

    emit SendToken(msg.sender, payees, amountToShare, fee);
  }

  function _checkAmount(uint256 amountToSend, uint256 availableAmount)
    internal
  {
    if (availableAmount < amountToSend) {
      revert("PaymentSplitter: incorrect amount to send");
    }
  }

  function _withdrawTokens(address account) internal {
    for (uint256 i = 0; i < allTokens.length; i++) {
      IERC20 token = allTokens[i];
      uint256 tokenBalance = token.balanceOf(address(this));

      if (tokenBalance > 0) {
        token.transfer(account, tokenBalance);
      }
    }
  }

  function _withdrawEth(address payable account) internal returns (uint256) {
    uint256 contractEthBalance = address(this).balance;

    if (contractEthBalance < 0) return 0;

    account.transfer(contractEthBalance);

    return contractEthBalance;
  }

  function _share(uint256 amount, uint256 payeesCount)
    internal
    returns (uint256 fee, uint256 amountToShare)
  {
    fee = _fee(amount);
    uint256 amountAfterFee = amount - fee;
    amountToShare = _split(amountAfterFee, payeesCount);
  }

  function _fee(uint256 amount) internal returns (uint256) {
    return (amount * FEE) / 100e18;
  }

  function _split(uint256 amount, uint256 payees) internal returns (uint256) {
    return amount / payees;
  }
}
