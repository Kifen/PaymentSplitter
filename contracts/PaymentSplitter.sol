//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./IERC20.sol";

contract PaymentSplitter {

    address private admin;
    uint256 constant FEE = 100000000000000000; // 0.1% scaled to 18

    mapping(address => uint256) private tokenFees; // mapping of Token to total fees received

    event SendEth(address indexed from, address payable[] indexed to, uint256 indexed amount, uint256 fee);
    event SendToken(address indexed from, address[] indexed to, uint256 indexed amount, uint256 fee);
    event WithdrawEth(address payable recipient, uint256 indexed amount);

    
    constructor() {
      admin = msg.sender;
    }

    function sendPayment(address payable[] memory payees) external payable  {
      uint256 amount = msg.value;
      require(amount > 0, "PaymentSplitter: zero ETH sent");
      require(payees.length > 0, "PaymentSplitter: zero payees");

      (uint256 fee, uint256 amountToShare) = _share(amount, payees.length);

      for(uint256 i = 0; i < payees.length; i++) {
        address payable payee = payees[i];
         payee.transfer(amountToShare);
      }

      emit SendEth(msg.sender, payees, amountToShare, fee);
    }

    function sendPayment(address [] memory payees, IERC20 token, uint256 amount) external {
      require(token.allowance(msg.sender, address(this)) >= amount, "PaymentSplitter: zero allowance");
      (uint256 fee, uint256 amountToShare) = _share(amount, payees.length);

      for(uint256 i = 0; i < payees.length; i++) {
        address payee = payees[i];
         token.transferFrom(msg.sender, payee, amountToShare);
      }

      emit SendToken(msg.sender, payees, amountToShare, fee);

    }

    function withdrawFees(address account) external payable {

    }

  function _share(uint256 amount, uint256 payeesCount) internal returns (uint256 fee, uint256 amountToShare) {
      fee = _fee(amount);
      uint256 amountAfterFee = amount - fee;
      amountToShare = _split(amountAfterFee, payeesCount);
  }  

  function _fee(uint256 amount) internal returns (uint256) {
    return (amount*FEE)/100e18;
  }

  function _split(uint256 amount, uint256 payees) internal returns (uint256) {
    return amount/payees;
  }
}
