const { expect } = require("chai");
const { ethers } = require("hardhat");
const { calculateFeeBN, splitBN } = require("./utils");

describe("PaymentSplitter", () => {
  let admin, wallet, bob, alice, payee1, payee2, payee3, payee4, payee5;
  let paymentSplitter;
  let mockToken;
  let payees;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const FEE = ethers.utils.parseEther("0.1");

  beforeEach(async () => {
    [admin, wallet, bob, alice, payee1, payee2, payee3, payee4, payee5] =
      await ethers.getSigners();

    payees = [
      payee1.address,
      payee2.address,
      payee3.address,
      payee4.address,
      payee5.address,
    ];

    const PaymentSplitter = await ethers.getContractFactory("PaymentSplitter");

    paymentSplitter = await PaymentSplitter.deploy();
    await paymentSplitter.deployed();

    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy();
    await mockToken.deploy;

    expect(await paymentSplitter.admin()).to.equal(admin.address);
  });

  const ethBalance = async (addresses) => {
    return (balances = await Promise.all(
      addresses.map(async (address) => {
        return admin.provider.getBalance(address);
      })
    ));
  };

  const tokenBalance = async (addresses) => {
    return (balances = await Promise.all(
      addresses.map(async (address) => {
        return mockToken.balanceOf(address);
      })
    ));
  };

  const sendEth = async (sender, amount) => {
    await paymentSplitter
      .connect(sender)
      .sendPayment(payees, ZERO_ADDRESS, amount, { value: amount });

    const fee = calculateFeeBN(amount, FEE);
    const amountShared = amount.sub(fee);
    const splitAmount = splitBN(amountShared, payees.length);

    return {
      fee,
      amountShared,
      splitAmount,
    };
  };

  const sendTokens = async (sender, amount) => {
    await mockToken.transfer(sender.address, amount);
    await mockToken.connect(sender).approve(paymentSplitter.address, amount);

    await paymentSplitter
      .connect(sender)
      .sendPayment(payees, mockToken.address, amount);

    const fee = calculateFeeBN(amount, FEE);
    const amountShared = amount.sub(fee);
    const splitAmount = splitBN(amountShared, payees.length);

    return {
      fee,
      amountShared,
      splitAmount,
    };
  };
  describe("sendPayment", () => {
    it("should share ETH", async () => {
      const sender = bob;
      const amount = ethers.utils.parseEther("0.5");

      const initialBalances = await ethBalance(payees);

      const { fee, amountShared, splitAmount } = await sendEth(sender, amount);

      const finalBalances = await ethBalance(payees);

      for (let i = 0; i < payees.length; i++) {
        expect(finalBalances[i]).to.equal(initialBalances[i].add(splitAmount));
      }

      expect((await ethBalance([paymentSplitter.address]))[0]).to.equal(fee);
    });

    it("should send token", async () => {
      const sender = alice;
      const amount = ethers.utils.parseEther("250");

      const initialBalances = await tokenBalance(payees);

      //expect(await tokenBalance([sender.address])).to.equal(amount);

      const { fee, amountShared, splitAmount } = await sendTokens(
        sender,
        amount
      );

      const finalBalances = await tokenBalance(payees);

      for (let i = 0; i < payees.length; i++) {
        expect(finalBalances[i]).to.equal(initialBalances[i].add(splitAmount));
      }

      expect((await tokenBalance([paymentSplitter.address]))[0]).to.equal(fee);
    });

    it("should revert is 0 payess sent", async () => {
      const sender = alice;
      const amount = ethers.utils.parseEther("90");

      await expect(
        paymentSplitter.connect(sender).sendPayment([], ZERO_ADDRESS, amount)
      ).to.revertedWith("PaymentSplitter: zero payees");
    });

    it("should revert if amount is incorrect", async () => {
      const sender = alice;
      const amount = ethers.utils.parseEther("100");

      await expect(
        paymentSplitter
          .connect(sender)
          .sendPayment(payees, ZERO_ADDRESS, amount, {
            value: ethers.utils.parseEther("99"),
          })
      ).to.revertedWith("PaymentSplitter: incorrect amount to send");
    });
  });

  describe("withdrawFees", () => {
    it("should let admin withdraw", async () => {
      // Send ETH payments
      let sender = bob;
      let amount = ethers.utils.parseEther("450");

      let initEthBalance = await ethBalance([paymentSplitter.address]);
      initEthBalance = initEthBalance[0];

      let initWalletEthBalance = await ethBalance([wallet.address]);
      initWalletEthBalance = initWalletEthBalance[0];

      const {
        fee: fee1,
        amountShared,
        splitAmount,
      } = await sendEth(sender, amount);

      // Send Token payments
      sender = alice;
      amount = ethers.utils.parseEther("800");

      let initTokenBalance = await tokenBalance([paymentSplitter.address]);
      initTokenBalance = initTokenBalance[0];

      const {
        fee: fee2,
        amountShared2,
        splitAmount2,
      } = await sendTokens(sender, amount);

      let ethBalanceBeforeFeeWithdrawal = await ethBalance([
        paymentSplitter.address,
      ]);

      ethBalanceBeforeFeeWithdrawal = ethBalanceBeforeFeeWithdrawal[0];

      let tokenBalanceBeforeFeeWithdrawal = await tokenBalance([
        paymentSplitter.address,
      ]);
      tokenBalanceBeforeFeeWithdrawal = tokenBalanceBeforeFeeWithdrawal[0];

      await paymentSplitter.withdrawFees(wallet.address);

      let finalEthBalance = await ethBalance([paymentSplitter.address]);
      finalEthBalance = finalEthBalance[0];

      let finalTokenBalance = await tokenBalance([paymentSplitter.address]);
      finalTokenBalance = finalTokenBalance[0];

      expect(initTokenBalance).to.equal(0);
      expect(initEthBalance).to.equal(0);
      expect(tokenBalanceBeforeFeeWithdrawal).to.equal(fee2);
      expect(ethBalanceBeforeFeeWithdrawal).to.equal(fee1);
      expect(finalTokenBalance).to.equal(0);
      expect(finalEthBalance).to.equal(0);
      expect((await tokenBalance([wallet.address]))[0]).to.equal(fee2);
      expect((await ethBalance([wallet.address]))[0]).to.equal(
        initWalletEthBalance.add(fee1)
      );
    });

    it("should revert if caller isn't admin", async () => {
      const sender = bob;

      await expect(
        paymentSplitter.connect(sender).withdrawFees(wallet.address)
      ).to.be.revertedWith("PaymentSplitter: unauthorized");
    });
  });
});
